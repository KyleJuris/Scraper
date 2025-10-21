/**
 * Google Ads Transparency scraper (JavaScript, Playwright).
 * Targets elements like:
 * <div class="ads-count ads-count-searchable ...">8 ads</div>
 * Selector is intentionally strict: div.ads-count.ads-count-searchable
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
    // Force English (US) before navigation so Google serves consistent layout
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    console.log(`[Google] Navigating: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });

    // Keep viewport and scroll behavior consistent
    await page.setViewportSize({ width: 1280, height: 900 });
    await sleep(600);
    await page.mouse.wheel(0, 500);

    // 🔹 Primary selector
    const primary = page.locator('div.ads-count.ads-count-searchable');

    // Try to observe visibility (don’t fail if it times out)
    try {
      await primary.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch (_) {}

    const found = await primary.count();
    console.log(`[Google] primary candidates: ${found}`);

    if (found > 0) {
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
      }
    }

    // 🔸 Fallback: scan full body for “\d+ ads”
    if (status !== 'success') {
      console.log('[Google] Fallback: scanning body text for "(\\d+) ads"');
      const bodyText = await page.textContent('body').catch(() => '') || '';
      const n = parseNumberFromAdsText(bodyText);
      if (Number.isInteger(n)) {
        adCount = n;
        status = 'success';
        console.log(`[Google] ✅ fallback parsed = ${adCount}`);
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
