import type { Report, Repository } from '../types'
import { REPOSITORIES } from '../config'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

function formatRepositoriesContext(): string {
  return REPOSITORIES.map((repo: Repository) => {
    return `- ${repo.name}: ${repo.description}`
  }).join('\n')
}

function buildPrompt(dailyReport: Report): string {
  const repositoriesContext = formatRepositoriesContext()
  const dailyReportJson = JSON.stringify(dailyReport, null, 2)

  return `You are my daily work summary assistant.

I am a CTO and senior engineer working on a healthcare platform called E-Konsulta.

Your job is to transform raw git activity into a clear, business-friendly daily report
for non-technical stakeholders (operations, management, business).

You will receive:

1) A list of repositories with human descriptions:

${repositoriesContext}

2) A JSON object named "dailyReport" with this shape:

- date: string (YYYY-MM-DD)
- totalCommits: number
- repositories: array of { repository, commitCount }
- commits: array of commits with:
  - date
  - message
  - sha
  - url
  - repository
  - branch
  - author { login, name, email }
  - committer { ... }
  - commitDate
  - authorDate

Here is the JSON for this specific day:

\`\`\`json
${dailyReportJson}
\`\`\`

Your task:

If the dailyReport has no commits (totalCommits is 0 or commits array is empty), produce a simple message in this markdown format:

## Date: <date>

**NONE**

Otherwise, produce a concise daily report in ENGLISH using this exact markdown structure:

## Date: <date>

### DONE
- **[Area]** Short, human explanation of what was done and why it matters.
- **[Area]** ...
- **[Area]** ...

### IMPACT
- List only the app names affected, one per line. Use these exact names:
  - Patient Portal (for epms-patient-ui)
  - Admin Portal (for epms-admin-ui)
  - Backend API (for epms-api)
  - Doctor Portal (for epms-doctor-ui)
  - Public Website (for epms-web-ui)
  - Partner Portal (for epms-partner-ui)
  - Control Center (for epms-control-center-ui)
- Do NOT include explanations or descriptions, only the app names.

### METRICS
- **Total commits:** <totalCommits>
- **Repositories touched:** <repositoriesCount>

Rules and style:

IMPORTANT: Format the entire output using markdown syntax. Use ## for main headings, ### for section headings, - for bullet points, and ** for bold text.

DO NOT mention repository names, branches, SHAs or file names.
Instead, infer and use human-friendly AREA labels based on the repository descriptions.
For example:
epms-api → "Core backend & APIs"
epms-patient-ui → "Patient portal"
epms-web-ui → "Public website"
epms-web-workers → "Automation workers & background tasks"
epms-control-center-ui → "Clinic control center (PCO dashboard)"

CRITICAL: When a commit message contains "Merge" (e.g., "Merge pull request", "Merge branch"), it represents a DEPLOYMENT, not actual work done. In the DONE section, use the word "deploy" or "deployment" instead of describing it as development work. For example, write "**[Area]** Deploy [feature name]" instead of "**[Area]** Implemented [feature name]".

If all commits are merges, treat it as a deployment day and use "deploy" language throughout.

Group related commits into a single bullet when they belong to the same feature or area.

Ignore purely technical commits like:
- merge commits (messages starting with "Merge")
- chore/ci/refactor-only messages
unless they clearly have a visible business impact.

Use simple, direct language that any manager can understand.

Be EXTREMELY concise:
- For 1-2 commits: 1-2 bullets in DONE, 0-1 in IMPACT (or skip IMPACT if only merges)
- For 3-5 commits: 2-3 bullets in DONE, 1-2 in IMPACT
- For 6+ commits: 3-5 bullets in DONE, 2-3 in IMPACT

Scale the report length proportionally to the actual work done. A single merge commit should result in a very brief report (1-2 sentences total).

Do NOT invent blockers or next steps; only summarize what actually happened in the data.

Tone: Use a slightly friendly but professional tone.

Max length: Keep reports under 100 words for 1-2 commits, under 150 words for 3-5 commits, under 200 words for 6+ commits.`
}

export async function generateHumanReadableReport(
  apiKey: string,
  dailyReport: Report
): Promise<string> {
  const prompt = buildPrompt(dailyReport)

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 500
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = (await response.json()) as OpenAIResponse
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content returned from OpenAI API')
  }

  return content
}

