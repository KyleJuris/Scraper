const { chromium, devices } = require('playwright');

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Launch a single Chromium with mild stealth-like settings and jitter.
 * Headless by default for Render; set HEADLESS=false to see browser locally.
 */
async function createBrowser() {
  console.log('[BROWSER] Launching Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  console.log('[BROWSER] ✅ Chromium launched successfully.');
  return { browser, context };
}

module.exports = { createBrowser };
