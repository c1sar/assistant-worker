import type { CommitReport, Report, QueueEnv } from '../types'
import { REPORT_TTL_SECONDS, REPOSITORIES, MAIN_BRANCHES } from '../config'

export function generateReport(date: string, commits: CommitReport[]): Report {
  const commitsByRepo: Record<string, CommitReport[]> = {}
  
  commits.forEach((commit) => {
    if (!commitsByRepo[commit.repository]) {
      commitsByRepo[commit.repository] = []
    }
    commitsByRepo[commit.repository].push(commit)
  })

  const sortedCommits = commits.sort((a, b) => {
    if (a.repository !== b.repository) {
      return a.repository.localeCompare(b.repository)
    }
    return a.commitDate.localeCompare(b.commitDate)
  })

  return {
    date,
    totalCommits: commits.length,
    repositories: Object.keys(commitsByRepo).length,
    generatedAt: new Date().toISOString(),
    summary: Object.entries(commitsByRepo).map(([repo, repoCommits]) => ({
      repository: repo,
      commitCount: repoCommits.length
    })),
    commits: sortedCommits
  }
}

export function logReport(date: string, report: Report): void {
  console.log(`\n=== Found ${report.totalCommits} commits for date ${date} ===`)
  console.log(`Repositories: ${report.repositories}`)
  
  report.summary.forEach(({ repository, commitCount }) => {
    console.log(`  ${repository}: ${commitCount} commits`)
  })
  
  report.commits.forEach((commit) => {
    console.log(`[${commit.repository}/${commit.branch}] ${commit.message}`)
  })
  
  console.log(`=== End of commits for date ${date} ===\n`)
}

export async function saveReport(
  kvNamespace: KVNamespace,
  date: string,
  report: Report
): Promise<void> {
  const kvKey = `report:${date}`
  const jsonString = JSON.stringify(report)
  
  // Validate that we're saving valid JSON
  try {
    JSON.parse(jsonString)
  } catch (error) {
    throw new Error(`Failed to serialize report to valid JSON: ${error}`)
  }
  
  if (jsonString.includes('**Date:**') || jsonString.includes('**DONE**') || jsonString.includes('**IMPACT**')) {
    throw new Error('Attempted to save markdown/text to COMMITS_REPORTS. This should only contain JSON data.')
  }
  
  await kvNamespace.put(kvKey, jsonString, {
    expirationTtl: REPORT_TTL_SECONDS
  })
  console.log(`✅ Report saved to KV with key: ${kvKey}`)
}

export async function saveBotReport(
  kvNamespace: KVNamespace,
  date: string,
  botReport: string
): Promise<void> {
  const kvKey = `report:${date}`
  
  if (typeof botReport !== 'string') {
    throw new Error('Bot report must be a string (markdown/text format)')
  }
  
  await kvNamespace.put(kvKey, botReport, {
    expirationTtl: REPORT_TTL_SECONDS
  })
  console.log(`✅ Bot report saved to KV with key: ${kvKey}`)
}

export async function regenerateReport(
  date: string,
  env: QueueEnv
): Promise<{ date: string; queuedJobs: number }> {
  const { REPORTS_QUEUE } = env

  if (!REPORTS_QUEUE) {
    throw new Error('REPORTS_QUEUE not configured')
  }

  console.log(`Enqueuing report generation jobs for date ${date}...`)

  const totalMainBranches = REPOSITORIES.length * MAIN_BRANCHES.length
  if (env.COMMITS_REPORTS) {
    await env.COMMITS_REPORTS.put(
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

  return {
    date,
    queuedJobs: REPOSITORIES.length * MAIN_BRANCHES.length + REPOSITORIES.length + 1
  }
}

