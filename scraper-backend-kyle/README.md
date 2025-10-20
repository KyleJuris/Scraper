# Ads Scraper (Playwright + Supabase)

A robust TypeScript-based scraping project that reads CSV files containing Facebook and Google ad transparency URLs, extracts ad counts, and persists results to Supabase. Built with Playwright for reliable web scraping and designed for Render deployment.

## Features

- **Flexible CSV parsing** - Automatically detects Facebook/Google URL columns
- **Robust ad count extraction** - Uses DOM selectors + regex fallbacks
- **Supabase integration** - Always persists results to database
- **Anti-flakiness measures** - Retries, delays, consent wall detection
- **Render-ready** - Works as Worker or Web Service
- **Comprehensive logging** - Screenshots and detailed output
- **TypeScript** - Full type safety and modern development experience

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
npx playwright install --with-deps
```

### 2. Environment Setup

Create a `.env` file with your Supabase credentials:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Setup

Run the Supabase migration to create the required tables:

```sql
-- Run the contents of supabase/migrations/0001_init.sql in your Supabase SQL editor
```

### 4. Prepare Input CSV

Create an `input.csv` file with Facebook and/or Google URLs. The scraper automatically detects columns containing "facebook", "fb", or "google":

```csv
Domain,FB library,Google library
example.com,https://www.facebook.com/ads/library/?q=example.com,https://adstransparency.google.com/?domain=example.com
```

### 5. Run the Scraper

**CLI Mode:**
```bash
pnpm scrape -- --input input.csv
```

**Server Mode:**
```bash
pnpm dev
# Then POST to http://localhost:3000/run
```

## Project Structure

```
├── src/
│   ├── index.ts          # CLI orchestrator
│   ├── server.ts         # HTTP server
│   ├── types.ts          # TypeScript definitions
│   └── lib/
│       ├── csv.ts        # CSV parsing utilities
│       ├── parsers.ts    # Ad count extraction
│       ├── supabase.ts   # Database operations
│       └── scrape.ts     # Core scraping logic
├── supabase/
│   └── migrations/
│       └── 0001_init.sql # Database schema
├── output/               # Generated files
├── screenshots/          # Debug screenshots
└── dist/                 # Compiled JavaScript
```

## CSV Format

The scraper automatically detects URL columns by header names:

- **Facebook URLs**: Headers containing "facebook" or "fb"
- **Google URLs**: Headers containing "google"

Example:
```csv
Root Domain,FB library,Google library,Company
example.com,https://www.facebook.com/ads/library/?q=example.com,https://adstransparency.google.com/?domain=example.com,Example Corp
```

## Ad Count Detection

### Facebook Ads Library
- **Primary**: DOM selectors for headings with `role="heading"` or `aria-level="3"`
- **Fallback**: Regex pattern `(~?\s*[\d,]+)\s+results`
- **Example**: "~2,300 results" → 2300

### Google Ads Transparency
- **Primary**: DOM selectors for elements with `ads-count` classes
- **Fallback**: Regex pattern `([\d,]+)\s+ads`
- **Example**: "7 ads" → 7

## Output Files

### Local Files
- `output/results.json` - Complete job summary with all results
- `output/results.csv` - Tabular results for analysis
- `screenshots/` - Debug screenshots for each scrape

### Supabase Tables

**scrape_jobs**
- `id`, `started_at`, `finished_at`, `status`, `summary`

**scrape_results**
- `id`, `job_id`, `source`, `url`, `status`, `count`, `message`, `started_at`, `finished_at`, `duration_ms`, `screenshot_path`, `created_at`

## API Endpoints

### Health Check
```bash
GET /healthz
# Returns: { "ok": true, "timestamp": "..." }
```

### Run Scraper
```bash
POST /run
Content-Type: application/json

{
  "inputPath": "input.csv"  # optional, defaults to input.csv
}

# Returns: JobSummary object
```

## Render Deployment

### As a Worker (CLI)
```yaml
# render.yaml
services:
  - type: worker
    name: ads-scraper-worker
    env: node
    buildCommand: pnpm install && npx playwright install --with-deps && pnpm build
    startCommand: pnpm scrape -- --input input.csv
    envVars:
      - key: SUPABASE_URL
        value: your_supabase_url
      - key: SUPABASE_SERVICE_ROLE_KEY
        value: your_service_role_key
```

### As a Web Service
```yaml
# render.yaml
services:
  - type: web
    name: ads-scraper-api
    env: node
    buildCommand: pnpm install && npx playwright install --with-deps && pnpm build
    startCommand: pnpm start
    envVars:
      - key: SUPABASE_URL
        value: your_supabase_url
      - key: SUPABASE_SERVICE_ROLE_KEY
        value: your_service_role_key
```

## Anti-Flakiness Features

- **Consent wall detection** - Automatically detects and handles login/consent pages
- **Retry logic** - Exponential backoff for failed requests
- **Random delays** - Prevents rate limiting
- **Screenshots** - Debug images for troubleshooting
- **Network idle waiting** - Ensures pages are fully loaded

## Error Handling

The scraper handles various error conditions gracefully:

- **Consent walls** - Status: `blocked`, Message: "Consent/login wall detected"
- **Network errors** - Status: `error`, Message: Error details
- **Parse failures** - Status: `success`, Count: `null`, Message: "No ads count found"

## Development

```bash
# Type checking
pnpm typecheck

# Development server
pnpm dev

# Build for production
pnpm build

# Run tests (when implemented)
pnpm test:pw
```

## Troubleshooting

1. **Screenshots** - Check `screenshots/` folder for visual debugging
2. **Logs** - Detailed console output shows each step
3. **Supabase** - Verify database connection and table schema
4. **Playwright** - Ensure browser dependencies are installed

## License

MIT


