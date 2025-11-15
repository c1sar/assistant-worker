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
  const jsonString = JSON.stringify(report)
  
  // Validate that we're saving valid JSON
  try {
    JSON.parse(jsonString)
  } catch (error) {
    throw new Error(`Failed to serialize report to valid JSON: ${error}`)
  }
  
  // Safety check: ensure we're not accidentally saving markdown/text to COMMITS_REPORTS
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
  
  // Validate that botReport is a string (markdown/text, not JSON)
  if (typeof botReport !== 'string') {
    throw new Error('Bot report must be a string (markdown/text format)')
  }
  
  await kvNamespace.put(kvKey, botReport, {
    expirationTtl: REPORT_TTL_SECONDS
  })
  console.log(`✅ Bot report saved to KV with key: ${kvKey}`)
}

