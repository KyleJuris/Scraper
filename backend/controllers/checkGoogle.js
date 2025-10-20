/**
 * Google scraping logic using Playwright.
 * Detects text like "7 ads" from elements such as:
 * <div class="ads-count ads-count-searchable _ngcontent-nun-21">7 ads</div>
 */

async function randomHumanPause(page, min = 200, max = 900) {
  await page.waitForTimeout(min + Math.floor(Math.random() * (max - min)));
}

function extractFirstNumber(text) {
  if (!text) return null;
  const m = text.replace(/,/g, '').match(/(\d+)\s*ads?/i);
  return m ? parseInt(m[1], 10) : null;
}

async function checkGoogle(page, url) {
  let adCount = 0;
  let status = 'failed';

  try {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewportSize({
      width: 1280 + Math.floor(Math.random() * 120),
      height: 900 + Math.floor(Math.random() * 100)
    });

    console.log(`[Google] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await randomHumanPause(page, 800, 1600);
    await page.mouse.wheel(0, 600 + Math.floor(Math.random() * 400));

    // ✅ Strategy 1: wait for .ads-count element to appear (reliable for Ad Transparency Center)
    await page.waitForSelector('.ads-count.ads-count-searchable', { timeout: 15000 }).catch(() => {});

    const locator = page.locator('.ads-count.ads-count-searchable');
    const count = await locator.count();

    console.log(`[Google] Found ${count} '.ads-count' element(s)`);

    let bestNumber = null;
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const text = (await locator.nth(i).innerText()).trim();
        console.log(`[Google] ads-count[${i}] text: "${text}"`);
        const n = extractFirstNumber(text);
        if (Number.isInteger(n)) {
          if (bestNumber === null || n > bestNumber) bestNumber = n;
        }
      }
    }

    if (bestNumber !== null) {
      adCount = bestNumber;
      status = 'success';
      console.log(`[Google] ✅ Parsed adCount = ${adCount}`);
    } else {
      console.log('[Google] ⚠️ No valid ad count text found. Checking fallback patterns...');
      // Fallbacks for dynamic UI
      const altText = await page.locator('text=/\\b\\d+\\s*ads?\\b/i').first().innerText().catch(() => '');
      const n = extractFirstNumber(altText);
      if (Number.isInteger(n)) {
        adCount = n;
        status = 'success';
        console.log(`[Google] ✅ Fallback text matched adCount = ${adCount}`);
      }
    }

    // Status refinement
    if (status !== 'success') {
      const body = await page.locator('body').innerText();
      if (/verify|unusual traffic|blocked|forbidden|access denied|captcha/i.test(body)) {
        status = 'blocked';
      } else {
        status = 'failed';
      }
    }
  } catch (e) {
    status = 'error';
    console.error('[Google] ❌ Error scraping:', e.message);
  }

  return { ad_count: adCount, status };
}

module.exports = checkGoogle;
