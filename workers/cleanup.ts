interface Env {
  DB: D1Database
}

const CLEANUP_CONFIG = {
  // Whether to delete expired emails
  DELETE_EXPIRED_EMAILS: true,
  
  // Batch processing size
  BATCH_SIZE: 100,
} as const 

const main = {
  async scheduled(_: ScheduledEvent, env: Env) {
    const now = Date.now()

    try {
      if (!CLEANUP_CONFIG.DELETE_EXPIRED_EMAILS) {
        console.log('Expired email deletion is disabled')
        return
      }

      const result = await env.DB
        .prepare(`
          DELETE FROM email 
          WHERE expires_at < ?
          LIMIT ?
        `)
        .bind(now, CLEANUP_CONFIG.BATCH_SIZE)
        .run()

      if (result.success) {
        console.log(`Deleted ${result?.meta?.changes ?? 0} expired emails and their associated messages`)
      } else {
        console.error('Failed to delete expired emails')
      }

      // 清理过期的暂存邮件：无人认领的先收信 / 删后邮件超过 7 天直接丢弃
      const pendingResult = await env.DB
        .prepare(`
          DELETE FROM pending_message
          WHERE expires_at < ?
          LIMIT ?
        `)
        .bind(now, CLEANUP_CONFIG.BATCH_SIZE)
        .run()

      if (pendingResult.success) {
        console.log(`Deleted ${pendingResult?.meta?.changes ?? 0} expired pending messages`)
      } else {
        console.error('Failed to delete expired pending messages')
      }
    } catch (error) {
      console.error('Failed to cleanup:', error)
      throw error
    }
  }
}

export default main
