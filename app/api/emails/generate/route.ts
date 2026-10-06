import { NextResponse } from "next/server"
import { customAlphabet, nanoid } from "nanoid"
import { createDb } from "@/lib/db"
import { emails } from "@/lib/schema"
import { eq, and, gt, sql } from "drizzle-orm"
import { EXPIRY_OPTIONS } from "@/types/email"
import { EMAIL_CONFIG } from "@/config"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { getUserId } from "@/lib/apiKey"
import { getUserRole } from "@/lib/auth"
import { ROLES } from "@/lib/permissions"

export const runtime = "edge"

// A subdomain prefix is one or more DNS labels placed before the configured
// domain, e.g. `edu` or `team.a` in `user@edu.busmail.app`. Each label is 1-63
// characters and the whole prefix is limited to 253 characters.
const SUBDOMAIN_PREFIX_PATTERN =
  /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

// 注册机场景：subDomain 传 "random"（不区分大小写）时由服务端随机生成子域名前缀。
// 仅用 DNS 安全的小写字母+数字，避免 nanoid 默认字符集中的 `_`（非法 DNS 字符）。
const RANDOM_SUBDOMAIN_SENTINEL = "random"
const randomSubdomainPrefix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6)
const RANDOM_SUBDOMAIN_MAX_ATTEMPTS = 5

export async function POST(request: Request) {
  const db = createDb()
  const env = getRequestContext().env

  const userId = await getUserId()
  const userRole = await getUserRole(userId!)

  try {
    if (userRole !== ROLES.EMPEROR) {
      const maxEmails = await env.SITE_CONFIG.get("MAX_EMAILS") || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString()
      const activeEmailsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(
          and(
            eq(emails.userId, userId!),
            gt(emails.expiresAt, new Date())
          )
        )
      
      if (Number(activeEmailsCount[0].count) >= Number(maxEmails)) {
        return NextResponse.json(
          { error: `已达到最大邮箱数量限制 (${maxEmails})` },
          { status: 403 }
        )
      }
    }

    const { name, subDomain, expiryTime, domain } = await request.json<{ 
      name: string
      subDomain?: string
      expiryTime: number
      domain: string
    }>()

    if (!EXPIRY_OPTIONS.some(option => option.value === expiryTime)) {
      return NextResponse.json(
        { error: "无效的过期时间" },
        { status: 400 }
      )
    }

    const domainString = await env.SITE_CONFIG.get("EMAIL_DOMAINS")
    const subdomainString = await env.SITE_CONFIG.get("EMAIL_SUBDOMAIN_DOMAINS")
    const disabledString = await env.SITE_CONFIG.get("EMAIL_DISABLED_DOMAINS")
    const domains = domainString ? domainString.split(',') : ["moemail.app"]
    const subdomainDomains = subdomainString
      ? subdomainString.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
      : []
    const disabledDomains = disabledString
      ? disabledString.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
      : []

    if (!domains || !domains.includes(domain)) {
      return NextResponse.json(
        { error: "无效的域名" },
        { status: 400 }
      )
    }

    if (disabledDomains.includes(domain.trim().toLowerCase())) {
      return NextResponse.json(
        {
          code: "DOMAIN_DISABLED",
          error: "该域名已停用，无法创建邮箱，请更换域名或联系管理员",
          domain,
        },
        { status: 403 }
      )
    }

    const normalizedSubDomain =
      typeof subDomain === "string" ? subDomain.trim().replace(/^\.+|\.+$/g, "") : ""

    // "random" 为保留哨兵值：请求服务端随机生成子域名前缀
    const wantsRandomSubdomain = normalizedSubDomain.toLowerCase() === RANDOM_SUBDOMAIN_SENTINEL

    if (!wantsRandomSubdomain && normalizedSubDomain && !SUBDOMAIN_PREFIX_PATTERN.test(normalizedSubDomain)) {
      return NextResponse.json(
        { error: "无效的子域名前缀" },
        { status: 400 }
      )
    }

    const subdomainAllowedForDomain =
      subdomainDomains.length === 0 || subdomainDomains.includes(domain.trim().toLowerCase())

    if ((wantsRandomSubdomain || normalizedSubDomain) && !subdomainAllowedForDomain) {
      return NextResponse.json(
        {
          code: "SUBDOMAIN_NOT_ENABLED",
          error: "该域名未启用子域名邮箱，请清空子域名前缀后重试，或联系管理员开启",
          domain,
        },
        { status: 400 }
      )
    }

    const localPart = name || nanoid(8)
    const buildAddress = (subdomainPrefix: string) =>
      `${localPart}@${subdomainPrefix ? `${subdomainPrefix}.` : ""}${domain}`

    let address = ""
    let generatedSubDomain: string | null = null

    if (wantsRandomSubdomain) {
      // 随机子域名：生成后逐个查重，撞地址（概率极低）则换一个重试
      for (let attempt = 0; attempt < RANDOM_SUBDOMAIN_MAX_ATTEMPTS; attempt++) {
        const candidate = randomSubdomainPrefix()
        const candidateAddress = buildAddress(candidate)
        const existing = await db.query.emails.findFirst({
          where: eq(sql`LOWER(${emails.address})`, candidateAddress.toLowerCase())
        })
        if (!existing) {
          address = candidateAddress
          generatedSubDomain = candidate
          break
        }
      }
      if (!address) {
        return NextResponse.json(
          { error: "随机子域名生成冲突，请重试" },
          { status: 503 }
        )
      }
    } else {
      address = buildAddress(normalizedSubDomain)
      const existingEmail = await db.query.emails.findFirst({
        where: eq(sql`LOWER(${emails.address})`, address.toLowerCase())
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: "该邮箱地址已被使用" },
          { status: 409 }
        )
      }
    }

    const now = new Date()
    const expires = expiryTime === 0 
      ? new Date('9999-01-01T00:00:00.000Z')
      : new Date(now.getTime() + expiryTime)
    
    const emailData: typeof emails.$inferInsert = {
      address,
      createdAt: now,
      expiresAt: expires,
      userId: userId!
    }
    
    const result = await db.insert(emails)
      .values(emailData)
      .returning({ id: emails.id, address: emails.address })
    
    return NextResponse.json({ 
      id: result[0].id,
      email: result[0].address,
      ...(generatedSubDomain ? { subDomain: generatedSubDomain } : {})
    })
  } catch (error) {
    console.error('Failed to generate email:', error)
    return NextResponse.json(
      { error: "创建邮箱失败" },
      { status: 500 }
    )
  }
} 