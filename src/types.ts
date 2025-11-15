export type Env = {
  GITHUB_TOKEN: string
  GITHUB_USER: string
  COMMITS_REPORTS: KVNamespace
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
  }
}

export interface GitHubCompareResponse {
  status: 'identical' | 'behind' | 'ahead' | 'diverged'
  ahead_by: number
  behind_by: number
}

export interface CommitReport {
  date: string
  message: string
  sha: string
  url: string
  repository: string
  branch: string
  author: {
    login: string | null
    name: string
    email: string
  }
  committer: {
    login: string | null
    name: string
    email: string
  }
  commitDate: string
  authorDate: string
}

export interface Repository {
  name: string
  description: string
  stack: string[]
}

export interface Report {
  date: string
  totalCommits: number
  repositories: number
  generatedAt: string
  summary: Array<{
    repository: string
    commitCount: number
  }>
  commits: CommitReport[]
}

