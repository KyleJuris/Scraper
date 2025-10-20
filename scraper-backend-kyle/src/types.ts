export type RowInput = {
  facebookUrl?: string | null;
  googleUrl?: string | null;
  raw?: Record<string, string>;
};

export type ScrapeSource = 'facebook' | 'google';

export type ScrapeOutcome = {
  source: ScrapeSource;
  url: string;
  status: 'success' | 'blocked' | 'error';
  count: number | null;
  message?: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  screenshotPath?: string;
};

export type JobSummary = {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  totalRows: number;
  successes: number;
  blocked: number;
  errors: number;
  results: ScrapeOutcome[];
};

export type ScrapeJob = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'finished' | 'failed';
  summary: JobSummary | null;
};

export type ScrapeResult = {
  id: string;
  job_id: string;
  source: ScrapeSource;
  url: string;
  status: 'success' | 'blocked' | 'error';
  count: number | null;
  message: string | null;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  screenshot_path: string | null;
  created_at: string;
};
