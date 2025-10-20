/**
 * Extract Facebook ads count from text
 * Looks for patterns like "~2,300 results" or "2,300 results"
 */
export function extractFacebookCount(text: string): number | null {
  if (!text) return null;
  
  // Regex to match patterns like "~2,300 results" or "2,300 results"
  const match = text.match(/(?:~)?\s*([\d,]+)\s+results/i);
  
  if (match && match[1]) {
    return toNumber(match[1]);
  }
  
  return null;
}

/**
 * Extract Google ads count from text
 * Looks for patterns like "7 ads" or "1,234 ads"
 */
export function extractGoogleCount(text: string): number | null {
  if (!text) return null;
  
  // Regex to match patterns like "7 ads" or "1,234 ads"
  const match = text.match(/([\d,]+)\s+ads/i);
  
  if (match && match[1]) {
    return toNumber(match[1]);
  }
  
  return null;
}

/**
 * Convert string to number, handling commas
 */
export function toNumber(s: string): number | null {
  if (!s) return null;
  
  try {
    // Remove commas and convert to number
    const cleaned = s.replace(/,/g, '');
    const num = parseInt(cleaned, 10);
    
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

/**
 * Check if text contains consent/login walls
 * More specific patterns that indicate actual blocking/consent requirements
 */
export function hasConsentWall(text: string): boolean {
  if (!text) return false;
  
  // More specific patterns that indicate actual consent/login walls
  const consentPatterns = [
    // Login/signin walls
    /log\s+in\s+to\s+continue/i,
    /sign\s+in\s+to\s+continue/i,
    /please\s+log\s+in/i,
    /please\s+sign\s+in/i,
    /login\s+required/i,
    /signin\s+required/i,
    
    // Consent/cookie banners (more specific)
    /accept\s+all\s+cookies/i,
    /accept\s+cookies\s+to\s+continue/i,
    /cookie\s+consent/i,
    /manage\s+cookie\s+preferences/i,
    /cookie\s+settings/i,
    
    // CAPTCHA/verification
    /verify\s+you\s+are\s+human/i,
    /complete\s+the\s+captcha/i,
    /security\s+check/i,
    
    // Access denied/blocked
    /access\s+denied/i,
    /you\s+don't\s+have\s+permission/i,
    /this\s+content\s+is\s+not\s+available/i,
    /content\s+unavailable/i,
    
    // Age verification
    /age\s+verification/i,
    /confirm\s+your\s+age/i,
    /you\s+must\s+be\s+\d+\s+years\s+old/i,
  ];
  
  // Check if any pattern matches
  const hasConsentPattern = consentPatterns.some(pattern => pattern.test(text));
  
  // Additional check: if we see results/ads content, it's probably not blocked
  const hasContent = /results|ads|advertisements/i.test(text);
  
  // Only consider it a consent wall if we have consent patterns AND no content
  return hasConsentPattern && !hasContent;
}
