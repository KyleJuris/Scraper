const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class GoogleChecker {
  constructor(cookiesPath) {
    this.browser = null;
    this.context = null;
    this.cookiesPath = cookiesPath || path.join(process.cwd(), 'cookies', 'google-cookies.json');
  }

  async initialize() {
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles'
    });

    // Load cookies if they exist
    await this.loadCookies();
    
    console.log('✅ Google checker initialized');
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
        
        console.log('🍪 Loaded Google cookies');
      } else {
        console.log('⚠️  No Google cookies found, proceeding without authentication');
      }
    } catch (error) {
      console.log(`⚠️  Error loading cookies: ${error}`);
    }
  }

  async scrapeAdCount(url) {
    if (!this.context) {
      throw new Error('Google checker not initialized');
    }

    const page = await this.context.newPage();
    
    try {
      console.log(`🔍 Scraping Google URL: ${url}`);
      
      // Navigate to the URL with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: parseInt(process.env.TIMEOUT || '30000')
      });

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(2000);

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

  async getAdCount(page) {
    let rawText = null;
    let count = null;

    // Google Ads Library - use robust semantic selector
    const primary = page.locator(
      ':is([class*="ads-count"], [class*="ads-count-searchable"], [aria-label*="ads"], [role="status"])',
      { hasText: /\bads?\b/i }
    );

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

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      console.log('🔒 Google checker closed');
    }
  }
}

module.exports = GoogleChecker;
