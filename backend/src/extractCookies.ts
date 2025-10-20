import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Cookie extraction script for Facebook and Google
 * This script opens browsers and allows you to manually log in,
 * then extracts cookies for use with the scraper
 */

const COOKIES_DIR = path.join(process.cwd(), 'cookies');

async function extractFacebookCookies(): Promise<void> {
  console.log('🍪 Starting Facebook cookie extraction...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles'
  });

  const page = await context.newPage();
  
  console.log('📘 Opening Facebook...');
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle' });

  console.log('🟢 Facebook browser opened.');
  console.log('1) Log in to Facebook if needed.');
  console.log('2) Navigate to the Ad Library (facebook.com/adlibrary) to confirm access.');
  console.log('3) When ready, focus the terminal window and press ENTER to save cookies.');

  process.stdin.once('data', async () => {
    const cookies = await context.cookies();
    
    // Filter cookies for Facebook domains
    const facebookCookies = cookies.filter(cookie => 
      cookie.domain.includes('facebook.com')
    );
    
    // Ensure cookies directory exists
    if (!fs.existsSync(COOKIES_DIR)) {
      fs.mkdirSync(COOKIES_DIR, { recursive: true });
    }
    
    const cookiesPath = path.join(COOKIES_DIR, 'facebook-cookies.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(facebookCookies, null, 2));
    
    console.log(`✅ Saved ${facebookCookies.length} Facebook cookies to ${cookiesPath}`);
    
    await browser.close();
    console.log('🎉 Facebook cookie extraction completed!');
  });
}

async function extractGoogleCookies(): Promise<void> {
  console.log('🍪 Starting Google cookie extraction...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles'
  });

  const page = await context.newPage();
  
  console.log('🔍 Opening Google...');
  await page.goto('https://www.google.com', { waitUntil: 'networkidle' });

  console.log('🟢 Google browser opened.');
  console.log('1) Log in to Google if needed.');
  console.log('2) Navigate to Google Ads Transparency Center to confirm access.');
  console.log('3) When ready, focus the terminal window and press ENTER to save cookies.');

  process.stdin.once('data', async () => {
    const cookies = await context.cookies();
    
    // Filter cookies for Google domains
    const googleCookies = cookies.filter(cookie => 
      cookie.domain.includes('google.com')
    );
    
    // Ensure cookies directory exists
    if (!fs.existsSync(COOKIES_DIR)) {
      fs.mkdirSync(COOKIES_DIR, { recursive: true });
    }
    
    const cookiesPath = path.join(COOKIES_DIR, 'google-cookies.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(googleCookies, null, 2));
    
    console.log(`✅ Saved ${googleCookies.length} Google cookies to ${cookiesPath}`);
    
    await browser.close();
    console.log('🎉 Google cookie extraction completed!');
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const platform = args[0];

  if (platform === 'facebook') {
    await extractFacebookCookies();
  } else if (platform === 'google') {
    await extractGoogleCookies();
  } else {
    console.log('Usage: npm run extract-cookies <facebook|google>');
    console.log('Example: npm run extract-cookies facebook');
    process.exit(1);
  }
}

main().catch(console.error);

