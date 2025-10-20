import { Page } from 'playwright';

export async function getAdCount(page: Page, platform: 'google' | 'meta'): Promise<{ count: number | null; rawText: string | null }> {
  let rawText: string | null = null;
  let count: number | null = null;

  if (platform === 'meta') {
    // Use stable semantic selector for Facebook Ads Library results count
    try {
      const locator = page.locator('[role="heading"]', { hasText: /results/i });
      const elementCount = await locator.count();
      
      if (elementCount > 0) {
        rawText = await locator.first().innerText();
        // Extract number from text like "~2,900 results" or "2,900 results"
        const numberMatch = rawText.match(/[\d,]+/);
        if (numberMatch) {
          count = parseInt(numberMatch[0].replace(/,/g, ''), 10);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Error with semantic selector: ${error}`);
    }

    // Fallback to body text regex if semantic selector fails
    if (!rawText || count === null) {
      try {
        const bodyText = (await page.textContent('body')) || '';
        const resultsPattern = /([\d,]+)\s+results/i;
        const match = bodyText.match(resultsPattern);
        if (match) {
          rawText = match[0];
          count = parseInt(match[1].replace(/,/g, ''), 10);
        }
      } catch (error) {
        console.log(`   ⚠️  Error with body text fallback: ${error}`);
      }
    }
  } else {
    // Google Ads Library - use robust semantic selector
    const primary = page.locator(
      ':is([class*="ads-count"], [class*="ads-count-searchable"], [aria-label*="ads"], [role="status"])',
      { hasText: /\bads?\b/i }
    );

    // Wait for the element to be visible (with timeout)
    try {
      await primary.first().waitFor({ state: 'visible', timeout: 5000 });
    } catch (waitError) {
      // Element not visible within timeout, continue with count check
    }

    if (await primary.count()) {
      rawText = await primary.first().innerText();
    } else {
      console.log('   ⚠️  No Google ads count element found, attempting fallback...');
      const bodyText = (await page.textContent('body')) || '';
      const match = bodyText.match(/([\d,]+)\s+ads?/i);
      rawText = match ? match[0] : null;
    }

    const num = rawText?.match(/([\d,]+)/)?.[1];
    count = num ? parseInt(num.replace(/,/g, ''), 10) : null;
  }

  return { count, rawText };
}
