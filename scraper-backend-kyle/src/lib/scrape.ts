import { Page, Browser, BrowserContext, chromium } from 'playwright';
import { ScrapeOutcome, ScrapeSource } from '../types.js';
import { extractFacebookCount, extractGoogleCount, hasConsentWall } from './parsers.js';
import { getAdCount } from './getAdCount.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Normalize URLs to force English language
 */
function withEnglishGoogle(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('hl', 'en');
    return u.toString();
  } catch {
    return url;
  }
}

function withEnglishMeta(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.get('locale')) {
      u.searchParams.set('locale', 'en_US');
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
async function runSessionSaveScript(): Promise<void> {
  console.log('🔧 No session file found. Running session setup...');
  console.log('📝 This will open a browser window for you to log in and accept consent.');
  console.log('⏳ Please wait for the browser to open...');
  
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'session:save'], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Session saved successfully!');
        resolve();
      } else {
        reject(new Error(`Session save script failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Failed to run session save script: ${error.message}`));
    });
  });
}

export async function makeContextWithSession(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const STATE_PATH = 'state/facebook-storage.json';
  
  // Check if session file exists, if not, run the session save script
  try {
    await fs.access(STATE_PATH);
    console.log('✅ Found existing session file, using saved session');
  } catch (error) {
    console.log('🔍 No session file found, setting up session...');
    await runSessionSaveScript();
  }

  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--no-sandbox']
  });

  const context = await browser.newContext({
    // Reuse the saved session (cookies + localStorage)
    storageState: STATE_PATH,

    // Keep these aligned with how you saved the session
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles'
  });

  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Check if session is healthy (not logged out or blocked)
 */
export async function assertSessionHealthy(page: Page): Promise<void> {
  const body = (await page.textContent('body')) || '';
  if (/log in|login|sign in|captcha|consent|cookies|agree|privacy/i.test(body)) {
    throw new Error('⚠️ Session appears blocked or logged-out. Re-run: npm run session:save');
  }
}

/**
export async function loadCookiesFromFile(page: Page, cookieFile: string): Promise<void> {
  try {
    const cookieData = await fs.readFile(cookieFile, 'utf-8');
    const cookies = JSON.parse(cookieData);
    
    if (Array.isArray(cookies) && cookies.length > 0) {
      await page.context().addCookies(cookies);
      console.log(`   🍪 Loaded ${cookies.length} cookies from ${cookieFile}`);
    }
  } catch (error) {
    console.log(`   ⚠️  No existing cookies found (${cookieFile}): ${error.message}`);
    console.log(`   💡 To use real session cookies:`);
    console.log(`      1. Export cookies from your browser (Chrome DevTools > Application > Cookies)`);
    console.log(`      2. Save as cookies.json in project root`);
    console.log(`      3. Or run scraper in non-headless mode first to generate cookies`);
  }
}

/**
 * Save cookies to file for session persistence
 */
export async function saveCookiesToFile(page: Page, cookieFile: string): Promise<void> {
  try {
    const cookies = await page.context().cookies();
    await fs.writeFile(cookieFile, JSON.stringify(cookies, null, 2));
    console.log(`   💾 Saved ${cookies.length} cookies to ${cookieFile}`);
  } catch (error) {
    console.log(`   ⚠️  Could not save cookies to ${cookieFile}: ${error}`);
  }
}

/**
 * Scrape a single URL for ads count
 */
export async function scrapeOne(
  page: Page, 
  source: ScrapeSource, 
  url: string
): Promise<ScrapeOutcome> {
  const startedAt = new Date().toISOString();
  let screenshotPath: string | undefined;

  try {
    console.log(`🔍 Scraping ${source} ads for: ${url}`);

    // User agent and viewport are now set in browser context

    // Navigate to URL with English language preference
    const isGoogle = /google\./i.test(url);
    const isMeta = /facebook\.com|meta\.com/i.test(url);
    const navUrl = isGoogle ? withEnglishGoogle(url) : isMeta ? withEnglishMeta(url) : url;
    
    console.log(`   📱 Navigating to: ${navUrl}`);
    await page.goto(navUrl, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });

    // Wait for content to load
    console.log(`   ⏳ Waiting for content to load...`);
    try {
      if (isMeta) {
        // For Facebook, wait for results text (including "No results" or "~X results")
        await page.waitForFunction(
          () => /results/i.test(document.body.innerText), 
          { timeout: 30000 }
        );
      } else {
        // For Google, wait for ads content
        await page.waitForFunction(
          () => /ads/i.test(document.body.innerText), 
          { timeout: 15000 }
        );
      }
    } catch (waitError) {
      console.log(`   ⚠️  Content wait timeout, continuing...`);
    }

    // Get body text for consent wall detection
    const bodyText = await page.textContent('body') || '';
    
    // Try to bypass consent walls by clicking accept buttons
    if (hasConsentWall(bodyText)) {
      console.log(`   🚫 Consent wall detected, attempting to bypass...`);
      
      try {
        // Try to find and click consent buttons
        const consentSelectors = [
          'button[data-testid*="accept"]',
          'button[data-testid*="consent"]',
          'button[data-testid*="cookie"]',
          'button:has-text("Accept")',
          'button:has-text("Accept All")',
          'button:has-text("I Accept")',
          'button:has-text("Agree")',
          'button:has-text("OK")',
          '[role="button"]:has-text("Accept")',
          'input[type="button"][value*="Accept"]',
          'input[type="submit"][value*="Accept"]'
        ];
        
        let consentClicked = false;
        for (const selector of consentSelectors) {
          try {
            const button = await page.locator(selector).first();
            if (await button.isVisible()) {
              console.log(`   🔘 Clicking consent button: ${selector}`);
              await button.click();
              await page.waitForTimeout(2000); // Wait for page to update
              consentClicked = true;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (consentClicked) {
          console.log(`   ✅ Consent button clicked, re-checking page...`);
          // Re-check for consent wall after clicking
          const newBodyText = await page.textContent('body') || '';
          if (!hasConsentWall(newBodyText)) {
            console.log(`   ✅ Consent wall bypassed successfully`);
          } else {
            console.log(`   ⚠️  Consent wall still present after clicking`);
          }
        } else {
          console.log(`   ⚠️  No consent button found to click`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error attempting to bypass consent wall: ${error}`);
      }
    }
    
    // Re-check for consent wall after bypass attempt
    const finalBodyText = await page.textContent('body') || '';
    if (hasConsentWall(finalBodyText)) {
      console.log(`   🚫 Consent/login wall still detected after bypass attempt`);
      screenshotPath = await takeScreenshot(page, source, url, 'blocked');
      
      return {
        source,
        url,
        status: 'blocked',
        count: null,
        message: 'Consent/login wall detected',
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
        screenshotPath,
      };
    }

    let count: number | null = null;
    let message: string | null = null;
    let rawText: string | null = null;

    // Determine platform for this URL
    const platform = isGoogle ? 'google' : isMeta ? 'meta' : null;

    if (platform) {
      const res = await getAdCount(page, platform);
      count = res.count;
      rawText = res.rawText;
      
      if (count !== null) {
        console.log(`   📊 Found ${count} ads (raw text: "${rawText}")`);
      } else {
        console.log(`   📊 No ads count found (raw text: "${rawText}")`);
      }
    } else {
      // Non-meta/google targets: leave old logic
      console.log(`   📊 Non-meta/google target, skipping ad count extraction`);
    }

    // Determine status and message
    if (count !== null) {
      message = `Found ${count} ads`;
    } else {
      message = 'No ads count found';
    }

    screenshotPath = await takeScreenshot(page, source, url, 'success');

    return {
      source,
      url,
      status: 'success',
      count,
      message,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      screenshotPath,
    };

  } catch (error) {
    console.error(`❌ Error scraping ${source} ads for ${url}:`, error);
    
    screenshotPath = await takeScreenshot(page, source, url, 'error');
    
    return {
      source,
      url,
      status: 'error',
      count: null,
      message: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      screenshotPath,
    };
  }
}

/**
 * Try Facebook-specific DOM selectors
 */
async function tryFacebookDomSelectors(page: Page): Promise<number | null> {
  try {
    // Try headings first
    const headings = await page.getByRole('heading').all();
    
    for (const heading of headings) {
      const text = await heading.textContent();
      if (text) {
        const count = extractFacebookCount(text);
        if (count !== null) {
          console.log(`   📊 Found Facebook count in heading: "${text}"`);
          return count;
        }
      }
    }

    // Try semantic selectors
    const selectors = [
      '[role="heading"]',
      '[aria-level="3"]',
      '[aria-level="2"]',
      '[aria-level="1"]',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      '[class*="result"]',
      '[class*="count"]',
      '[class*="total"]',
      '[data-testid*="result"]',
      '[data-testid*="count"]'
    ];

    for (const selector of selectors) {
      const elements = await page.locator(selector).all();
      
      for (const element of elements) {
        const text = await element.textContent();
        if (text) {
          const count = extractFacebookCount(text);
          if (count !== null) {
            console.log(`   📊 Found Facebook count in ${selector}: "${text}"`);
            return count;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.log(`   ⚠️  Error with Facebook DOM selectors: ${error}`);
    return null;
  }
}

/**
 * Try Google-specific DOM selectors
 */
async function tryGoogleDomSelectors(page: Page): Promise<number | null> {
  try {
    // Try semantic selectors
    const selectors = [
      '[role="status"]',
      '[aria-label*="ads"]',
      '[aria-label*="count"]',
      '[class*="ads-count"]',
      '[class*="count"]',
      '[class*="result"]',
      '[data-testid*="ads"]',
      '[data-testid*="count"]',
      'div[class*="_ngcontent"]'
    ];

    for (const selector of selectors) {
      const elements = await page.locator(selector).all();
      
      for (const element of elements) {
        const text = await element.textContent();
        if (text) {
          const count = extractGoogleCount(text);
          if (count !== null) {
            console.log(`   📊 Found Google count in ${selector}: "${text}"`);
            return count;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.log(`   ⚠️  Error with Google DOM selectors: ${error}`);
    return null;
  }
}

/**
 * Take screenshot for debugging
 */
async function takeScreenshot(
  page: Page, 
  source: ScrapeSource, 
  url: string, 
  type: 'success' | 'error' | 'blocked'
): Promise<string> {
  try {
    // Create screenshots directory
    await fs.mkdir('screenshots', { recursive: true });
    
    // Generate filename
    const domain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${source}_${domain}_${type}.png`;
    const filepath = path.join('screenshots', filename);
    
    // Take screenshot
    await page.screenshot({ 
      path: filepath,
      fullPage: true 
    });
    
    console.log(`   📸 Screenshot saved: ${filepath}`);
    return filepath;
  } catch (error) {
    console.log(`   ⚠️  Failed to take screenshot: ${error}`);
    return '';
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { attempts = 2, baseDelayMs = 1500 } = options;
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`   🔄 Retry ${attempt}/${attempts} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Retry failed');
}

/**
 * Random delay between requests
 */
export async function randomDelay(minMs: number = 400, maxMs: number = 900): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}
