/**
 * Google Ads Transparency scraper.
 * Detects text like "7 ads" from:
 * <div class="ads-count ads-count-searchable _ngcontent-hzf-21">7 ads</div>
 * Includes timing, waiting, and multi-candidate checks.
 */

async function randomHumanPause(page, min = 200, max = 900) {
  await page.waitForTimeout(min + Math.floor(Math.random() * (max - min)));
}

function extractAdNumber(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*ads?/i);
  return match ? parseInt(match[1], 10) : null;
}

async function checkGoogle(page, url) {
  let adCount = 0;
  let status = 'failed';

  try {
    console.log(`[Google] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewportSize({ width: 1280, height: 900 });

    // Wait for ads-count to load (Angular renders this after a few seconds)
    console.log('[Google] Waiting for ads-count element...');
    await page.waitForSelector('div.ads-count.ads-count-searchable', { timeout: 20000 });

    await randomHumanPause(page, 800, 1600);
    await page.mouse.wheel(0, 600 + Math.floor(Math.random() * 300));

    const locators = page.locator('div.ads-count.ads-count-searchable');
    const count = await locators.count();
    console.log(`[Google] Found ${count} potential ads-count elements.`);

    let bestNum = null;

    for (let i = 0; i < count; i++) {
      const text = (await locators.nth(i).innerText().catch(() => '')).trim();
      console.log(`[Google] Element ${i} text: "${text}"`);
      const n = extractAdNumber(text);
      if (Number.isInteger(n)) {
        if (bestNum === null || n > bestNum) bestNum = n;
      }
    }

    if (bestNum !== null) {
      adCount = bestNum;
      status = 'success';
      console.log(`[Google] ✅ Parsed adCount = ${adCount}`);
    } else {
      // Fallback scan
      console.log('[Google] ⚠️ No valid element matched; scanning all text for "\\d+ ads"...');
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const n = extractAdNumber(bodyText);
      if (Number.isInteger(n)) {
        adCount = n;
        status = 'success';
        console.log(`[Google] ✅ Fallback text match = ${adCount}`);
      } else if (/blocked|captcha|verify|unusual traffic/i.test(bodyText)) {
        status = 'blocked';
        console.log('[Google] 🚫 Access blocked or CAPTCHA detected.');
      } else {
        status = 'failed';
        console.log('[Google] ❌ Could not parse ad count.');
      }
    }
  } catch (err) {
    status = 'error';
    console.error('[Google] ❌ Error:', err.message);
  }

  return { ad_count: adCount, status };
}

module.exports = checkGoogle;
