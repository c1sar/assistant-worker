import type { CommitReport, Report } from '../types'
import { REPORT_TTL_SECONDS } from '../config'

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
  await kvNamespace.put(kvKey, JSON.stringify(report), {
    expirationTtl: REPORT_TTL_SECONDS
  })
  console.log(`✅ Report saved to KV with key: ${kvKey}`)
}

