import { Hono } from 'hono'
import type { Env } from '../types'
import { validateDate } from '../utils'
import { GitHubService } from '../services/github'
import { generateReport, logReport, saveReport, saveBotReport } from '../services/report'
import { generateHumanReadableReport } from '../services/openai'

const reports = new Hono<{ Bindings: Env }>()

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

  const { GITHUB_TOKEN, GITHUB_USER, OPENAI_API_KEY, COMMITS_REPORTS, BOT_REPORTS } = c.env

  if (!GITHUB_TOKEN || !GITHUB_USER) {
    return c.json(
      { error: 'GITHUB_TOKEN and GITHUB_USER must be configured' },
      500
    )
  }

  if (!OPENAI_API_KEY) {
    return c.json(
      { error: 'OPENAI_API_KEY must be configured' },
      500
    )
  }

  console.log(`Starting commit fetch for date ${date}...`)

  const githubService = new GitHubService(GITHUB_TOKEN, GITHUB_USER)

  const backgroundTask = githubService.fetchCommitsForDate(date)
    .then(async (commits) => {
      const report = generateReport(date, commits)
      logReport(date, report)

      if (COMMITS_REPORTS) {
        await saveReport(COMMITS_REPORTS, date, report)
      } else {
        console.warn('⚠️  KV namespace not configured, report not saved')
      }

      if (BOT_REPORTS && OPENAI_API_KEY) {
        try {
          console.log(`Generating human-readable report for date ${date}...`)
          const botReport = await generateHumanReadableReport(OPENAI_API_KEY, report)
          
          if (BOT_REPORTS) {
            await saveBotReport(BOT_REPORTS, date, botReport)
          } else {
            console.warn('⚠️  BOT_REPORTS KV namespace not configured, bot report not saved')
          }
        } catch (error) {
          console.error('Error generating bot report:', error)
        }
      }
    })
    .catch((error) => {
      console.error('Error fetching commits:', error)
    })

  const executionCtx = (c.env as any).__EXECUTION_CTX__ || (c as any).executionCtx
  if (executionCtx?.waitUntil) {
    executionCtx.waitUntil(backgroundTask)
  } else {
    backgroundTask.catch(() => {})
  }

  return c.text('ok')
})

export default reports

