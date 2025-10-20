const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function maybeLoadCookies(context) {
  try {
    const cookiesPath = path.join(__dirname, 'cookies.json');
    if (!fs.existsSync(cookiesPath)) {
      console.log('[PLAYWRIGHT] ⚠️ No cookies.json found — running as guest.');
      return;
    }

    const raw = fs.readFileSync(cookiesPath, 'utf8');
    const cookies = JSON.parse(raw);

    if (!Array.isArray(cookies) || cookies.length === 0) {
      console.log('[PLAYWRIGHT] ⚠️ cookies.json is empty or not an array — running as guest.');
      return;
    }

    // Basic validation & normalization
    const valid = cookies
      .filter(c => c && c.name && c.value && (c.domain || c.url))
      .map(c => {
        // Ensure required fields for Playwright
        return {
          name: String(c.name),
          value: String(c.value),
          domain: c.domain ? String(c.domain) : undefined,
          path: c.path ? String(c.path) : '/',
          url: c.url ? String(c.url) : undefined,
          httpOnly: Boolean(c.httpOnly),
          secure: Boolean(c.secure),
          sameSite: c.sameSite || 'Lax',
          expires: typeof c.expires === 'number' ? c.expires : undefined
        };
      });

    if (valid.length === 0) {
      console.log('[PLAYWRIGHT] ⚠️ No valid cookies after normalization — running as guest.');
      return;
    }

    await context.addCookies(valid);
    console.log(`[PLAYWRIGHT] 🍪 Loaded ${valid.length} cookie(s) into context.`);
  } catch (err) {
    console.log('[PLAYWRIGHT] ⚠️ Failed to load cookies.json — proceeding without cookies.', err?.message || err);
  }
}

/**
 * Launch a single Chromium with mild stealth-like settings and jitter.
 * Headless is on; suitable for Render. No root/system deps required.
 */
async function createBrowser() {
  console.log('[BROWSER] Launching Chromium (headless)…');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
  });

  // Randomize UA & viewport slightly to reduce fingerprints
  const uaBase = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const ua = uaBase.replace('124.0.0.0', `${rand(120, 126)}.0.${rand(0, 9)}.${rand(0, 200)}`);

  const context = await browser.newContext({
    userAgent: ua,
    locale: 'en-US',
    colorScheme: 'light',
    deviceScaleFactor: 1 + Math.random() * 0.5,
    viewport: { width: 1200 + rand(0, 200), height: 800 + rand(0, 200) }
  });

  // ⬇️ Try to load cookies (if cookies.json exists)
  await maybeLoadCookies(context);

  console.log('[BROWSER] ✅ Chromium ready.');
  return { browser, context };
}

module.exports = { createBrowser };
