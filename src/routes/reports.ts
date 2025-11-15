import { Hono } from 'hono'
import type { QueueEnv } from '../types'
import { validateDate } from '../utils'
import { regenerateReport } from '../services/report'

const reports = new Hono<{ Bindings: QueueEnv }>()

reports.get('/api/reports/:date', async (c) => {
  const date = c.req.param('date')

  if (!validateDate(date)) {
    return c.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, 400)
  }

  if (!c.env.COMMITS_REPORTS) {
    return c.json({ error: 'KV namespace not configured' }, 500)
  }

  const kvKey = `report:${date}`
  const report = await c.env.COMMITS_REPORTS.get(kvKey, 'json')

  if (!report) {
    return c.json({ error: 'Report not found for this date', date }, 404)
  }

  return c.json(report)
})

reports.get('/api/reports/bot/:date', async (c) => {
  const date = c.req.param('date')

  if (!validateDate(date)) {
    return c.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, 400)
  }

  if (!c.env.BOT_REPORTS) {
    return c.json({ error: 'BOT_REPORTS KV namespace not configured' }, 500)
  }

  const kvKey = `report:${date}`
  const botReport = await c.env.BOT_REPORTS.get(kvKey, 'text')

  if (!botReport) {
    return c.json({ error: 'Bot report not found for this date', date }, 404)
  }

  return c.text(botReport)
})

reports.post('/api/reports/regenerate/:date', async (c) => {
  const date = c.req.param('date')

  if (!validateDate(date)) {
    return c.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, 400)
  }

  try {
    const result = await regenerateReport(date, c.env)
    return c.json({ 
      message: 'Report generation queued',
      ...result
    })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to queue report generation' },
      500
    )
  }
})

export default reports

