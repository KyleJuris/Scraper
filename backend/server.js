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
 * 4) write to scrape_results
 * 5) update total_ad_count in scrape_jobs
 * 6) mark scrape_url.checked = true
 */
async function runScrapeJob() {
  console.log('[SCRAPER] Job starting…');

  // 1) Create job
  const { data: jobInsert, error: jobErr } = await supabase
    .from('scrape_jobs')
    .insert([{ /* date_started defaults in DB */ }])
    .select()
    .single();

  if (jobErr) {
    console.error('[SCRAPER] Failed to create job:', jobErr.message);
    return;
  }
  const jobId = jobInsert.id;

  // 2) Fetch URLs to check (you upload them manually)
  const { data: urls, error: urlErr } = await supabase
    .from('scrape_url')
    .select('id, domain, facebook_url, google_url, checked')
    .order('created_at', { ascending: true });

  if (urlErr) {
    console.error('[SCRAPER] Failed to fetch scrape_url:', urlErr.message);
    return;
  }

  if (!urls || urls.length === 0) {
    console.log('[SCRAPER] No URLs found. Finishing job.');
    return;
  }

  let totalAdCount = 0;

  // 3) Playwright browser (single shared browser; one page per URL workflow)
  const { browser, context } = await createBrowser();

  try {
    for (const row of urls) {
      const { id: urlId, domain, facebook_url, google_url } = row;

      // process Google
      if (google_url) {
        const page = await context.newPage();
        const result = await checkGoogle(page, google_url);
        await page.close().catch(() => {});

        totalAdCount += Number(result.ad_count || 0);

        await supabase.from('scrape_results').insert([{
          domain,
          source: 'google',
          job_id: jobId,
          ad_count: result.ad_count || 0,
          status: result.status || 'success'
        }]);
        // jitter between requests
        await wait(500 + Math.floor(Math.random() * 1200));
      }

      // process Facebook
      if (facebook_url) {
        const page = await context.newPage();
        const result = await checkFacebook(page, facebook_url);
        await page.close().catch(() => {});

        totalAdCount += Number(result.ad_count || 0);

        await supabase.from('scrape_results').insert([{
          domain,
          source: 'facebook',
          job_id: jobId,
          ad_count: result.ad_count || 0,
          status: result.status || 'success'
        }]);
        // jitter between requests
        await wait(700 + Math.floor(Math.random() * 1500));
      }

      // Mark URL as checked (doesn't block if one of the sources missing)
      await supabase
        .from('scrape_url')
        .update({ checked: true, updated_at: new Date().toISOString() })
        .eq('id', urlId);
    }
  } catch (err) {
    console.error('[SCRAPER] Unexpected error during run:', err);
  } finally {
    // 5) Update job total count
    await supabase
      .from('scrape_jobs')
      .update({ total_ad_count: totalAdCount })
      .eq('id', jobId);

    await browser.close().catch(() => {});
    console.log('[SCRAPER] Job finished. total_ad_count =', totalAdCount);
  }
}

// Start server, then auto-run job once
app.listen(PORT, async () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
  // Run on startup (no manual input)
  runScrapeJob().catch((e) => console.error('[SCRAPER] Fatal:', e));
});
