/**
 * Facebook (Meta Ad Library) scraping with Playwright.
 * Robustly extracts counts like: "~2,900 results", "0 results", "37 results".
 * Adds explicit timing/waits and scans multiple candidate nodes, picking the best number.
 */

async function randomHumanPause(page, min = 250, max = 900) {
  await page.waitForTimeout(min + Math.floor(Math.random() * (max - min)));
}

/** Extract the first integer from "... results" (handles "~", commas). */
function extractFirstNumberFromResults(text) {
  if (!text) return null;
  // Normalize: remove non-breaking spaces, trim, and allow leading "~"
  const cleaned = text.replace(/\u00a0/g, ' ').trim();
  // Match: optional "~", digits with optional commas, followed by "result" or "results"
  const m = cleaned.match(/~?\s*([\d,]+)\s*results?/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

async function checkFacebook(page, url) {
  let adCount = 0;
  let status = 'failed'; // default is NOT success

  try {
    // Slightly human-ish environment
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewportSize({
      width: 1366 + Math.floor(Math.random() * 120),
      height: 900 + Math.floor(Math.random() * 120)
    });

    // Load & give the app time to render client-side UI
    console.log(`[Facebook] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await randomHumanPause(page, 800, 1600);

    // Light scroll to trigger lazy rendering
    await page.mouse.wheel(0, 600 + Math.floor(Math.random() * 600));
    await randomHumanPause(page, 400, 1000);

    // ---- Primary strategy: wait for a heading containing "results"
    // Facebook frequently renders the total in a heading element (role=heading)
    await page
      .waitForSelector('role=heading', { timeout: 20000 })
      .catch(() => {});

    // Collect all candidate nodes that might contain "... results"
    const candidateLocators = [
      page.locator('role=heading').filter({ hasText: /results?/i }),
      page.locator('text=/~?\\s*[\\d,]+\\s*results?/i') // any element with "~ 2,900 results"
    ];

    let bestNumber = null;

    // Evaluate each candidate locator and pick the largest valid number
    for (const loc of candidateLocators) {
      const count = await loc.count();
      for (let i = 0; i < count; i++) {
        const txt = (await loc.nth(i).innerText().catch(() => '')).trim();
        if (!txt) continue;
        console.log(`[Facebook] Candidate text: "${txt}"`);
        const n = extractFirstNumberFromResults(txt);
        if (Number.isInteger(n)) {
          if (bestNumber === null || n > bestNumber) bestNumber = n;
        }
      }
    }

    if (bestNumber !== null) {
      adCount = bestNumber;
      status = 'success';
      console.log(`[Facebook] ✅ Parsed adCount = ${adCount}`);
    } else {
      // ---- Fallback: scan the whole body text (last resort)
      console.log('[Facebook] ⚠️ No candidate matched; scanning body text…');
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const n = extractFirstNumberFromResults(bodyText);
      if (Number.isInteger(n)) {
        adCount = n;
        status = 'success';
        console.log(`[Facebook] ✅ Fallback body scan parsed adCount = ${adCount}`);
      } else if (/verify|unusual activity|blocked|forbidden|access denied|captcha/i.test(bodyText)) {
        status = 'blocked';
        console.log('[Facebook] 🚫 Page indicates block/captcha.');
      } else {
        status = 'failed';
        console.log('[Facebook] ❌ Could not parse a result count.');
      }
    }
  } catch (e) {
    status = 'error';
    console.error('[Facebook] ❌ Error scraping:', e.message);
  }

  return { ad_count: adCount, status };
}

module.exports = checkFacebook;
