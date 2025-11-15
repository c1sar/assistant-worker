import { Hono } from 'hono'
import type { QueueEnv } from '../types'

const health = new Hono<{ Bindings: QueueEnv }>()

health.get('/health', (c) => {
  return c.text('ok')
})

export default health

