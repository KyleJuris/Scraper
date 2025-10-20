-- Create scrape_jobs table
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'finished', 'failed')),
    summary JSONB
);

-- Create scrape_results table
CREATE TABLE IF NOT EXISTS scrape_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('facebook', 'google')),
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'blocked', 'error')),
    count INTEGER,
    message TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL,
    screenshot_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_started_at ON scrape_jobs(started_at);
CREATE INDEX IF NOT EXISTS idx_scrape_results_job_id ON scrape_results(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_results_source ON scrape_results(source);
CREATE INDEX IF NOT EXISTS idx_scrape_results_status ON scrape_results(status);
CREATE INDEX IF NOT EXISTS idx_scrape_results_created_at ON scrape_results(created_at);

-- Enable Row Level Security (RLS) - optional but recommended
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_results ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (adjust as needed for your security requirements)
CREATE POLICY "Service role can do everything" ON scrape_jobs
    FOR ALL USING (true);

CREATE POLICY "Service role can do everything" ON scrape_results
    FOR ALL USING (true);


