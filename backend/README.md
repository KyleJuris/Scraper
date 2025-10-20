# URL Scraper Backend

A backend service for scraping ad counts from Facebook and Google Ad Libraries using Playwright and Supabase.

## Features

- 🍪 Cookie-based session management for authentication
- 📊 Facebook and Google Ad Library scraping
- 🗄️ Supabase database integration
- 🚀 RESTful API endpoints
- 📈 Real-time scraping statistics
- ⏱️ Human-like delays and jitters to avoid detection
- 🎭 Random user agent rotation
- 🖱️ Simulated human behavior (mouse movements, scrolling)

## Setup

### 1. Environment Variables

Copy `env.example` to `.env.local` and fill in your values:

```bash
cp env.example .env.local
```

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `HEADLESS`: Set to `true` for production, `false` for development
- `TIMEOUT`: Request timeout in milliseconds (default: 30000)

### 2. Cookies Setup

The scraper uses cookies to maintain authenticated sessions. Place your cookie files in the `cookies/` directory:

- `cookies/facebook-cookies.json` - Facebook session cookies
- `cookies/google-cookies.json` - Google session cookies

See the example files for the expected format:
- `cookies/facebook-cookies.example.json`
- `cookies/google-cookies.example.json`

#### How to get cookies:

**Option 1: Using the built-in cookie extractor (Recommended)**

```bash
# Extract Facebook cookies
npm run extract-cookies facebook

# Extract Google cookies  
npm run extract-cookies google
```

This will open a browser window where you can:
1. Log in to the respective platform
2. Navigate to the Ad Library/Transparency Center
3. Press ENTER in the terminal to save cookies

**Option 2: Manual extraction**

1. **Facebook Cookies:**
   - Log into Facebook in your browser
   - Open Developer Tools (F12)
   - Go to Application/Storage tab
   - Copy cookies from `.facebook.com` domain
   - Save as JSON array in `facebook-cookies.json`

2. **Google Cookies:**
   - Log into Google in your browser
   - Open Developer Tools (F12)
   - Go to Application/Storage tab
   - Copy cookies from `.google.com` domain
   - Save as JSON array in `google-cookies.json`

### 3. Database Schema

Make sure your Supabase database has the following tables:

```sql
-- URLs to scrape
create table public.scrape_url (
  id uuid not null default gen_random_uuid (),
  domain text not null,
  facebook_url text null,
  google_url text null,
  stripe_first_detected date null,
  checked boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint scrape_url_pkey primary key (id)
);

-- Scraping jobs
create table public.scrape_jobs (
  id uuid not null default gen_random_uuid (),
  date_started timestamp with time zone null default now(),
  total_ad_count integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint scrape_jobs_pkey primary key (id)
);

-- Individual scrape results
create table public.scrape_results (
  id uuid not null default gen_random_uuid (),
  domain text not null,
  source text null,
  job_id uuid not null,
  ad_count integer null default 0,
  status text null default 'success'::text,
  created_at timestamp with time zone null default now(),
  constraint scrape_results_pkey primary key (id),
  constraint scrape_results_job_id_fkey foreign KEY (job_id) references scrape_jobs (id) on delete CASCADE,
  constraint scrape_results_source_check check (
    (source = any (array['facebook'::text, 'google'::text]))
  ),
  constraint scrape_results_status_check check (
    (status = any (array['success'::text, 'failed'::text, 'blocked'::text, 'error'::text]))
  )
);
```

## Usage

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run scraper manually
npm run scrape
```

### Production

```bash
# Build the project
npm run build

# Start production server
npm start

# Run scraper (built version)
npm run scrape:build
```

## API Endpoints

### Health Check
```
GET /health
```

### Start Scraping
```
POST /api/scrape
```

### Get Unchecked URLs
```
GET /api/urls
```

### Get Recent Jobs
```
GET /api/jobs
```

### Get Recent Results
```
GET /api/results
```

## How It Works

1. **Data Input**: URLs are manually added to the `scrape_url` table in Supabase
2. **Scraping Process**:
   - Creates a new job in `scrape_jobs` table
   - Fetches all unchecked URLs
   - For each URL, scrapes both Facebook and Google Ad Libraries (if URLs provided)
   - Saves results to `scrape_results` table
   - Marks URLs as checked
   - Updates job with total ad count

3. **Session Management**: Uses cookies to maintain authenticated sessions
4. **Anti-Detection Features**:
   - Random delays between requests (3-8 seconds with 40% jitter)
   - Random user agent rotation from a pool of 7 different browsers
   - Random viewport sizes to simulate different devices
   - Human-like mouse movements and scrolling behavior
   - Random delays before element selection (500-1000ms)
5. **Error Handling**: Gracefully handles blocked accounts, login requirements, and network errors

## Deployment on Render

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy as a Web Service
4. The scraper can be triggered via API calls or scheduled jobs

## Troubleshooting

### Common Issues

1. **Login Required**: Update your cookies - they may have expired
2. **Rate Limiting**: Increase delay between requests in `scraper.ts`
3. **Blocked Account**: Use different cookies or wait before retrying
4. **Database Connection**: Verify Supabase credentials and network access

### Logs

The scraper provides detailed console logs for monitoring:
- 🚀 Initialization steps
- 📘 Facebook scraping progress
- 🔍 Google scraping progress
- 📊 Final statistics
- ❌ Error details
