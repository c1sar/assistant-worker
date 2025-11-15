import { Hono } from 'hono'
import type { Env } from '../types'

const health = new Hono<{ Bindings: Env }>()

health.get('/health', (c) => {
  return c.text('ok')
})

export default health

