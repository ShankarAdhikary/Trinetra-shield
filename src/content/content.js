/**
 * TRINETRA Content Script
 * Runs on all web pages to provide security overlays and page analysis
 */

(function() {
  'use strict';

  class ContentController {
    constructor() {
      this.warningOverlay = null;
      this.init();
    }

    init() {
      this.setupMessageListener();
      this.analyzePage();
    }

    /**
     * Listen for messages from background script
     */
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
          case 'SHOW_WARNING':
            this.showWarningOverlay(message.data);
            sendResponse({ success: true });
            break;
          
          case 'HIDE_WARNING':
            this.hideWarningOverlay();
            sendResponse({ success: true });
            break;
          
          case 'GET_PAGE_INFO':
            sendResponse(this.getPageInfo());
            break;
          
          case 'HIGHLIGHT_THREATS':
            this.highlightThreats(message.threats);
            sendResponse({ success: true });
            break;
        }
        
        return true;
      });
    }

    /**
     * Analyze the current page for potential threats
     */
    analyzePage() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.runAnalysis());
      } else {
        this.runAnalysis();
      }
    }

    runAnalysis() {
      const pageInfo = this.getPageInfo();
      
      // Send page info to background for analysis
      chrome.runtime.sendMessage({
        type: 'PAGE_LOADED',
        url: window.location.href,
        pageInfo: pageInfo
      });

      // Check for suspicious elements
      this.checkForPhishingIndicators();
    }

    /**
     * Get information about the current page
     */
    getPageInfo() {
      return {
        url: window.location.href,
        hostname: window.location.hostname,
        title: document.title,
        hasPasswordField: !!document.querySelector('input[type="password"]'),
        hasLoginForm: this.hasLoginForm(),
        externalLinks: this.countExternalLinks(),
        hasSSL: window.location.protocol === 'https:',
        iframes: document.querySelectorAll('iframe').length
      };
    }

    /**
     * Check if page has a login form
     */
    hasLoginForm() {
      const forms = document.querySelectorAll('form');
      
      for (const form of forms) {
        const hasPassword = form.querySelector('input[type="password"]');
        const hasEmail = form.querySelector('input[type="email"]') || 
                        form.querySelector('input[name*="email"]') ||
                        form.querySelector('input[name*="user"]');
        
        if (hasPassword && hasEmail) {
          return true;
        }
      }
      
      return false;
    }

    /**
     * Count external links on the page
     */
    countExternalLinks() {
      const currentHost = window.location.hostname;
      const links = document.querySelectorAll('a[href]');
      let externalCount = 0;
      
      links.forEach(link => {
        try {
          const linkHost = new URL(link.href).hostname;
          if (linkHost && linkHost !== currentHost) {
            externalCount++;
          }
        } catch (e) {
          // Invalid URL, skip
        }
      });
      
      return externalCount;
    }

    /**
     * Check for common phishing indicators
     */
    checkForPhishingIndicators() {
      const indicators = [];
      
      // Check for suspicious URL patterns
      const url = window.location.href.toLowerCase();
      const hostname = window.location.hostname.toLowerCase();
      
      // Check for IP address instead of domain
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        indicators.push('ip_address');
      }
      
      // Check for suspicious keywords in URL
      const suspiciousKeywords = ['login', 'signin', 'secure', 'account', 'update', 'verify', 'confirm'];
      const brandKeywords = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'facebook', 'bank'];
      
      const hasSuspicious = suspiciousKeywords.some(kw => url.includes(kw));
      const hasBrand = brandKeywords.some(kw => hostname.includes(kw) && !this.isOfficialDomain(hostname, kw));
      
      if (hasSuspicious && hasBrand) {
        indicators.push('brand_impersonation');
      }
      
      // Check for data URI or javascript in links
      const links = document.querySelectorAll('a[href^="data:"], a[href^="javascript:"]');
      if (links.length > 0) {
        indicators.push('suspicious_links');
      }
      
      // Check for hidden form fields
      const hiddenFields = document.querySelectorAll('input[type="hidden"]');
      if (hiddenFields.length > 5 && this.hasLoginForm()) {
        indicators.push('excessive_hidden_fields');
      }
      
      // Report indicators to background
      if (indicators.length > 0) {
        chrome.runtime.sendMessage({
          type: 'PHISHING_INDICATORS',
          url: window.location.href,
          indicators: indicators
        });
      }
    }

    /**
     * Check if domain is official for a brand
     */
    isOfficialDomain(hostname, brand) {
      const officialDomains = {
        paypal: ['paypal.com', 'paypal.me'],
        amazon: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.in'],
        google: ['google.com', 'google.co.uk', 'google.de', 'googleapis.com'],
        microsoft: ['microsoft.com', 'live.com', 'outlook.com', 'office.com'],
        apple: ['apple.com', 'icloud.com'],
        facebook: ['facebook.com', 'fb.com', 'meta.com'],
        bank: [] // No official domains for generic "bank"
      };
      
      const domains = officialDomains[brand] || [];
      return domains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    }

    /**
     * Show warning overlay on page
     */
    showWarningOverlay(data) {
      if (this.warningOverlay) return;
      
      this.warningOverlay = document.createElement('div');
      this.warningOverlay.id = 'trinetra-warning-overlay';
      this.warningOverlay.innerHTML = `
        <div class="trinetra-warning-content">
          <div class="trinetra-warning-icon">⚠️</div>
          <h2>Warning: Potential Security Risk</h2>
          <p>${data.message || 'TRINETRA has detected that this site may be dangerous.'}</p>
          <p class="trinetra-warning-details">${data.details || ''}</p>
          <div class="trinetra-warning-actions">
            <button class="trinetra-btn-back">Go Back to Safety</button>
            <button class="trinetra-btn-proceed">Proceed Anyway</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(this.warningOverlay);
      
      // Add event listeners
      this.warningOverlay.querySelector('.trinetra-btn-back').addEventListener('click', () => {
        window.history.back();
      });
      
      this.warningOverlay.querySelector('.trinetra-btn-proceed').addEventListener('click', () => {
        this.hideWarningOverlay();
        chrome.runtime.sendMessage({
          type: 'USER_PROCEEDED',
          url: window.location.href
        });
      });
    }

    /**
     * Hide warning overlay
     */
    hideWarningOverlay() {
      if (this.warningOverlay) {
        this.warningOverlay.remove();
        this.warningOverlay = null;
      }
    }

    /**
     * Highlight potential threats on the page
     */
    highlightThreats(threats) {
      threats.forEach(threat => {
        const elements = document.querySelectorAll(threat.selector);
        elements.forEach(el => {
          el.classList.add('trinetra-threat-highlight');
          el.title = `TRINETRA Warning: ${threat.message}`;
        });
      });
    }
  }

  // Initialize content controller
  new ContentController();
})();
