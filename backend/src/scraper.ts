import { DatabaseService, ScrapeUrl } from './lib/supabase.js';
import { FacebookChecker } from './lib/checkFacebook.js';
import { GoogleChecker } from './lib/checkGoogle.js';
import dotenv from 'dotenv';

dotenv.config();

// Utility functions for delays and jitters
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomJitter(baseDelay: number, jitterPercent: number = 0.3): number {
  const jitter = baseDelay * jitterPercent;
  return baseDelay + randomDelay(-jitter, jitter);
}

async function humanDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const delay = randomJitter(randomDelay(min, max));
  await new Promise(resolve => setTimeout(resolve, delay));
}

export interface ScrapeStats {
  totalUrls: number;
  processedUrls: number;
  facebookSuccess: number;
  facebookFailed: number;
  googleSuccess: number;
  googleFailed: number;
  totalAdCount: number;
}

export class ScraperService {
  private facebookChecker: FacebookChecker;
  private googleChecker: GoogleChecker;
  private stats: ScrapeStats;

  constructor() {
    this.facebookChecker = new FacebookChecker();
    this.googleChecker = new GoogleChecker();
    this.stats = {
      totalUrls: 0,
      processedUrls: 0,
      facebookSuccess: 0,
      facebookFailed: 0,
      googleSuccess: 0,
      googleFailed: 0,
      totalAdCount: 0
    };
  }

  async runScrape(): Promise<void> {
    console.log('🚀 Starting scraper service...');
    
    try {
      // Initialize checkers
      await this.facebookChecker.initialize();
      await this.googleChecker.initialize();

      // Get unchecked URLs from database
      const urls = await DatabaseService.getUncheckedUrls();
      this.stats.totalUrls = urls.length;

      if (urls.length === 0) {
        console.log('📭 No unchecked URLs found');
        return;
      }

      console.log(`📊 Found ${urls.length} URLs to process`);

      // Create scrape job
      const job = await DatabaseService.createScrapeJob();
      console.log(`📝 Created scrape job: ${job.id}`);

      // Process each URL
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        await this.processUrl(url, job.id);
        this.stats.processedUrls++;
        
        // Mark URL as checked
        await DatabaseService.markUrlAsChecked(url.id);
        
        // Add human-like delay between requests (longer delays for more realistic behavior)
        if (i < urls.length - 1) {
          const baseDelay = randomDelay(3000, 8000); // 3-8 seconds base delay
          const jitteredDelay = randomJitter(baseDelay, 0.4); // 40% jitter
          console.log(`⏳ Waiting ${Math.round(jitteredDelay/1000)}s before next URL...`);
          await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        }
      }

      // Update job with total ad count
      await DatabaseService.updateScrapeJob(job.id, this.stats.totalAdCount);

      // Print final stats
      this.printStats();

    } catch (error) {
      console.error('❌ Scraper service error:', error);
      throw error;
    } finally {
      // Clean up
      await this.facebookChecker.close();
      await this.googleChecker.close();
    }
  }

  private async processUrl(url: ScrapeUrl, jobId: string): Promise<void> {
    console.log(`\n🔍 Processing domain: ${url.domain}`);
    
    // Random delay before processing each domain
    await humanDelay(1000, 2000);
    
    // Process Facebook URL if available
    if (url.facebook_url) {
      try {
        console.log(`  📘 Checking Facebook: ${url.facebook_url}`);
        const facebookResult = await this.facebookChecker.scrapeAdCount(url.facebook_url);
        
        await DatabaseService.createScrapeResult(
          url.domain,
          'facebook',
          jobId,
          facebookResult.adCount,
          facebookResult.status
        );

        if (facebookResult.status === 'success') {
          this.stats.facebookSuccess++;
          if (facebookResult.adCount) {
            this.stats.totalAdCount += facebookResult.adCount;
          }
        } else {
          this.stats.facebookFailed++;
        }

        console.log(`  📘 Facebook result: ${facebookResult.adCount || 'N/A'} ads (${facebookResult.status})`);
        
        // Random delay between Facebook and Google checks
        await humanDelay(1500, 3000);
      } catch (error) {
        console.error(`  ❌ Facebook error for ${url.domain}:`, error);
        await DatabaseService.createScrapeResult(
          url.domain,
          'facebook',
          jobId,
          null,
          'error'
        );
        this.stats.facebookFailed++;
      }
    }

    // Process Google URL if available
    if (url.google_url) {
      try {
        console.log(`  🔍 Checking Google: ${url.google_url}`);
        const googleResult = await this.googleChecker.scrapeAdCount(url.google_url);
        
        await DatabaseService.createScrapeResult(
          url.domain,
          'google',
          jobId,
          googleResult.adCount,
          googleResult.status
        );

        if (googleResult.status === 'success') {
          this.stats.googleSuccess++;
          if (googleResult.adCount) {
            this.stats.totalAdCount += googleResult.adCount;
          }
        } else {
          this.stats.googleFailed++;
        }

        console.log(`  🔍 Google result: ${googleResult.adCount || 'N/A'} ads (${googleResult.status})`);
      } catch (error) {
        console.error(`  ❌ Google error for ${url.domain}:`, error);
        await DatabaseService.createScrapeResult(
          url.domain,
          'google',
          jobId,
          null,
          'error'
        );
        this.stats.googleFailed++;
      }
    }

    console.log(`  ✅ Completed processing ${url.domain}`);
  }

  private printStats(): void {
    console.log('\n📊 Scrape Statistics:');
    console.log(`  Total URLs: ${this.stats.totalUrls}`);
    console.log(`  Processed URLs: ${this.stats.processedUrls}`);
    console.log(`  Facebook Success: ${this.stats.facebookSuccess}`);
    console.log(`  Facebook Failed: ${this.stats.facebookFailed}`);
    console.log(`  Google Success: ${this.stats.googleSuccess}`);
    console.log(`  Google Failed: ${this.stats.googleFailed}`);
    console.log(`  Total Ad Count: ${this.stats.totalAdCount}`);
  }

}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new ScraperService();
  
  scraper.runScrape()
    .then(() => {
      console.log('🎉 Scraping completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Scraping failed:', error);
      process.exit(1);
    });
}
