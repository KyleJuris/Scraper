const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Database operations
class DatabaseService {
  // Get all unchecked URLs
  static async getUncheckedUrls() {
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
  static async createScrapeJob() {
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
  static async updateScrapeJob(jobId, totalAdCount) {
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
    domain,
    source,
    jobId,
    adCount,
    status = 'success'
  ) {
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
  static async markUrlAsChecked(urlId) {
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

module.exports = {
  supabase,
  DatabaseService
};
