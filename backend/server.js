const express = require('express');
const scraperRoutes = require('./routes/scraper');
const supabase = require('./lib/supabaseClient');
const { createBrowser } = require('./lib/browser');
const checkGoogle = require('./controllers/checkGoogle');
const checkFacebook = require('./controllers/checkFacebook');

const app = express();
app.use(express.json());

// mount (kept minimal; auto-run happens below)
app.use('/api/scraper', scraperRoutes);

const PORT = process.env.PORT || 3000;

/** Utility: small wait */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Main job runner
 * 1) create scrape_jobs row
 * 2) fetch rows from scrape_url
 * 3) visit each url (facebook/google) → extract ad_count
 * 4) write to scrape_results (ALWAYS two rows per domain: google + facebook)
 * 5) update total_ad_count in scrape_jobs
 * 6) mark scrape_url.checked = true
 */
async function runScrapeJob() {
  console.log('[SCRAPER] 🚀 Starting new scrape job...');

  // 1) Create job
  console.log('[SCRAPER] Creating job record in scrape_jobs...');
  const { data: jobInsert, error: jobErr } = await supabase
    .from('scrape_jobs')
    .insert([{}])
    .select()
    .single();

  if (jobErr) {
    console.error('[SCRAPER] ❌ Failed to create job:', jobErr.message);
    return;
  }

  const jobId = jobInsert.id;
  console.log(`[SCRAPER] ✅ Job created with ID: ${jobId}`);

  // 2) Fetch URLs
  console.log('[SCRAPER] Fetching scrape_url entries...');
  const { data: urls, error: urlErr } = await supabase
    .from('scrape_url')
    .select('id, domain, facebook_url, google_url, checked')
    .order('created_at', { ascending: true });

  if (urlErr) {
    console.error('[SCRAPER] ❌ Failed to fetch scrape_url:', urlErr.message);
    return;
  }

  if (!urls || urls.length === 0) {
    console.log('[SCRAPER] ⚠️ No URLs found. Finishing job.');
    return;
  }

  console.log(`[SCRAPER] Found ${urls.length} URLs to process.`);
  let totalAdCount = 0;

  // 3) Launch browser
  console.log('[SCRAPER] Launching Playwright browser...');
  const { browser, context } = await createBrowser();

  try {
    for (const [index, row] of urls.entries()) {
      console.log(`\n[SCRAPER] 🕵️ Processing ${index + 1}/${urls.length}: ${row.domain}`);

      const { id: urlId, domain } = row;
      const fbUrl = (row.facebook_url || '').trim();
      const gUrl  = (row.google_url || '').trim();

      // ---- GOOGLE ----
      if (gUrl.length > 0) {
        console.log(`[SCRAPER][Google] Visiting ${gUrl}`);
        const page = await context.newPage();
        const result = await checkGoogle(page, gUrl);
        await page.close().catch(() => {});
        console.log(`[SCRAPER][Google] Result for ${domain}:`, result);

        totalAdCount += Number(result.ad_count || 0);

        await supabase.from('scrape_results').insert([{
          domain,
          source: 'google',
          job_id: jobId,
          ad_count: result.ad_count || 0,
          status: result.status // DO NOT default to success
        }]);
      } else {
        console.log(`[SCRAPER][Google] Missing URL for ${domain} → inserting placeholder failed row`);
        await supabase.from('scrape_results').insert([{
          domain,
          source: 'google',
          job_id: jobId,
          ad_count: 0,
          status: 'failed'
        }]);
      }

      // ---- FACEBOOK ----
      if (fbUrl.length > 0) {
        console.log(`[SCRAPER][Facebook] Visiting ${fbUrl}`);
        const page = await context.newPage();
        const result = await checkFacebook(page, fbUrl);
        await page.close().catch(() => {});
        console.log(`[SCRAPER][Facebook] Result for ${domain}:`, result);

        totalAdCount += Number(result.ad_count || 0);

        await supabase.from('scrape_results').insert([{
          domain,
          source: 'facebook',
          job_id: jobId,
          ad_count: result.ad_count || 0,
          status: result.status // DO NOT default to success
        }]);
      } else {
        console.log(`[SCRAPER][Facebook] Missing URL for ${domain} → inserting placeholder failed row`);
        await supabase.from('scrape_results').insert([{
          domain,
          source: 'facebook',
          job_id: jobId,
          ad_count: 0,
          status: 'failed'
        }]);
      }

      // Mark URL checked
      await supabase
        .from('scrape_url')
        .update({ checked: true, updated_at: new Date().toISOString() })
        .eq('id', urlId);

      console.log(`[SCRAPER] ✅ Finished ${domain}`);
    }
  } catch (err) {
    console.error('[SCRAPER] 💥 Unexpected error during run:', err);
  } finally {
    console.log(`[SCRAPER] 🧮 Updating total_ad_count: ${totalAdCount}`);
    await supabase
      .from('scrape_jobs')
      .update({ total_ad_count: totalAdCount })
      .eq('id', jobId);

    await browser.close().catch(() => {});
    console.log('[SCRAPER] ✅ Job completed and browser closed.');
  }
}

// Start server, then auto-run job once
app.listen(PORT, async () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
  // Run on startup (no manual input)
  runScrapeJob().catch((e) => console.error('[SCRAPER] Fatal:', e));
});
