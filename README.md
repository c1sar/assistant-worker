# Assistant Worker

A Cloudflare Workers application that generates daily commit reports from GitHub repositories using a queue-based architecture.

## Architecture

The application consists of two separate workers:

1. **API Worker** (`c1sar-assistant-api-prd`) - Handles HTTP endpoints and enqueues jobs
2. **Queue Worker** (`c1sar-assistant-queue-prd`) - Processes GitHub API requests asynchronously

This architecture prevents timeout issues by splitting long-running tasks into smaller queue jobs that can complete within Cloudflare's 30-second execution limit.

## Setup

### Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account with Workers enabled
- Cloudflare API token with Workers permissions

### Installation

```bash
pnpm install
```

### Local Development

**Important Note**: Queue consumers don't automatically process messages in `wrangler dev` local mode. This is a known limitation of Cloudflare Workers local development.

**Option 1: Test in Production** (Recommended)
Deploy to Cloudflare and test there - queue processing works automatically in production.

**Option 2: Manual Testing** (Local)
Run both workers:
```bash
# Terminal 1 - API Worker
pnpm run dev:api

# Terminal 2 - Queue Worker  
pnpm run dev:queue
```

Then manually trigger queue processing via the test endpoint:
```bash
# Send a test message to the queue worker
curl -X POST http://localhost:<queue-port>/process-queue \
  -H "Content-Type: application/json" \
  -d '{"type":"FETCH_REPO_BRANCH","date":"2025-11-12","repo":"E-Konsulta-Medical-Clinic/epms-api","branch":"main"}'
```

**Option 3: Use Production Queue** (Advanced)
You can test locally but connect to your production queue by using production credentials.

### Environment Variables

Set these in Cloudflare Dashboard or via `.dev.vars` for local development:

- `GITHUB_TOKEN` - GitHub personal access token
- `GITHUB_USER` - GitHub username
- `OPENAI_API_KEY` - OpenAI API key for generating human-readable reports

### Cloudflare Resources

1. **KV Namespaces** (already configured):
   - `COMMITS_REPORTS` - Stores commit reports
   - `BOT_REPORTS` - Stores AI-generated reports

2. **Queue** (created automatically on first deploy):
   - `reports-queue` - Processes GitHub fetch jobs

### Deployment

Deploy both workers:
```bash
pnpm run deploy
```

Or deploy individually:
```bash
pnpm run deploy:api   # Deploy API worker
pnpm run deploy:queue # Deploy Queue worker
```

The GitHub Actions workflow will automatically:
1. Create the queue if it doesn't exist
2. Deploy both workers

## API Endpoints

- `GET /health` - Health check
- `GET /api/reports/:date` - Get report for a specific date (YYYY-MM-DD)
- `GET /api/reports/bot/:date` - Get AI-generated report for a date
- `POST /api/reports/regenerate/:date` - Queue a report generation job

## How It Works

1. **POST /api/reports/regenerate/:date** enqueues multiple jobs:
   - One job per repository/branch combination
   - One job per repository to check feature branches
   - One aggregation job to combine results

2. **Queue Worker** processes each job:
   - Fetches commits from GitHub API
   - Stores results temporarily in KV
   - Aggregates all commits and generates final report
   - Generates AI report using OpenAI

3. Results are stored in KV and can be retrieved via GET endpoints.

## Type Generation

Generate TypeScript types from Cloudflare configuration:

```bash
pnpm run cf-typegen
```
