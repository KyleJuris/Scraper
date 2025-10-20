import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

(async () => {
  const STATE_DIR = path.resolve('state');
  
  // Create unique session file for this run
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const STATE_PATH = path.join(STATE_DIR, `facebook-storage-${timestamp}.json`);

  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

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
  
  // Navigate to Facebook main page first
  console.log('📘 Navigating to Facebook...');
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle' });

  console.log('🟢 A headful browser is open.');
  console.log('1) Log in to Facebook if needed.');
  console.log('2) Navigate to the Ad Library (facebook.com/adlibrary) to confirm access.');
  console.log('3) Session will be saved automatically in 30 seconds...');

  // Wait 30 seconds for manual login/consent, then save automatically
  await page.waitForTimeout(30000);
  
  console.log('💾 Saving session automatically...');
  await context.storageState({ path: STATE_PATH });
  console.log(`✅ Saved storageState to ${STATE_PATH}`);
  
  // Also create a symlink to the latest session for easy access
  const latestPath = path.join(STATE_DIR, 'facebook-storage.json');
  try {
    if (fs.existsSync(latestPath)) {
      fs.unlinkSync(latestPath);
    }
    fs.copyFileSync(STATE_PATH, latestPath);
    console.log(`✅ Created latest session symlink: ${latestPath}`);
  } catch (error) {
    console.log(`⚠️  Could not create latest session symlink: ${error}`);
  }
  
  await browser.close();
  console.log('🎉 Session saved successfully! You can now run the scraper.');
  process.exit(0);
})();

