import { Env } from '../types'
import { drizzle } from 'drizzle-orm/d1'
import { messages, emails, pendingMessages, webhooks } from '../app/lib/schema'
import { eq, sql } from 'drizzle-orm'
import PostalMime from 'postal-mime'
import { WEBHOOK_CONFIG } from '../app/config/webhook'
import { EmailMessage } from '../app/lib/webhook'

// 先收信、后建邮箱的暂存期：7 天
const PENDING_MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PENDING_PER_ADDRESS = 200

const handleEmail = async (message: ForwardableEmailMessage, env: Env) => {
  const db = drizzle(env.DB, { schema: { messages, emails, pendingMessages, webhooks } })

  const parsedMessage = await PostalMime.parse(message.raw)

  console.log("parsedMessage:", parsedMessage)

  try {
    const targetEmail = await db.query.emails.findFirst({
      where: eq(sql`LOWER(${emails.address})`, message.to.toLowerCase())
    })

    // 邮箱还不存在（未创建 / 已删除 / 已过期被清理）：暂存起来，
    // 等用户创建同地址邮箱时自动认领，而不是直接丢弃
    if (!targetEmail) {
      const now = new Date()
      await db.insert(pendingMessages).values({
        address: message.to,
        addressLower: message.to.toLowerCase(),
        fromAddress: message.from,
        toAddress: message.to,
        subject: parsedMessage.subject || '(无主题)',
        content: parsedMessage.text || '',
        html: parsedMessage.html || '',
        receivedAt: now,
        expiresAt: new Date(now.getTime() + PENDING_MESSAGE_TTL_MS),
      })

      // 同一地址暂存太多只保留最新 200 封，防滥用刷爆
      await env.DB.prepare(
        `DELETE FROM pending_message WHERE id IN (
          SELECT id FROM pending_message
          WHERE address_lower = ? ORDER BY received_at DESC LIMIT -1 OFFSET ?
        )`
      ).bind(message.to.toLowerCase(), MAX_PENDING_PER_ADDRESS).run()

      console.log(`Email stashed as pending (mailbox not found yet): ${message.to}`)
      return
    }

    const savedMessage = await db.insert(messages).values({
      emailId: targetEmail.id,
      fromAddress: message.from,
      subject: parsedMessage.subject || '(无主题)',
      content: parsedMessage.text || '',
      html: parsedMessage.html || '',
      type: 'received',
    }).returning().get()

    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.userId, targetEmail!.userId!)
    })

    if (webhook?.enabled) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': WEBHOOK_CONFIG.EVENTS.NEW_MESSAGE
          },
          body: JSON.stringify({
            emailId: targetEmail.id,
            messageId: savedMessage.id,
            fromAddress: savedMessage.fromAddress,
            subject: savedMessage.subject,
            content: savedMessage.content,
            html: savedMessage.html,
            receivedAt: savedMessage.receivedAt.toISOString(),
            toAddress: targetEmail.address
          } as EmailMessage)
        })
      } catch (error) {
        console.error('Failed to send webhook:', error)
      }
    }

    console.log(`Email processed: ${parsedMessage.subject}`)
  } catch (error) {
    console.error('Failed to process email:', error)
  }
}

const worker = {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await handleEmail(message, env)
  }
}

export default worker 