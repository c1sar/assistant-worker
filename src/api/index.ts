import { Hono } from 'hono'
import type { QueueEnv } from '../types'
import health from '../routes/health'
import reports from '../routes/reports'
import { regenerateReport } from '../services/report'
import { validateDate } from '../utils'

const app = new Hono<{ Bindings: QueueEnv }>()

app.route('/', health)
app.route('/', reports)

export default {
  async fetch(request: Request, env: QueueEnv, ctx: ExecutionContext): Promise<Response> {
    ;(env as any).__EXECUTION_CTX__ = ctx
    return app.fetch(request, env, ctx)
  },

  async scheduled(event: ScheduledEvent, env: QueueEnv, ctx: ExecutionContext): Promise<void> {
    const today = new Date()
    const date = today.toISOString().split('T')[0]
  
    if (!validateDate(date)) {
      console.error(`Invalid date format generated: ${date}`)
      return
    }

    console.log(`🕐 Cron trigger fired at ${new Date(event.scheduledTime).toISOString()}`)
    console.log(`📅 Generating report for date: ${date}`)

    try {
      const result = await regenerateReport(date, env)
      console.log(`✅ Successfully queued report generation for ${date}: ${result.queuedJobs} jobs`)
    } catch (error) {
      console.error(`❌ Error queuing report generation for ${date}:`, error)
    }
  }
}
