import { Hono } from 'hono'
import type { QueueEnv } from '../types'
import health from '../routes/health'
import reports from '../routes/reports'

const app = new Hono<{ Bindings: QueueEnv }>()

app.route('/', health)
app.route('/', reports)

export default {
  async fetch(request: Request, env: QueueEnv, ctx: ExecutionContext): Promise<Response> {
    ;(env as any).__EXECUTION_CTX__ = ctx
    return app.fetch(request, env, ctx)
  }
}

