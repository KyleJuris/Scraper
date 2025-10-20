/**
 * Google Ads Transparency scraper (JavaScript).
 * Inspired by getAdCount.ts: resilient selector + visibility wait + fallback scan.
 * Extracts numbers like "7 ads" from elements such as:
 * <div class="ads-count ads-count-searchable ...">7 ads</div>
 */

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseNumberFromAdsText(raw) {
  if (!raw) return null;
  const m = raw.match(/([\d,]+)\s*ads?/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

async function checkGoogle(page, url) {
  let adCount = 0;
  let status = 'failed';

  try {
    console.log(`[Google] Navigating: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });

    // Nudge rendering & keep things human-ish
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await sleep(600);
    await page.mouse.wheel(0, 500);

    // Primary: semantic, multi-hint selector with text guard "ads"
    // (mirrors the TS helper's :is(...) + hasText approach)
    const primary = page.locator(
      ':is([class*="ads-count"], [class*="ads-count-searchable"], [aria-label*="ads"], [role="status"])',
      { hasText: /\bads?\b/i }
    );

    // Try to see at least one visible candidate
    try {
      await primary.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch (_) {
      // visibility wait timed out; we'll still read whatever exists
    }

    let rawText = null;

    const found = await primary.count();
    console.log(`[Google] primary candidates: ${found}`);
    if (found > 0) {
      // read all candidates; pick the best number (handles transient "0 ads")
      let best = null;
      for (let i = 0; i < found; i++) {
        const txt = (await primary.nth(i).innerText().catch(() => '') || '').trim();
        console.log(`[Google] candidate[${i}] = "${txt}"`);
        const n = parseNumberFromAdsText(txt);
        if (Number.isInteger(n)) best = best === null ? n : Math.max(best, n);
      }
      if (best !== null) {
        adCount = best;
        status = 'success';
        console.log(`[Google] ✅ parsed = ${adCount}`);
      } else {
        rawText = await primary.first().innerText().catch(() => null);
      }
    }

    // Fallback: scan full body text for “\d+ ads”
    if (status !== 'success') {
      console.log('[Google] Fallback: scanning body text for "(\\d+) ads"');
      const bodyText = await page.textContent('body').catch(() => '') || '';
      const n = parseNumberFromAdsText(bodyText);
      if (Number.isInteger(n)) {
        adCount = n;
        status = 'success';
        console.log(`[Google] ✅ fallback parsed = ${adCount}`);
      } else if (/blocked|captcha|verify|unusual traffic|forbidden|access denied/i.test(bodyText)) {
        status = 'blocked';
        console.log('[Google] 🚫 blocked/captcha detected');
      } else {
        status = 'failed';
        console.log('[Google] ❌ could not parse ad count');
      }
    }
  } catch (err) {
    status = 'error';
    console.error('[Google] ❌ Error:', err.message);
  }

  return { ad_count: adCount, status };
}

module.exports = checkGoogle;
