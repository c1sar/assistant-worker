import { delay, matchesBranchPattern } from '../utils'
import { REPOSITORIES, MAIN_BRANCHES, API_DELAY_MS } from '../config'
import type { GitHubBranch, GitHubCompareResponse, CommitReport } from '../types'

export class GitHubService {
  constructor(
    private githubToken: string,
    private githubUser: string
  ) {}

  private getHeaders() {
    return {
      'User-Agent': 'daily-worker',
      'Authorization': `Bearer ${this.githubToken}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  }

  async fetchBranches(repo: string): Promise<GitHubBranch[]> {
    const url = `https://api.github.com/repos/${repo}/branches`
    
    const res = await fetch(url, {
      headers: this.getHeaders()
    })

    if (!res.ok) {
      console.error(`Failed to fetch branches for ${repo}:`, res.status)
      return []
    }

    return (await res.json()) as GitHubBranch[]
  }

  async isBranchMerged(repo: string, branch: string): Promise<boolean> {
    for (const baseBranch of MAIN_BRANCHES) {
      const url = `https://api.github.com/repos/${repo}/compare/${baseBranch}...${branch}`
      
      const res = await fetch(url, {
        headers: this.getHeaders()
      })

      if (res.ok) {
        const compare = (await res.json()) as GitHubCompareResponse
        if (compare.status === 'behind' || compare.status === 'identical') {
          return true
        }
      }
    }
    
    return false
  }

  async fetchCommitsFromBranch(
    repo: string,
    branch: string,
    date: string
  ): Promise<CommitReport[]> {
    await delay(API_DELAY_MS)
    
    const url = `https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=100`
    
    const res = await fetch(url, {
      headers: this.getHeaders()
    })
    
    if (!res.ok) {
      if (res.status === 403) {
        const rateLimitReset = res.headers.get('x-ratelimit-reset')
        console.error(`Rate limit exceeded for ${repo}/${branch}. Reset at: ${rateLimitReset}`)
        return []
      }
      if (res.status === 404) {
        return []
      }
      console.error(`Error fetching commits from ${repo}/${branch}: ${res.status}`)
      return []
    }
    
    const commits = await res.json() as Array<{
      sha: string
      html_url: string
      commit: {
        message: string
        committer: {
          date: string
          name: string
          email: string
        }
        author: {
          date: string
          name: string
          email: string
        }
      }
      committer: { login: string } | null
      author: { login: string } | null
    }>
    
    const targetDate = date
    const githubUserLower = this.githubUser.toLowerCase()
    
    const filteredCommits = commits.filter((commit) => {
      const commitDate = commit.commit.committer.date.substring(0, 10)
      const committerLogin = commit.committer?.login?.toLowerCase() || commit.commit.committer.name.toLowerCase()
      const authorLogin = commit.author?.login?.toLowerCase() || commit.commit.author.name.toLowerCase()
      
      return commitDate === targetDate && 
             (committerLogin === githubUserLower || authorLogin === githubUserLower)
    })
    
    return filteredCommits.map((commit) => ({
      date: commit.commit.committer.date.substring(0, 10),
      message: commit.commit.message.trim(),
      sha: commit.sha,
      url: commit.html_url,
      repository: repo,
      branch: branch,
      author: {
        login: commit.author?.login || null,
        name: commit.commit.author.name,
        email: commit.commit.author.email
      },
      committer: {
        login: commit.committer?.login || null,
        name: commit.commit.committer.name,
        email: commit.commit.committer.email
      },
      commitDate: commit.commit.committer.date,
      authorDate: commit.commit.author.date
    }))
  }

  async fetchCommitsForDate(date: string): Promise<CommitReport[]> {
    const allCommits: CommitReport[] = []
    
    // Fetch from main branches
    for (const repo of REPOSITORIES) {
      for (const branch of MAIN_BRANCHES) {
        console.log(`Fetching commits from ${repo.name}/${branch}...`)
        
        const commits = await this.fetchCommitsFromBranch(repo.name, branch, date)
        
        if (commits.length > 0) {
          console.log(`Found ${commits.length} commits in ${repo.name}/${branch}`)
        }
        
        allCommits.push(...commits)
      }
    }

    // Check feature branches
    for (const repo of REPOSITORIES) {
      await delay(API_DELAY_MS)
      console.log(`Checking feature branches for ${repo.name}...`)
      
      const branches = await this.fetchBranches(repo.name)
      const featureBranches = branches.filter((b) => 
        b.name !== 'main' && b.name !== 'staging' && matchesBranchPattern(b.name)
      )
      
      console.log(`Found ${featureBranches.length} feature branches for ${repo.name}`)
      
      const unmergedBranches: string[] = []
      
      for (const branch of featureBranches) {
        await delay(API_DELAY_MS)
        
        const merged = await this.isBranchMerged(repo.name, branch.name)
        if (!merged) {
          unmergedBranches.push(branch.name)
        }
      }
      
      console.log(`Found ${unmergedBranches.length} unmerged feature branches for ${repo.name}`)
      
      for (const branch of unmergedBranches) {
        const commits = await this.fetchCommitsFromBranch(repo.name, branch, date)
        
        if (commits.length > 0) {
          console.log(`Found ${commits.length} commits in ${repo.name}/${branch}`)
        }
        
        allCommits.push(...commits)
      }
    }

    // Remove duplicates by SHA
    const uniqueCommits = Array.from(
      new Map(allCommits.map((commit) => [commit.sha, commit])).values()
    )

    return uniqueCommits
  }
}

