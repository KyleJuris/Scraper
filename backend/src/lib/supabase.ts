import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface ScrapeUrl {
  id: string;
  domain: string;
  facebook_url: string | null;
  google_url: string | null;
  stripe_first_detected: string | null;
  checked: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ScrapeJob {
  id: string;
  date_started: string | null;
  total_ad_count: number | null;
  created_at: string | null;
}

export interface ScrapeResult {
  id: string;
  domain: string;
  source: 'facebook' | 'google' | null;
  job_id: string;
  ad_count: number | null;
  status: 'success' | 'failed' | 'blocked' | 'error' | null;
  created_at: string | null;
}

// Database operations
export class DatabaseService {
  // Get all unchecked URLs
  static async getUncheckedUrls(): Promise<ScrapeUrl[]> {
    const { data, error } = await supabase
      .from('scrape_url')
      .select('*')
      .eq('checked', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching unchecked URLs:', error);
      throw error;
    }

    return data || [];
  }

  // Create a new scrape job
  static async createScrapeJob(): Promise<ScrapeJob> {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .insert({
        date_started: new Date().toISOString(),
        total_ad_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scrape job:', error);
      throw error;
    }

    return data;
  }

  // Update scrape job with total count
  static async updateScrapeJob(jobId: string, totalAdCount: number): Promise<void> {
    const { error } = await supabase
      .from('scrape_jobs')
      .update({ total_ad_count: totalAdCount })
      .eq('id', jobId);

    if (error) {
      console.error('Error updating scrape job:', error);
      throw error;
    }
  }

  // Create scrape result
  static async createScrapeResult(
    domain: string,
    source: 'facebook' | 'google',
    jobId: string,
    adCount: number | null,
    status: 'success' | 'failed' | 'blocked' | 'error' = 'success'
  ): Promise<ScrapeResult> {
    const { data, error } = await supabase
      .from('scrape_results')
      .insert({
        domain,
        source,
        job_id: jobId,
        ad_count: adCount,
        status
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scrape result:', error);
      throw error;
    }

    return data;
  }

  // Mark URL as checked
  static async markUrlAsChecked(urlId: string): Promise<void> {
    const { error } = await supabase
      .from('scrape_url')
      .update({ 
        checked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', urlId);

    if (error) {
      console.error('Error marking URL as checked:', error);
      throw error;
    }
  }
}

