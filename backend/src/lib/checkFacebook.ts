import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

// Random user agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
];

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

export interface FacebookScrapeResult {
  adCount: number | null;
  rawText: string | null;
  status: 'success' | 'failed' | 'blocked' | 'error';
  error?: string;
}

export class FacebookChecker {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private cookiesPath: string;
  private currentUserAgent: string;

  constructor(cookiesPath?: string) {
    this.cookiesPath = cookiesPath || path.join(process.cwd(), 'cookies', 'facebook-cookies.json');
    this.currentUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Facebook checker...');
    
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS === 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: this.currentUserAgent,
      viewport: { 
        width: randomDelay(1200, 1920), 
        height: randomDelay(800, 1080) 
      },
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles'
    });

    // Load cookies if they exist
    await this.loadCookies();
    
    console.log('✅ Facebook checker initialized');
  }

  private async loadCookies(): Promise<void> {
    try {
      if (fs.existsSync(this.cookiesPath)) {
        const cookiesData = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf8'));
        
        if (Array.isArray(cookiesData)) {
          // Direct cookies array
          await this.context!.addCookies(cookiesData);
        } else if (cookiesData.cookies && Array.isArray(cookiesData.cookies)) {
          // Playwright storage state format
          await this.context!.addCookies(cookiesData.cookies);
        } else {
          console.log('⚠️  Invalid cookies format, proceeding without cookies');
        }
        
        console.log('🍪 Loaded Facebook cookies');
      } else {
        console.log('⚠️  No Facebook cookies found, proceeding without authentication');
      }
    } catch (error) {
      console.log(`⚠️  Error loading cookies: ${error}`);
    }
  }

  async scrapeAdCount(url: string): Promise<FacebookScrapeResult> {
    if (!this.context) {
      throw new Error('Facebook checker not initialized');
    }

    const page = await this.context.newPage();
    
    try {
      console.log(`📘 Scraping Facebook URL: ${url}`);
      
      // Random delay before navigation
      await humanDelay(500, 1500);
      
      // Navigate to the URL with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: parseInt(process.env.TIMEOUT || '30000')
      });

      // Random delay after page load
      await humanDelay(2000, 4000);

      // Simulate human-like scrolling behavior
      await this.simulateHumanBehavior(page);

      // Check if we're blocked or redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
        console.log('🚫 Facebook login required or account blocked');
        return {
          adCount: null,
          rawText: null,
          status: 'blocked',
          error: 'Login required or account blocked'
        };
      }

      // Get ad count using the same logic as getAdCount.ts
      const result = await this.getAdCount(page);
      
      console.log(`✅ Facebook scrape completed - Ad count: ${result.count}`);
      
      return {
        adCount: result.count,
        rawText: result.rawText,
        status: 'success'
      };

    } catch (error) {
      console.error(`❌ Facebook scrape error for ${url}:`, error);
      
      return {
        adCount: null,
        rawText: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await page.close();
    }
  }

  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
      const viewport = page.viewportSize();
      if (viewport) {
        const x = randomDelay(100, viewport.width - 100);
        const y = randomDelay(100, viewport.height - 100);
        await page.mouse.move(x, y);
        await humanDelay(100, 300);
      }

      // Random scrolling
      const scrollAmount = randomDelay(100, 500);
      await page.mouse.wheel(0, scrollAmount);
      await humanDelay(500, 1000);
      
      // Sometimes scroll back up
      if (Math.random() < 0.3) {
        await page.mouse.wheel(0, -scrollAmount);
        await humanDelay(300, 800);
      }
    } catch (error) {
      console.log(`   ⚠️  Error simulating human behavior: ${error}`);
    }
  }

  private async getAdCount(page: Page): Promise<{ count: number | null; rawText: string | null }> {
    let rawText: string | null = null;
    let count: number | null = null;

    // Use stable semantic selector for Facebook Ads Library results count
    try {
      // Random delay before looking for elements
      await humanDelay(500, 1000);
      
      const locator = page.locator('[role="heading"]', { hasText: /results/i });
      const elementCount = await locator.count();
      
      if (elementCount > 0) {
        rawText = await locator.first().innerText();
        // Extract number from text like "~2,900 results" or "2,900 results"
        const numberMatch = rawText.match(/[\d,]+/);
        if (numberMatch) {
          count = parseInt(numberMatch[0].replace(/,/g, ''), 10);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Error with semantic selector: ${error}`);
    }

    // Fallback to body text regex if semantic selector fails
    if (!rawText || count === null) {
      try {
        const bodyText = (await page.textContent('body')) || '';
        const resultsPattern = /([\d,]+)\s+results/i;
        const match = bodyText.match(resultsPattern);
        if (match) {
          rawText = match[0];
          count = parseInt(match[1].replace(/,/g, ''), 10);
        }
      } catch (error) {
        console.log(`   ⚠️  Error with body text fallback: ${error}`);
      }
    }

    return { count, rawText };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      console.log('🔒 Facebook checker closed');
    }
  }
}
