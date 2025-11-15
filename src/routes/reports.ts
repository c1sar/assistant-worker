import { Hono } from 'hono'
import type { QueueEnv } from '../types'
import { validateDate } from '../utils'
import { REPOSITORIES, MAIN_BRANCHES } from '../config'

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

  const { REPORTS_QUEUE } = c.env

  if (!REPORTS_QUEUE) {
    return c.json(
      { error: 'REPORTS_QUEUE not configured' },
      500
    )
  }

  console.log(`Enqueuing report generation jobs for date ${date}...`)

  const totalMainBranches = REPOSITORIES.length * MAIN_BRANCHES.length
  if (c.env.COMMITS_REPORTS) {
    await c.env.COMMITS_REPORTS.put(
      `progress:${date}`,
      JSON.stringify({
        totalBranches: totalMainBranches,
        completedBranches: 0,
        startedAt: new Date().toISOString()
      }),
      { expirationTtl: 3600 }
    )
  }

  for (const repo of REPOSITORIES) {
    for (const branch of MAIN_BRANCHES) {
      await REPORTS_QUEUE.send({
        type: 'FETCH_REPO_BRANCH',
        date,
        repo: repo.name,
        branch
      })
    }

    await REPORTS_QUEUE.send({
      type: 'FETCH_FEATURE_BRANCHES',
      date,
      repo: repo.name
    })
  }

  await REPORTS_QUEUE.send({
    type: 'AGGREGATE_REPORT',
    date
  })

  return c.json({ 
    message: 'Report generation queued',
    date,
    queuedJobs: REPOSITORIES.length * MAIN_BRANCHES.length + REPOSITORIES.length + 1
  })
})

export default reports

