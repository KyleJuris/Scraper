import { createClient } from '@supabase/supabase-js';
import { ScrapeJob, ScrapeResult, ScrapeOutcome, JobSummary } from '../types.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Create a new scrape job
 */
export async function createJob(): Promise<{ jobId: string }> {
  try {
    const startedAt = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('scrape_jobs')
      .insert({
        started_at: startedAt,
        status: 'running',
        summary: null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to create job:', error);
      throw new Error(`Failed to create job: ${error.message}`);
    }

    console.log(`✅ Created job: ${data.id}`);
    return { jobId: data.id };
  } catch (error) {
    console.error('❌ Error creating job:', error);
    throw error;
  }
}

/**
 * Finish a scrape job with summary
 */
export async function finishJob(jobId: string, status: 'finished' | 'failed', summary: JobSummary): Promise<void> {
  try {
    const finishedAt = new Date().toISOString();
    
    const { error } = await supabase
      .from('scrape_jobs')
      .update({
        finished_at: finishedAt,
        status,
        summary,
      })
      .eq('id', jobId);

    if (error) {
      console.error('❌ Failed to finish job:', error);
      throw new Error(`Failed to finish job: ${error.message}`);
    }

    console.log(`✅ Finished job: ${jobId} (${status})`);
  } catch (error) {
    console.error('❌ Error finishing job:', error);
    throw error;
  }
}

/**
 * Insert a scrape result
 */
export async function insertResult(jobId: string, outcome: ScrapeOutcome): Promise<void> {
  try {
    const result: Omit<ScrapeResult, 'id' | 'created_at'> = {
      job_id: jobId,
      source: outcome.source,
      url: outcome.url,
      status: outcome.status,
      count: outcome.count,
      message: outcome.message || null,
      started_at: outcome.startedAt,
      finished_at: outcome.finishedAt,
      duration_ms: outcome.durationMs,
      screenshot_path: outcome.screenshotPath || null,
    };

    const { error } = await supabase
      .from('scrape_results')
      .insert(result);

    if (error) {
      console.error('❌ Failed to insert result:', error);
      throw new Error(`Failed to insert result: ${error.message}`);
    }

    console.log(`✅ Inserted result for ${outcome.source}: ${outcome.url} (${outcome.status})`);
  } catch (error) {
    console.error('❌ Error inserting result:', error);
    throw error;
  }
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<ScrapeJob | null> {
  try {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('❌ Failed to get job:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error getting job:', error);
    return null;
  }
}

/**
 * Get results for a job
 */
export async function getJobResults(jobId: string): Promise<ScrapeResult[]> {
  try {
    const { data, error } = await supabase
      .from('scrape_results')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Failed to get job results:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error getting job results:', error);
    return [];
  }
}


