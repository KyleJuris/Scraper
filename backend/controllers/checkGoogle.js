/**
 * Google scraping logic using Playwright.
 * Dynamic selector strategy (no hardcoding brittle class names).
 * We aim to extract the number from text like: "0 ads"
 * Example HTML (not hardcoded): <div class="ads-count ...">0 ads</div>
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
    let status = 'success';
  
    try {
      // Anti-bot-ish behavior
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await page.setViewportSize({ width: 1280 + Math.floor(Math.random()*120), height: 900 + Math.floor(Math.random()*100) });
  
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await randomHumanPause(page, 500, 1500);
  
      // Scroll a bit to trigger dynamic rendering
      await page.mouse.wheel(0, 500 + Math.floor(Math.random()*400));
      await randomHumanPause(page, 400, 900);
  
      // Try multiple dynamic strategies to find "X ads"
      // Strategy A: any element containing "[number] ads"
      const locatorA = page.locator('text=/\\b\\d+\\s*ads?\\b/i');
      if (await locatorA.count()) {
        const text = (await locatorA.first().innerText()).trim();
        const n = extractFirstNumber(text);
        if (Number.isInteger(n)) adCount = n;
      }
  
      // Strategy B: class contains "ads-count", then read text
      if (adCount === 0) {
        const locatorB = page.locator('[class*=ads-count]');
        if (await locatorB.count()) {
          const text = (await locatorB.first().innerText()).trim();
          const n = extractFirstNumber(text);
          if (Number.isInteger(n)) adCount = n;
        }
      }
  
      // Strategy C: aria attributes or headings if UI changes
      if (adCount === 0) {
        const locatorC = page.locator('role=heading').filter({ hasText: /ads?/i });
        if (await locatorC.count()) {
          const text = (await locatorC.first().innerText()).trim();
          const n = extractFirstNumber(text);
          if (Number.isInteger(n)) adCount = n;
        }
      }
  
      // If still nothing, mark as blocked/failed based on page content
      if (adCount === 0) {
        const bodyText = await page.locator('body').innerText();
        if (/verify|unusual traffic|blocked|forbidden|access denied|captcha/i.test(bodyText)) {
          status = 'blocked';
        } else {
          status = 'failed';
        }
      }
    } catch (e) {
      status = 'error';
      console.error('[Google] Error scraping:', e.message);
    }
  
    return { ad_count: adCount, status };
  }
  
  module.exports = checkGoogle;
  