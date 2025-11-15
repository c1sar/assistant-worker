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

If the dailyReport has no commits (totalCommits is 0 or commits array is empty), produce a simple message in this format:

Date: <date>

NONE

Otherwise, produce a concise daily report in ENGLISH using this exact structure:

Date: <date>

DONE
[Area] Short, human explanation of what was done and why it matters.
[Area] ...
[Area] ...

IMPACT
Bullet points focused on benefits for patients, doctors, operations, clinic admins or the business.
Avoid technical jargon; speak in terms of user experience, reliability, speed, clarity, automation, etc.

METRICS
Total commits: <totalCommits>
Repositories touched: <repositoriesCount>

Rules and style:

DO NOT mention repository names, branches, SHAs or file names.
Instead, infer and use human-friendly AREA labels based on the repository descriptions.
For example:
epms-api → "Core backend & APIs"
epms-patient-ui → "Patient portal"
epms-web-ui → "Public website"
epms-web-workers → "Automation workers & background tasks"
epms-control-center-ui → "Clinic control center (PCO dashboard)"

Group related commits into a single bullet when they belong to the same feature or area.

Ignore or de-emphasize purely technical commits like:
merge commits (messages starting with "Merge")
chore/ci/refactor-only messages
unless they clearly have a visible business impact.

Use simple, direct language that any manager can understand.

Be concise: usually 3–7 bullets in DONE, 2–4 in IMPACT.

Do NOT invent blockers or next steps; only summarize what actually happened in the data.

Tone toggle:

"Use a slightly friendly but professional tone."

Max length:

"Keep the total report under 250 words."`
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
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
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

