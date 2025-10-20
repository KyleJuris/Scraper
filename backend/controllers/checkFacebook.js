/**
 * Facebook scraping logic using Playwright.
 * We aim to extract the number from text like: "0 results"
 * Example snippet (not hardcoded): <div role="heading">0 results</div>
 * Selector strategy relies on text patterns and roles (not brittle class chains).
 */

async function randomHumanPause(page, min = 200, max = 900) {
    await page.waitForTimeout(min + Math.floor(Math.random() * (max - min)));
  }
  
  function extractFirstNumberFromResults(text) {
    if (!text) return null;
    const m = text.replace(/,/g, '').match(/(\d+)\s*results?/i);
    return m ? parseInt(m[1], 10) : null;
  }
  
  async function checkFacebook(page, url) {
    let adCount = 0;
    let status = 'success';
  
    try {
      // Anti-bot-ish behavior
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await page.setViewportSize({ width: 1366 + Math.floor(Math.random()*120), height: 900 + Math.floor(Math.random()*100) });
  
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await randomHumanPause(page, 600, 1600);
  
      // Some UIs render after scroll
      await page.mouse.wheel(0, 600 + Math.floor(Math.random()*400));
      await randomHumanPause(page, 400, 900);
  
      // Strategy A: role heading with "results"
      const heading = page.locator('role=heading').filter({ hasText: /results?/i });
      if (await heading.count()) {
        const text = (await heading.first().innerText()).trim();
        const n = extractFirstNumberFromResults(text);
        if (Number.isInteger(n)) adCount = n;
      }
  
      // Strategy B: any element that contains "[number] results"
      if (adCount === 0) {
        const anyResults = page.locator('text=/\\b\\d+\\s*results?\\b/i');
        if (await anyResults.count()) {
          const text = (await anyResults.first().innerText()).trim();
          const n = extractFirstNumberFromResults(text);
          if (Number.isInteger(n)) adCount = n;
        }
      }
  
      // Strategy C: last fallback—scan body text
      if (adCount === 0) {
        const bodyText = await page.locator('body').innerText();
        const n = extractFirstNumberFromResults(bodyText);
        if (Number.isInteger(n)) {
          adCount = n;
        } else if (/verify|unusual activity|blocked|forbidden|access denied|captcha/i.test(bodyText)) {
          status = 'blocked';
        } else {
          status = 'failed';
        }
      }
    } catch (e) {
      status = 'error';
      console.error('[Facebook] Error scraping:', e.message);
    }
  
    return { ad_count: adCount, status };
  }
  
  module.exports = checkFacebook;
  