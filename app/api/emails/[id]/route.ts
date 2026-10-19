import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { emails, messages, pendingMessages } from "@/lib/schema"
import { eq, and, lt, or, sql, ne, isNull } from "drizzle-orm"
import { encodeCursor, decodeCursor } from "@/lib/cursor"
import { getUserId } from "@/lib/apiKey"
import { checkBasicSendPermission } from "@/lib/send-permissions"

export const runtime = "edge"

// 删邮箱后邮件转暂存的保留期：7 天（与收信暂存一致），过期由 cleanup 清理
const PENDING_MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// 删邮箱时把邮件转入 pending 暂存（而不是直接丢弃），同地址重建时自动认领回来
async function stashMessagesForDelete(
  db: ReturnType<typeof createDb>,
  emailId: string,
  address: string,
) {
  const rows = await db.query.messages.findMany({
    where: and(
      eq(messages.emailId, emailId),
      eq(messages.type, "received")
    ),
    columns: {
      fromAddress: true,
      toAddress: true,
      subject: true,
      content: true,
      html: true,
      receivedAt: true,
    },
  })
  if (rows.length === 0) return 0

  const now = new Date()
  const expiresAt = new Date(now.getTime() + PENDING_MESSAGE_TTL_MS)
  await db.insert(pendingMessages).values(
    rows.map((m) => ({
      address,
      addressLower: address.toLowerCase(),
      fromAddress: m.fromAddress,
      toAddress: m.toAddress,
      subject: m.subject,
      content: m.content,
      html: m.html,
      receivedAt: m.receivedAt,
      expiresAt,
    }))
  )
  return rows.length
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()

  try {
    const db = createDb()
    const { id } = await params
    const email = await db.query.emails.findFirst({
      where: and(
        eq(emails.id, id),
        eq(emails.userId, userId!)
      )
    })

    if (!email) {
      return NextResponse.json(
        { error: "邮箱不存在或无权限删除" },
        { status: 403 }
      )
    }
    // 删除前先把收到的邮件转入 pending 暂存；转存失败也不阻塞删除（只打日志），
    // 避免因为 pending 表未迁移导致删不掉邮箱
    let stashedCount = 0
    try {
      stashedCount = await stashMessagesForDelete(db, id, email.address)
    } catch (stashError) {
      console.error('Failed to stash messages on delete:', stashError)
    }

    await db.delete(messages)
      .where(eq(messages.emailId, id))

    await db.delete(emails)
      .where(eq(emails.id, id))

    return NextResponse.json({ success: true, stashedCount })
  } catch (error) {
    console.error('Failed to delete email:', error)
    return NextResponse.json(
      { error: "删除邮箱失败" },
      { status: 500 }
    )
  }
} 

const PAGE_SIZE = 20

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url)
  const cursorStr = searchParams.get('cursor')
  const messageType = searchParams.get('type')

  try {
    const db = createDb()
    const { id } = await params

    const userId = await getUserId()
    if (messageType === 'sent') {
      const permissionResult = await checkBasicSendPermission(userId!)
      if (!permissionResult.canSend) {
        return NextResponse.json(
          { error: permissionResult.error || "您没有查看发送邮件的权限" },
          { status: 403 }
        )
      }
    }

    const email = await db.query.emails.findFirst({
      where: and(
        eq(emails.id, id),
        eq(emails.userId, userId!)
      )
    })

    if (!email) {
      return NextResponse.json(
        { error: "无权限查看" },
        { status: 403 }
      )
    }

    const baseConditions = and(
      eq(messages.emailId, id),
      messageType === 'sent' 
        ? eq(messages.type, "sent") 
        : or(
            ne(messages.type, "sent"),
            isNull(messages.type)
          )
    )

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(baseConditions)
    const totalCount = Number(totalResult[0].count)

    const conditions = [baseConditions]

    if (cursorStr) {
      const { timestamp, id } = decodeCursor(cursorStr)
      const orderByTime = messageType === 'sent' ? messages.sentAt : messages.receivedAt
      conditions.push(
        or(
          lt(orderByTime, new Date(timestamp)),
          and(
            eq(orderByTime, new Date(timestamp)),
            lt(messages.id, id)
          )
        )
      )
    }

    const orderByTime = messageType === 'sent' ? messages.sentAt : messages.receivedAt
    
    const results = await db.query.messages.findMany({
      where: and(...conditions),
      orderBy: (messages, { desc }) => [
        desc(orderByTime),
        desc(messages.id)
      ],
      limit: PAGE_SIZE + 1
    })
    
    const hasMore = results.length > PAGE_SIZE
    const nextCursor = hasMore 
      ? encodeCursor(
          messageType === 'sent' 
            ? results[PAGE_SIZE - 1].sentAt!.getTime()
            : results[PAGE_SIZE - 1].receivedAt.getTime(),
          results[PAGE_SIZE - 1].id
        )
      : null
    const messageList = hasMore ? results.slice(0, PAGE_SIZE) : results

    return NextResponse.json({ 
      messages: messageList.map(msg => ({
        id: msg.id,
        from_address: msg?.fromAddress,
        to_address: msg?.toAddress,
        subject: msg.subject,
        content: msg.content,
        html: msg.html,
        sent_at: msg.sentAt?.getTime(),
        received_at: msg.receivedAt?.getTime()
      })),
      nextCursor,
      total: totalCount
    })
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
} 