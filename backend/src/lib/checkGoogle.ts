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

export interface GoogleScrapeResult {
  adCount: number | null;
  rawText: string | null;
  status: 'success' | 'failed' | 'blocked' | 'error';
  error?: string;
}

export class GoogleChecker {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private cookiesPath: string;
  private currentUserAgent: string;

  constructor(cookiesPath?: string) {
    this.cookiesPath = cookiesPath || path.join(process.cwd(), 'cookies', 'google-cookies.json');
    this.currentUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Google checker...');
    
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
    
    console.log('✅ Google checker initialized');
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
        
        console.log('🍪 Loaded Google cookies');
      } else {
        console.log('⚠️  No Google cookies found, proceeding without authentication');
      }
    } catch (error) {
      console.log(`⚠️  Error loading cookies: ${error}`);
    }
  }

  async scrapeAdCount(url: string): Promise<GoogleScrapeResult> {
    if (!this.context) {
      throw new Error('Google checker not initialized');
    }

    const page = await this.context.newPage();
    
    try {
      console.log(`🔍 Scraping Google URL: ${url}`);
      
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
      if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
        console.log('🚫 Google login required');
        return {
          adCount: null,
          rawText: null,
          status: 'blocked',
          error: 'Login required'
        };
      }

      // Get ad count using the same logic as getAdCount.ts
      const result = await this.getAdCount(page);
      
      console.log(`✅ Google scrape completed - Ad count: ${result.count}`);
      
      return {
        adCount: result.count,
        rawText: result.rawText,
        status: 'success'
      };

    } catch (error) {
      console.error(`❌ Google scrape error for ${url}:`, error);
      
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

    // Google Ads Library - use robust semantic selector
    const primary = page.locator(
      ':is([class*="ads-count"], [class*="ads-count-searchable"], [aria-label*="ads"], [role="status"])',
      { hasText: /\bads?\b/i }
    );

    // Random delay before looking for elements
    await humanDelay(500, 1000);

    // Wait for the element to be visible (with timeout)
    try {
      await primary.first().waitFor({ state: 'visible', timeout: 5000 });
    } catch (waitError) {
      // Element not visible within timeout, continue with count check
    }

    if (await primary.count()) {
      rawText = await primary.first().innerText();
    } else {
      console.log('   ⚠️  No Google ads count element found, attempting fallback...');
      const bodyText = (await page.textContent('body')) || '';
      const match = bodyText.match(/([\d,]+)\s+ads?/i);
      rawText = match ? match[0] : null;
    }

    const num = rawText?.match(/([\d,]+)/)?.[1];
    count = num ? parseInt(num.replace(/,/g, ''), 10) : null;

    return { count, rawText };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      console.log('🔒 Google checker closed');
    }
  }
}
