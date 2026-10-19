import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { emails } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { getUserId } from "@/lib/apiKey"

export const runtime = "edge"

// 切换邮箱锁定：锁定后单个删除 / 批量删除都会拒绝，只能先解锁再删
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()

  try {
    const db = createDb()
    const { id } = await params
    const { locked } = await request.json<{ locked?: unknown }>()

    if (typeof locked !== "boolean") {
      return NextResponse.json(
        { error: "locked 必须是布尔值" },
        { status: 400 }
      )
    }

    const email = await db.query.emails.findFirst({
      where: and(
        eq(emails.id, id),
        eq(emails.userId, userId!)
      ),
      columns: { id: true }
    })

    if (!email) {
      return NextResponse.json(
        { error: "邮箱不存在或无权限操作" },
        { status: 403 }
      )
    }

    await db.update(emails)
      .set({ isLocked: locked })
      .where(
        and(
          eq(emails.id, id),
          eq(emails.userId, userId!)
        )
      )

    return NextResponse.json({ success: true, locked })
  } catch (error) {
    console.error('Failed to toggle email lock:', error)
    return NextResponse.json(
      { error: "切换锁定状态失败" },
      { status: 500 }
    )
  }
}
