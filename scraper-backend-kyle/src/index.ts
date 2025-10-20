import 'dotenv/config';
import { chromium, Browser } from 'playwright';
import { readInputCsv, writeCsv } from './lib/csv.js';
import { scrapeOne, withRetry, randomDelay } from './lib/scrape.js';
import { createJob, finishJob, insertResult } from './lib/supabase.js';
import { RowInput, ScrapeOutcome, JobSummary } from './types.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Main CLI orchestrator
 */
async function main() {
  console.log('🚀 Starting Ads Scraper (Playwright + Supabase)...\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const inputPath = inputIndex >= 0 && args[inputIndex + 1] ? args[inputIndex + 1] : 'input.csv';
  
  console.log(`📊 Input file: ${inputPath}`);
  
  try {
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
      await finishJob(jobId, 'failed', {
        jobId,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        totalRows: 0,
        successes: 0,
        blocked: 0,
        errors: 0,
        results: [],
      });
      return;
    }
    
    console.log(`✅ Found ${rows.length} rows to process\n`);
    
    // Launch browser
    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles',
      // Load saved session if it exists
      storageState: 'state/facebook-storage.json'
    });
    const page = await context.newPage();
    
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
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

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

// Run the scraper
main().catch(console.error);
