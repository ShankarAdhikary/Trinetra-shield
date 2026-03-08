/**
 * Security Service
 * Handles URL safety checks and phishing detection
 */

import { StorageService } from './storageService.js';

export class SecurityService {
  constructor() {
    this.storage = new StorageService();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Known phishing patterns
    this.phishingPatterns = [
      /login.*\.tk\//i,
      /secure.*\.cf\//i,
      /account.*\.ml\//i,
      /verify.*\.ga\//i,
      /update.*\.gq\//i,
      /confirm.*-.*\.com\//i,
      /signin.*-.*\.net\//i
    ];
    
    // Suspicious TLDs
    this.suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click'];
  }

  /**
   * Check if a URL is safe
   * @param {string} url - The URL to check
   * @param {string} level - Security level (low, medium, high)
   * @returns {Promise<object>} Safety check result
   */
  async checkUrl(url, level = 'medium') {
    try {
      // Check cache first
      const cached = this.getCached(url);
      if (cached) return cached;

      const urlObj = new URL(url);
      const result = {
        safe: true,
        threat: null,
        confidence: 0,
        checks: []
      };

      // Skip checks for internal URLs
      if (this.isInternalUrl(url)) {
        return result;
      }

      // Perform checks based on security level
      const checks = this.getChecksForLevel(level);
      
      for (const check of checks) {
        const checkResult = await this.performCheck(check, urlObj);
        result.checks.push({
          name: check,
          passed: checkResult.passed,
          details: checkResult.details
        });
        
        if (!checkResult.passed) {
          result.safe = false;
          result.threat = checkResult.threat;
          result.confidence = Math.max(result.confidence, checkResult.confidence);
        }
      }

      // Cache the result
      this.setCache(url, result);
      
      return result;
    } catch (error) {
      console.error('Security check error:', error);
      return { safe: true, error: true };
    }
  }

  /**
   * Get checks to perform based on security level
   */
  getChecksForLevel(level) {
    const allChecks = [
      'pattern',
      'tld',
      'ssl',
      'ipAddress',
      'homograph',
      'safeBrowsing'
    ];
    
    switch (level) {
      case 'low':
        return ['pattern', 'safeBrowsing'];
      case 'medium':
        return ['pattern', 'tld', 'ssl', 'safeBrowsing'];
      case 'high':
        return allChecks;
      default:
        return ['pattern', 'tld', 'ssl', 'safeBrowsing'];
    }
  }

  /**
   * Perform a specific security check
   */
  async performCheck(checkName, urlObj) {
    switch (checkName) {
      case 'pattern':
        return this.checkPhishingPatterns(urlObj);
      case 'tld':
        return this.checkSuspiciousTLD(urlObj);
      case 'ssl':
        return this.checkSSL(urlObj);
      case 'ipAddress':
        return this.checkIPAddress(urlObj);
      case 'homograph':
        return this.checkHomograph(urlObj);
      case 'safeBrowsing':
        return this.checkSafeBrowsing(urlObj);
      default:
        return { passed: true };
    }
  }

  /**
   * Check URL against known phishing patterns
   */
  checkPhishingPatterns(urlObj) {
    const fullUrl = urlObj.href;
    
    for (const pattern of this.phishingPatterns) {
      if (pattern.test(fullUrl)) {
        return {
          passed: false,
          threat: 'Phishing pattern detected',
          confidence: 0.8,
          details: 'URL matches known phishing pattern'
        };
      }
    }
    
    return { passed: true };
  }

  /**
   * Check for suspicious TLDs
   */
  checkSuspiciousTLD(urlObj) {
    const hostname = urlObj.hostname.toLowerCase();
    
    for (const tld of this.suspiciousTLDs) {
      if (hostname.endsWith(tld)) {
        return {
          passed: false,
          threat: 'Suspicious domain',
          confidence: 0.5,
          details: `Domain uses suspicious TLD: ${tld}`
        };
      }
    }
    
    return { passed: true };
  }

  /**
   * Check SSL status
   */
  checkSSL(urlObj) {
    if (urlObj.protocol !== 'https:') {
      // Allow local development
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return { passed: true };
      }
      
      return {
        passed: false,
        threat: 'Insecure connection',
        confidence: 0.3,
        details: 'Site does not use HTTPS'
      };
    }
    
    return { passed: true };
  }

  /**
   * Check if hostname is an IP address
   */
  checkIPAddress(urlObj) {
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (ipPattern.test(urlObj.hostname)) {
      // Allow localhost
      if (urlObj.hostname === '127.0.0.1') {
        return { passed: true };
      }
      
      return {
        passed: false,
        threat: 'IP address URL',
        confidence: 0.6,
        details: 'Site uses IP address instead of domain name'
      };
    }
    
    return { passed: true };
  }

  /**
   * Check for homograph attacks (lookalike characters)
   */
  checkHomograph(urlObj) {
    const hostname = urlObj.hostname;
    
    // Check for punycode (internationalized domain names)
    if (hostname.startsWith('xn--')) {
      return {
        passed: false,
        threat: 'Possible homograph attack',
        confidence: 0.7,
        details: 'Domain uses internationalized characters that may look like other letters'
      };
    }
    
    // Check for common lookalike substitutions
    const lookalikes = {
      'paypa1': 'paypal',
      'arnazon': 'amazon',
      'googie': 'google',
      'rnicrosoft': 'microsoft',
      'faceb00k': 'facebook'
    };
    
    for (const [fake, real] of Object.entries(lookalikes)) {
      if (hostname.includes(fake)) {
        return {
          passed: false,
          threat: 'Possible brand impersonation',
          confidence: 0.9,
          details: `Domain looks like it's trying to impersonate ${real}`
        };
      }
    }
    
    return { passed: true };
  }

  /**
   * Check against Google Safe Browsing via backend API
   */
  async checkSafeBrowsing(urlObj) {
    try {
      // Check against a local blocklist first
      const blocklist = await this.storage.get('threatBlocklist') || [];
      
      if (blocklist.includes(urlObj.hostname)) {
        return {
          passed: false,
          threat: 'Known malicious site',
          confidence: 1.0,
          details: 'Site is on the known threats blocklist'
        };
      }

      // Call backend API for Google Safe Browsing check
      try {
        const response = await fetch(
          `https://trinetra-shield.onrender.com/api/security/check?url=${encodeURIComponent(urlObj.href)}`
        );
        
        if (response.ok) {
          const result = await response.json();
          if (!result.safe) {
            // Cache the result locally
            blocklist.push(urlObj.hostname);
            await this.storage.set('threatBlocklist', blocklist.slice(-500));
            
            return {
              passed: false,
              threat: result.threat || 'Flagged by Safe Browsing',
              confidence: (result.confidence || 90) / 100,
              details: result.details?.join('; ') || 'Flagged by security check'
            };
          }
        }
      } catch (fetchError) {
        // Backend unavailable — fail open with local checks only
      }
      
      return { passed: true };
    } catch (error) {
      console.error('Safe Browsing check error:', error);
      return { passed: true }; // Fail open
    }
  }

  /**
   * Check if URL is internal (chrome://, chrome-extension://, etc.)
   */
  isInternalUrl(url) {
    return url.startsWith('chrome://') ||
           url.startsWith('chrome-extension://') ||
           url.startsWith('about:') ||
           url.startsWith('edge://') ||
           url.startsWith('file://');
  }

  /**
   * Get cached result for a URL
   */
  getCached(url) {
    const cached = this.cache.get(url);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    return null;
  }

  /**
   * Cache a result for a URL
   */
  setCache(url, result) {
    this.cache.set(url, {
      result,
      timestamp: Date.now()
    });
    
    // Clean up old entries
    if (this.cache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Report a site as malicious
   * @param {string} url - The URL to report
   * @param {string} reason - Reason for reporting
   */
  async reportSite(url, reason) {
    try {
      const urlObj = new URL(url);
      const reports = await this.storage.get('siteReports') || [];
      
      reports.push({
        url: urlObj.href,
        hostname: urlObj.hostname,
        reason,
        timestamp: Date.now()
      });
      
      await this.storage.set('siteReports', reports.slice(-100)); // Keep last 100 reports
      
      return { success: true };
    } catch (error) {
      console.error('Failed to report site:', error);
      return { success: false, error: error.message };
    }
  }
}
