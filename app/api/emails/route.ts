import { createDb } from "@/lib/db"
import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { emails, messages } from "@/lib/schema"
import { encodeCursor, decodeCursor } from "@/lib/cursor"
import { getUserId } from "@/lib/apiKey"

export const runtime = "edge"

const PAGE_SIZE = 20
const MAX_SEARCH_LENGTH = 100
const MAX_BATCH_DELETE = 100

export async function GET(request: Request) {
  const userId = await getUserId()

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const rawSearch = searchParams.get('search')?.trim() ?? ""
  const search = rawSearch.slice(0, MAX_SEARCH_LENGTH)

  const db = createDb()

  try {
    const baseConditions = and(
      eq(emails.userId, userId!),
      gt(emails.expiresAt, new Date())
    )

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(baseConditions)
    const totalCount = Number(totalResult[0].count)

    const conditions = [baseConditions]

    // 服务端搜索：覆盖尚未分页加载出来的邮箱，解决“要下滑到底才能搜到”的问题
    // 用 LOWER(address) LIKE 做大小写不敏感匹配，转义 % _ \ 并显式声明 ESCAPE '\'
    if (search) {
      const escaped = search.replace(/[\\%_]/g, (m) => `\\${m}`).toLowerCase()
      conditions.push(sql`LOWER(${emails.address}) LIKE ${`%${escaped}%`} ESCAPE '\\'`)
    }

    if (cursor) {
      const { timestamp, id } = decodeCursor(cursor)
      conditions.push(
        or(
          lt(emails.createdAt, new Date(timestamp)),
          and(
            eq(emails.createdAt, new Date(timestamp)),
            lt(emails.id, id)
          )
        )
      )
    }

    const results = await db.query.emails.findMany({
      where: and(...conditions),
      orderBy: (emails, { desc }) => [
        desc(emails.createdAt),
        desc(emails.id)
      ],
      limit: PAGE_SIZE + 1
    })

    const hasMore = results.length > PAGE_SIZE
    const nextCursor = hasMore
      ? encodeCursor(
          results[PAGE_SIZE - 1].createdAt.getTime(),
          results[PAGE_SIZE - 1].id
        )
      : null
    const emailList = hasMore ? results.slice(0, PAGE_SIZE) : results

    return NextResponse.json({
      emails: emailList,
      nextCursor,
      total: totalCount
    })
  } catch (error) {
    console.error('Failed to fetch user emails:', error)
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId()

  try {
    const { ids } = await request.json<{ ids?: unknown }>()

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BATCH_DELETE) {
      return NextResponse.json(
        { error: `请提供 1-${MAX_BATCH_DELETE} 个邮箱 id` },
        { status: 400 }
      )
    }

    const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))]
    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: "邮箱 id 不合法" }, { status: 400 })
    }

    const db = createDb()

    // 先查出属于当前用户的邮箱，避免误删他人数据
    const owned = await db.query.emails.findMany({
      where: and(
        eq(emails.userId, userId!),
        inArray(emails.id, uniqueIds)
      ),
      columns: { id: true }
    })
    const ownedIds = owned.map((e) => e.id)
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "邮箱不存在或无权限删除" }, { status: 403 })
    }

    await db.delete(messages).where(inArray(messages.emailId, ownedIds))
    await db.delete(emails).where(
      and(
        eq(emails.userId, userId!),
        inArray(emails.id, ownedIds)
      )
    )

    return NextResponse.json({ success: true, deletedIds: ownedIds })
  } catch (error) {
    console.error('Failed to batch delete emails:', error)
    return NextResponse.json(
      { error: "批量删除邮箱失败" },
      { status: 500 }
    )
  }
} 