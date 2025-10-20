import 'dotenv/config';
import express from 'express';
import { chromium, Browser } from 'playwright';
import { readInputCsv, writeCsv } from './lib/csv.js';
import { scrapeOne, withRetry, randomDelay, makeContextWithSession, assertSessionHealthy } from './lib/scrape.js';
import { createJob, finishJob, insertResult } from './lib/supabase.js';
import { RowInput, ScrapeOutcome, JobSummary } from './types.js';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/healthz', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

/**
 * Run scraper endpoint
 */
app.post('/run', async (req, res) => {
  console.log('🚀 Starting scraper via HTTP API...\n');
  
  try {
    const { inputPath = 'input.csv' } = req.body;
    
    console.log(`📊 Input file: ${inputPath}`);
    
    // Ensure output directory exists
    await fs.mkdir('output', { recursive: true });
    
    // Create Supabase job
    console.log('📝 Creating Supabase job...');
    const { jobId } = await createJob();
    
    // Read CSV
    console.log('📊 Reading input CSV...');
    const rows = await readInputCsv(inputPath);
    
    if (rows.length === 0) {
      console.log('❌ No data found in CSV file');
      const summary: JobSummary = {
        jobId,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        totalRows: 0,
        successes: 0,
        blocked: 0,
        errors: 0,
        results: [],
      };
      
      await finishJob(jobId, 'failed', summary);
      return res.json(summary);
    }
    
    console.log(`✅ Found ${rows.length} rows to process\n`);
    
    // Launch browser with saved session
    console.log('🌐 Launching browser with saved session...');
    const { browser, context, page } = await makeContextWithSession();
    
    // Test session health by navigating to Facebook Ad Library
    console.log('🔍 Testing session health...');
    await page.goto('https://www.facebook.com/adlibrary', { waitUntil: 'networkidle' });
    await assertSessionHealthy(page);
    console.log('✅ Session is healthy - proceeding with scraping');
    
    const results: ScrapeOutcome[] = [];
    let processedCount = 0;
    
    // Process each row
    for (const row of rows) {
      processedCount++;
      const domain = extractDomainFromRow(row);
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 Processing ${processedCount}/${rows.length}: ${domain}`);
      console.log(`${'='.repeat(60)}`);
      
      const rowResults: ScrapeOutcome[] = [];
      
      // Scrape Facebook if URL exists
      if (row.facebookUrl) {
        console.log(`\n🔵 Facebook Ads:`);
        try {
          const outcome = await withRetry(
            () => scrapeOne(page, 'facebook', row.facebookUrl!),
            { attempts: 2, baseDelayMs: 1500 }
          );
          
          rowResults.push(outcome);
          results.push(outcome);
          
          // Insert to Supabase
          await insertResult(jobId, outcome);
          
          // Random delay
          await randomDelay();
        } catch (error) {
          console.error(`❌ Facebook scrape failed: ${error}`);
          const errorOutcome: ScrapeOutcome = {
            source: 'facebook',
            url: row.facebookUrl!,
            status: 'error',
            count: null,
            message: error instanceof Error ? error.message : 'Unknown error',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 0,
          };
          rowResults.push(errorOutcome);
          results.push(errorOutcome);
          await insertResult(jobId, errorOutcome);
        }
      }
      
      // Scrape Google if URL exists
      if (row.googleUrl) {
        console.log(`\n🔴 Google Ads:`);
        try {
          const outcome = await withRetry(
            () => scrapeOne(page, 'google', row.googleUrl!),
            { attempts: 2, baseDelayMs: 1500 }
          );
          
          rowResults.push(outcome);
          results.push(outcome);
          
          // Insert to Supabase
          await insertResult(jobId, outcome);
          
          // Random delay
          await randomDelay();
        } catch (error) {
          console.error(`❌ Google scrape failed: ${error}`);
          const errorOutcome: ScrapeOutcome = {
            source: 'google',
            url: row.googleUrl!,
            status: 'error',
            count: null,
            message: error instanceof Error ? error.message : 'Unknown error',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 0,
          };
          rowResults.push(errorOutcome);
          results.push(errorOutcome);
          await insertResult(jobId, errorOutcome);
        }
      }
      
      // Row summary
      const successCount = rowResults.filter(r => r.status === 'success').length;
      const totalAds = rowResults.reduce((sum, r) => sum + (r.count || 0), 0);
      
      console.log(`\n📊 Row Summary:`);
      console.log(`   - Successful scrapes: ${successCount}/${rowResults.length}`);
      console.log(`   - Total ads found: ${totalAds}`);
      
      // Delay between rows
      if (processedCount < rows.length) {
        console.log(`\n⏳ Waiting 2 seconds before next row...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Close browser
    await browser.close();
    
    // Calculate summary
    const summary: JobSummary = {
      jobId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totalRows: rows.length,
      successes: results.filter(r => r.status === 'success').length,
      blocked: results.filter(r => r.status === 'blocked').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
    };
    
    // Write output files
    console.log(`\n${'='.repeat(60)}`);
    console.log('💾 Writing output files...');
    console.log(`${'='.repeat(60)}`);
    
    // Write JSON summary
    await fs.writeFile(
      'output/results.json', 
      JSON.stringify(summary, null, 2), 
      'utf-8'
    );
    
    // Write CSV results
    const csvData = results.map(result => ({
      source: result.source,
      url: result.url,
      status: result.status,
      count: result.count,
      message: result.message,
      durationMs: result.durationMs,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
    }));
    
    await writeCsv('output/results.csv', csvData);
    
    // Finish Supabase job
    await finishJob(jobId, 'finished', summary);
    
    // Final summary
    const facebookAds = results.filter(r => r.source === 'facebook').reduce((sum, r) => sum + (r.count || 0), 0);
    const googleAds = results.filter(r => r.source === 'google').reduce((sum, r) => sum + (r.count || 0), 0);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 SCRAPING COMPLETED!');
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Final Summary:`);
    console.log(`   - Job ID: ${jobId}`);
    console.log(`   - Domains processed: ${rows.length}`);
    console.log(`   - Successful scrapes: ${summary.successes}/${results.length}`);
    console.log(`   - Blocked: ${summary.blocked}`);
    console.log(`   - Errors: ${summary.errors}`);
    console.log(`   - Total ads found: ${facebookAds + googleAds}`);
    console.log(`   - Facebook ads: ${facebookAds}`);
    console.log(`   - Google ads: ${googleAds}`);
    console.log(`   - Results saved to: output/results.json`);
    console.log(`   - CSV saved to: output/results.csv`);
    console.log(`   - Screenshots saved to: screenshots/`);
    console.log(`   - Data persisted to Supabase`);
    console.log(`${'='.repeat(60)}\n`);
    
    res.json(summary);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Extract domain from row for display
 */
function extractDomainFromRow(row: RowInput): string {
  if (row.facebookUrl) {
    try {
      return new URL(row.facebookUrl).hostname;
    } catch {
      return 'unknown';
    }
  }
  if (row.googleUrl) {
    try {
      return new URL(row.googleUrl).hostname;
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Health check: GET /healthz`);
  console.log(`   Run scraper: POST /run`);
});
