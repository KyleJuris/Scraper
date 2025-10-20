const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class FacebookChecker {
  constructor(cookiesPath) {
    this.browser = null;
    this.context = null;
    this.cookiesPath = cookiesPath || path.join(process.cwd(), 'cookies', 'facebook-cookies.json');
  }

  async initialize() {
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles'
    });

    // Load cookies if they exist
    await this.loadCookies();
    
    console.log('✅ Facebook checker initialized');
  }

  async loadCookies() {
    try {
      if (fs.existsSync(this.cookiesPath)) {
        const cookiesData = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf8'));
        
        if (Array.isArray(cookiesData)) {
          // Direct cookies array
          await this.context.addCookies(cookiesData);
        } else if (cookiesData.cookies && Array.isArray(cookiesData.cookies)) {
          // Playwright storage state format
          await this.context.addCookies(cookiesData.cookies);
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

  async scrapeAdCount(url) {
    if (!this.context) {
      throw new Error('Facebook checker not initialized');
    }

    const page = await this.context.newPage();
    
    try {
      console.log(`📘 Scraping Facebook URL: ${url}`);
      
      // Navigate to the URL with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: parseInt(process.env.TIMEOUT || '30000')
      });

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(2000);

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

  async getAdCount(page) {
    let rawText = null;
    let count = null;

    // Use stable semantic selector for Facebook Ads Library results count
    try {
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

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      console.log('🔒 Facebook checker closed');
    }
  }
}

module.exports = FacebookChecker;
