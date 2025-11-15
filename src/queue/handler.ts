import type { QueueMessage, QueueEnv, CommitReport } from '../types'
import { GitHubService } from '../services/github'
import { generateReport, saveReport, saveBotReport } from '../services/report'
import { generateHumanReadableReport } from '../services/openai'
import { REPOSITORIES, MAIN_BRANCHES } from '../config'

interface ProgressTracker {
  totalBranches: number
  completedBranches: number
  startedAt: string
}

export async function processQueueMessage(
  message: QueueMessage,
  env: QueueEnv,
  ctx: ExecutionContext
): Promise<void> {
  const { GITHUB_TOKEN, GITHUB_USER, OPENAI_API_KEY, COMMITS_REPORTS, BOT_REPORTS, REPORTS_QUEUE } = env

  if (!GITHUB_TOKEN || !GITHUB_USER) {
    throw new Error('GITHUB_TOKEN and GITHUB_USER must be configured')
  }

  if (!COMMITS_REPORTS) {
    throw new Error('COMMITS_REPORTS KV namespace not configured')
  }

  const githubService = new GitHubService(GITHUB_TOKEN, GITHUB_USER)

  switch (message.type) {
    case 'FETCH_REPO_BRANCH': {
      console.log(`Fetching commits from ${message.repo}/${message.branch} for date ${message.date}...`)
      
      const commits = await githubService.fetchCommitsFromBranch(
        message.repo,
        message.branch,
        message.date
      )

      if (commits.length > 0) {
        console.log(`Found ${commits.length} commits in ${message.repo}/${message.branch}`)
      }

      const tempKey = `temp:${message.date}:${message.repo}:${message.branch}`
      await COMMITS_REPORTS.put(tempKey, JSON.stringify(commits), {
        expirationTtl: 3600 // 1 hour TTL for temp data
      })

      await updateProgress(message.date, COMMITS_REPORTS, REPORTS_QUEUE)
      break
    }

    case 'FETCH_FEATURE_BRANCHES': {
      console.log(`Checking feature branches for ${message.repo}...`)
      
      const branches = await githubService.fetchBranches(message.repo)
      const featureBranches = branches.filter((b) => 
        b.name !== 'main' && b.name !== 'staging' && 
        (b.name.startsWith('feat/') || b.name.startsWith('fix/') || b.name.startsWith('task/'))
      )

      console.log(`Found ${featureBranches.length} feature branches for ${message.repo}`)

      // Check which branches are unmerged
      const unmergedBranches: string[] = []
      for (const branch of featureBranches) {
        const merged = await githubService.isBranchMerged(message.repo, branch.name)
        if (!merged) {
          unmergedBranches.push(branch.name)
        }
      }

      console.log(`Found ${unmergedBranches.length} unmerged feature branches for ${message.repo}`)

      const progressKey = `progress:${message.date}`
      const progressJson = await COMMITS_REPORTS.get(progressKey, 'json') as ProgressTracker | null
      if (progressJson) {
        progressJson.totalBranches += unmergedBranches.length
        await COMMITS_REPORTS.put(progressKey, JSON.stringify(progressJson), {
          expirationTtl: 3600
        })
      }

      if (REPORTS_QUEUE) {
        for (const branch of unmergedBranches) {
          await REPORTS_QUEUE.send({
            type: 'FETCH_REPO_BRANCH',
            date: message.date,
            repo: message.repo,
            branch
          })
        }
      }
      break
    }

    case 'AGGREGATE_REPORT': {
      console.log(`Aggregating report for date ${message.date}...`)

      await new Promise(resolve => setTimeout(resolve, 5000))

      const allCommits: CommitReport[] = []

      for (const repo of REPOSITORIES) {
        for (const branch of MAIN_BRANCHES) {
          const tempKey = `temp:${message.date}:${repo.name}:${branch}`
          const commitsJson = await COMMITS_REPORTS.get(tempKey, 'json') as CommitReport[] | null
          if (commitsJson) {
            allCommits.push(...commitsJson)
            await COMMITS_REPORTS.delete(tempKey)
          }
        }

        try {
          const branches = await githubService.fetchBranches(repo.name)
          const featureBranches = branches.filter((b) => 
            b.name !== 'main' && b.name !== 'staging' && 
            (b.name.startsWith('feat/') || b.name.startsWith('fix/') || b.name.startsWith('task/'))
          )

          for (const branch of featureBranches) {
            const tempKey = `temp:${message.date}:${repo.name}:${branch.name}`
            const commitsJson = await COMMITS_REPORTS.get(tempKey, 'json') as CommitReport[] | null
            if (commitsJson) {
              allCommits.push(...commitsJson)
              await COMMITS_REPORTS.delete(tempKey)
            }
          }
        } catch (error) {
          console.error(`Error fetching branches for ${repo.name}:`, error)
        }
      }

      const uniqueCommits = Array.from(
        new Map(allCommits.map((commit) => [commit.sha, commit])).values()
      )

      const report = generateReport(message.date, uniqueCommits)
      console.log(`Generated report with ${report.totalCommits} commits`)

      await saveReport(COMMITS_REPORTS, message.date, report)

      await COMMITS_REPORTS.delete(`progress:${message.date}`)

      if (BOT_REPORTS && OPENAI_API_KEY) {
        try {
          console.log(`Generating human-readable report for date ${message.date}...`)
          const botReport = await generateHumanReadableReport(OPENAI_API_KEY, report)
          await saveBotReport(BOT_REPORTS, message.date, botReport)
        } catch (error) {
          console.error('Error generating bot report:', error)
        }
      }

      break
    }
  }
}

async function updateProgress(
  date: string,
  kv: KVNamespace,
  queue: Queue<QueueMessage> | undefined
): Promise<void> {
  const progressKey = `progress:${date}`
  const progressJson = await kv.get(progressKey, 'json') as ProgressTracker | null

  if (progressJson) {
    progressJson.completedBranches += 1
    await kv.put(progressKey, JSON.stringify(progressJson), {
      expirationTtl: 3600
    })
  }
}

