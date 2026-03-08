/**
 * Security Routes
 * Handles URL safety checks and threat reporting
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');

const logger = require('../services/logger');
const db = require('../services/database');

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Known phishing domains (simplified list for demo)
const knownPhishingDomains = new Set([
  'login-secure.tk',
  'account-verify.ml',
  'signin-bank.ga',
  'secure-update.cf',
  'verify-account.gq'
]);

// Suspicious TLDs
const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click'];

// Phishing patterns
const phishingPatterns = [
  /login.*\.(tk|ml|ga|cf|gq)/i,
  /secure.*\.(tk|ml|ga|cf|gq)/i,
  /account.*verify/i,
  /signin.*-.*\.com/i,
  /paypal.*-.*\.net/i,
  /google.*-.*\.org/i,
  /microsoft.*login.*\./i
];

/**
 * GET /api/security/check
 * Check if a URL is safe
 */
router.get('/check', [
  query('url').isURL().withMessage('Valid URL required'),
  handleValidation
], async (req, res, next) => {
  try {
    const { url } = req.query;
    const result = await checkUrlSafety(url);

    logger.info('URL safety check', { 
      url: url.substring(0, 100), 
      safe: result.safe 
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/security/report
 * Report a phishing or malicious URL
 */
router.post('/report', [
  body('url').isURL().withMessage('Valid URL required'),
  body('type').isIn(['phishing', 'malware', 'scam', 'other']).withMessage('Invalid type'),
  body('description').optional().isLength({ max: 1000 }),
  handleValidation
], async (req, res, next) => {
  try {
    const { url, type, description } = req.body;

    // Save report to database
    const report = {
      url,
      type,
      description,
      ip: req.ip,
      timestamp: new Date().toISOString()
    };
    db.addSecurityLog(report);

    logger.warn('URL reported', report);

    res.json({ 
      success: true, 
      message: 'Thank you for reporting this URL' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/security/stats
 * Get security statistics (requires auth)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const logs = db.getSecurityLogs ? db.getSecurityLogs() : [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    const threatLogs = logs.filter(l => l.type === 'threat_blocked');

    res.json({
      threatsBlockedToday: threatLogs.filter(l => new Date(l.timestamp).getTime() >= todayStart).length,
      threatsBlockedWeek: threatLogs.filter(l => new Date(l.timestamp).getTime() >= weekStart).length,
      threatsBlockedMonth: threatLogs.filter(l => new Date(l.timestamp).getTime() >= monthStart).length,
      totalReports: logs.filter(l => l.type !== 'threat_blocked').length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/security/batch-check
 * Check multiple URLs at once
 */
router.post('/batch-check', [
  body('urls').isArray({ min: 1, max: 50 }).withMessage('Provide 1-50 URLs'),
  body('urls.*').isURL().withMessage('All items must be valid URLs'),
  handleValidation
], async (req, res, next) => {
  try {
    const { urls } = req.body;
    
    const results = await Promise.all(
      urls.map(async (url) => ({
        url,
        ...(await checkUrlSafety(url))
      }))
    );

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/security/blocklist
 * Get the current threat blocklist for extension auto-updates
 */
router.get('/blocklist', async (_req, res, next) => {
  try {
    // Combine known phishing domains with reported domains
    const reportedDomains = new Set();
    const logs = db.getSecurityLogs ? db.getSecurityLogs() : [];
    for (const log of logs) {
      if (log.url) {
        try {
          reportedDomains.add(new URL(log.url).hostname);
        } catch (e) { /* skip invalid URLs */ }
      }
    }

    const domains = [...knownPhishingDomains, ...reportedDomains];
    
    res.json({
      domains,
      updatedAt: new Date().toISOString(),
      version: '1.0'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Check URL safety using local heuristics + Google Safe Browsing API
 */
async function checkUrlSafety(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    const result = {
      safe: true,
      threat: null,
      confidence: 0,
      details: []
    };

    // Check against known phishing domains
    if (knownPhishingDomains.has(hostname)) {
      result.safe = false;
      result.threat = 'phishing';
      result.confidence = 95;
      result.details.push('Domain is in known phishing database');
      return result;
    }

    // Check for suspicious TLDs
    for (const tld of suspiciousTLDs) {
      if (hostname.endsWith(tld)) {
        result.details.push(`Uses suspicious TLD: ${tld}`);
        result.confidence = Math.max(result.confidence, 30);
      }
    }

    // Check against phishing patterns
    for (const pattern of phishingPatterns) {
      if (pattern.test(url)) {
        result.safe = false;
        result.threat = 'suspicious_pattern';
        result.confidence = Math.max(result.confidence, 70);
        result.details.push('URL matches known phishing pattern');
      }
    }

    // Check for IP address URLs (common in phishing)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      result.details.push('URL uses IP address instead of domain');
      result.confidence = Math.max(result.confidence, 40);
    }

    // Check for excessive subdomains (potential phishing indicator)
    const subdomains = hostname.split('.');
    if (subdomains.length > 4) {
      result.details.push('Excessive subdomains detected');
      result.confidence = Math.max(result.confidence, 25);
    }

    // Check for lookalike domains
    const lookalikes = ['paypa1', 'g00gle', 'micr0soft', 'faceb00k', 'amaz0n'];
    for (const lookalike of lookalikes) {
      if (hostname.includes(lookalike)) {
        result.safe = false;
        result.threat = 'lookalike_domain';
        result.confidence = 85;
        result.details.push('Potential lookalike domain detected');
      }
    }

    // Google Safe Browsing API check (if API key is configured)
    if (process.env.GOOGLE_SAFE_BROWSING_API_KEY) {
      try {
        const safeBrowsingResult = await checkGoogleSafeBrowsing(url);
        if (safeBrowsingResult && !safeBrowsingResult.safe) {
          result.safe = false;
          result.threat = safeBrowsingResult.threat;
          result.confidence = Math.max(result.confidence, 99);
          result.details.push(...safeBrowsingResult.details);
        }
      } catch (sbError) {
        logger.warn('Google Safe Browsing check failed, using local checks only', { error: sbError.message });
      }
    }

    return result;
  } catch (error) {
    logger.error('URL safety check error', { url, error: error.message });
    return { safe: true, error: 'Check failed', details: [] };
  }
}

/**
 * Check URL against Google Safe Browsing API v4
 */
async function checkGoogleSafeBrowsing(url) {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) return null;

  const requestBody = {
    client: {
      clientId: 'trinetra-shield',
      clientVersion: '1.0.0'
    },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }]
    }
  };

  const response = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    throw new Error(`Safe Browsing API returned ${response.status}`);
  }

  const data = await response.json();

  if (data.matches && data.matches.length > 0) {
    const threatTypes = data.matches.map(m => m.threatType);
    return {
      safe: false,
      threat: threatTypes.includes('SOCIAL_ENGINEERING') ? 'phishing' : 'malware',
      details: [`Google Safe Browsing: ${threatTypes.join(', ')}`]
    };
  }

  return { safe: true };
}

module.exports = router;
