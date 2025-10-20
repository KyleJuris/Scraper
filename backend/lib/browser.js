const { chromium, devices } = require('playwright');

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Launch a single Chromium with mild stealth-like settings and jitter.
 * Headless by default for Render; set HEADLESS=false to see browser locally.
 */
async function createBrowser() {
  const headless = String(process.env.HEADLESS || 'true').toLowerCase() !== 'false';

  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
  });

  // Use a persistent-ish context with randomized UA
  const uaBase = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                 '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const ua = uaBase.replace('124.0.0.0', `${rand(120, 126)}.0.${rand(0, 9)}.${rand(0, 200)}`);

  const context = await browser.newContext({
    userAgent: ua,
    locale: 'en-US',
    colorScheme: 'light',
    deviceScaleFactor: 1 + Math.random() * 0.5,
    viewport: { width: 1200 + rand(0, 200), height: 800 + rand(0, 200) }
  });

  // Light fingerprint noise: random timezone spoof is avoided to not break sites; keep simple.

  return { browser, context };
}

module.exports = { createBrowser };
