/**
 * Security Service Tests
 */

import { SecurityService } from '../../src/utils/securityService.js';

describe('SecurityService', () => {
  let security;

  beforeEach(() => {
    security = new SecurityService();
    security.cache.clear();
  });

  describe('checkUrl', () => {
    it('should return safe for normal HTTPS URLs', async () => {
      const result = await security.checkUrl('https://google.com');
      
      expect(result.safe).toBe(true);
    });

    it('should skip internal URLs', async () => {
      const result = await security.checkUrl('chrome://extensions');
      
      expect(result.safe).toBe(true);
    });

    it('should detect unsafe URLs', async () => {
      const result = await security.checkUrl('http://login.some.tk/verify');
      
      expect(result.safe).toBe(false);
      expect(result.threat).toBeDefined();
    });

    it('should cache results', async () => {
      await security.checkUrl('https://example.com');
      const cached = security.getCached('https://example.com');
      
      expect(cached).toBeDefined();
    });

    it('should return cached results on second check', async () => {
      await security.checkUrl('https://example.com');
      const checkSpy = jest.spyOn(security, 'performCheck');
      
      await security.checkUrl('https://example.com');
      
      expect(checkSpy).not.toHaveBeenCalled();
    });
  });

  describe('getChecksForLevel', () => {
    it('should return minimal checks for low level', () => {
      const checks = security.getChecksForLevel('low');
      
      expect(checks).toContain('pattern');
      expect(checks).toContain('safeBrowsing');
      expect(checks).not.toContain('homograph');
    });

    it('should return more checks for medium level', () => {
      const checks = security.getChecksForLevel('medium');
      
      expect(checks).toContain('pattern');
      expect(checks).toContain('tld');
      expect(checks).toContain('ssl');
      expect(checks).toContain('safeBrowsing');
    });

    it('should return all checks for high level', () => {
      const checks = security.getChecksForLevel('high');
      
      expect(checks).toContain('pattern');
      expect(checks).toContain('tld');
      expect(checks).toContain('ssl');
      expect(checks).toContain('ipAddress');
      expect(checks).toContain('homograph');
      expect(checks).toContain('safeBrowsing');
    });
  });

  describe('checkPhishingPatterns', () => {
    it('should detect login.*.tk pattern', () => {
      const result = security.checkPhishingPatterns(new URL('https://login.fake.tk/page'));
      
      expect(result.passed).toBe(false);
      expect(result.threat).toContain('Phishing');
    });

    it('should detect secure.*.cf pattern', () => {
      const result = security.checkPhishingPatterns(new URL('https://secure.bank.cf/'));
      
      expect(result.passed).toBe(false);
    });

    it('should pass for normal URLs', () => {
      const result = security.checkPhishingPatterns(new URL('https://google.com'));
      
      expect(result.passed).toBe(true);
    });
  });

  describe('checkSuspiciousTLD', () => {
    it('should flag .tk domains', () => {
      const result = security.checkSuspiciousTLD(new URL('https://example.tk'));
      
      expect(result.passed).toBe(false);
      expect(result.threat).toContain('Suspicious');
    });

    it('should flag .xyz domains', () => {
      const result = security.checkSuspiciousTLD(new URL('https://example.xyz'));
      
      expect(result.passed).toBe(false);
    });

    it('should pass .com domains', () => {
      const result = security.checkSuspiciousTLD(new URL('https://example.com'));
      
      expect(result.passed).toBe(true);
    });

    it('should pass .org domains', () => {
      const result = security.checkSuspiciousTLD(new URL('https://example.org'));
      
      expect(result.passed).toBe(true);
    });
  });

  describe('checkSSL', () => {
    it('should pass HTTPS URLs', () => {
      const result = security.checkSSL(new URL('https://example.com'));
      
      expect(result.passed).toBe(true);
    });

    it('should flag HTTP URLs', () => {
      const result = security.checkSSL(new URL('http://example.com'));
      
      expect(result.passed).toBe(false);
      expect(result.threat).toContain('Insecure');
    });

    it('should allow localhost HTTP', () => {
      const result = security.checkSSL(new URL('http://localhost:3000'));
      
      expect(result.passed).toBe(true);
    });

    it('should allow 127.0.0.1 HTTP', () => {
      const result = security.checkSSL(new URL('http://127.0.0.1:8080'));
      
      expect(result.passed).toBe(true);
    });
  });

  describe('checkIPAddress', () => {
    it('should flag IP address URLs', () => {
      const result = security.checkIPAddress(new URL('https://192.168.1.1/page'));
      
      expect(result.passed).toBe(false);
      expect(result.threat).toContain('IP address');
    });

    it('should allow localhost (127.0.0.1)', () => {
      const result = security.checkIPAddress(new URL('http://127.0.0.1:3000'));
      
      expect(result.passed).toBe(true);
    });

    it('should pass domain URLs', () => {
      const result = security.checkIPAddress(new URL('https://example.com'));
      
      expect(result.passed).toBe(true);
    });
  });

  describe('checkHomograph', () => {
    it('should flag punycode domains', () => {
      const result = security.checkHomograph(new URL('https://xn--80ak6aa92e.com'));
      
      expect(result.passed).toBe(false);
      expect(result.threat).toContain('homograph');
    });

    it('should detect paypal lookalike', () => {
      const result = security.checkHomograph(new URL('https://paypa1.com'));
      
      expect(result.passed).toBe(false);
      expect(result.details).toContain('paypal');
    });

    it('should detect amazon lookalike', () => {
      const result = security.checkHomograph(new URL('https://arnazon.com'));
      
      expect(result.passed).toBe(false);
      expect(result.details).toContain('amazon');
    });

    it('should detect google lookalike', () => {
      const result = security.checkHomograph(new URL('https://googie.com'));
      
      expect(result.passed).toBe(false);
    });

    it('should pass legitimate domains', () => {
      const result = security.checkHomograph(new URL('https://paypal.com'));
      
      expect(result.passed).toBe(true);
    });
  });

  describe('checkSafeBrowsing', () => {
    it('should flag sites on blocklist', async () => {
      global.__chromeStorageSync.threatBlocklist = ['malicious.com'];
      
      const result = await security.checkSafeBrowsing(new URL('https://malicious.com'));
      
      expect(result.passed).toBe(false);
      expect(result.threat).toContain('malicious');
    });

    it('should pass sites not on blocklist', async () => {
      global.__chromeStorageSync.threatBlocklist = ['malicious.com'];
      
      const result = await security.checkSafeBrowsing(new URL('https://safe.com'));
      
      expect(result.passed).toBe(true);
    });

    it('should handle empty blocklist', async () => {
      const result = await security.checkSafeBrowsing(new URL('https://example.com'));
      
      expect(result.passed).toBe(true);
    });
  });

  describe('isInternalUrl', () => {
    it('should detect chrome:// URLs', () => {
      expect(security.isInternalUrl('chrome://extensions')).toBe(true);
    });

    it('should detect chrome-extension:// URLs', () => {
      expect(security.isInternalUrl('chrome-extension://id/popup.html')).toBe(true);
    });

    it('should detect about: URLs', () => {
      expect(security.isInternalUrl('about:blank')).toBe(true);
    });

    it('should detect file:// URLs', () => {
      expect(security.isInternalUrl('file:///C:/test.html')).toBe(true);
    });

    it('should not flag https:// URLs', () => {
      expect(security.isInternalUrl('https://example.com')).toBe(false);
    });
  });

  describe('caching', () => {
    it('should return null for uncached URL', () => {
      const result = security.getCached('https://new.com');
      
      expect(result).toBeNull();
    });

    it('should store and retrieve cache', () => {
      const testResult = { safe: true, checks: [] };
      
      security.setCache('https://example.com', testResult);
      const cached = security.getCached('https://example.com');
      
      expect(cached).toEqual(testResult);
    });

    it('should expire cache after timeout', () => {
      jest.useFakeTimers();
      
      security.setCache('https://example.com', { safe: true });
      
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes (past 5 min timeout)
      
      const cached = security.getCached('https://example.com');
      
      expect(cached).toBeNull();
      
      jest.useRealTimers();
    });
  });

  describe('reportSite', () => {
    it('should add site to reports', async () => {
      const result = await security.reportSite('https://suspicious.com', 'Looks like phishing');
      
      expect(result.success).toBe(true);
      expect(global.__chromeStorageSync.siteReports).toHaveLength(1);
      expect(global.__chromeStorageSync.siteReports[0].reason).toBe('Looks like phishing');
    });

    it('should keep only last 100 reports', async () => {
      global.__chromeStorageSync.siteReports = new Array(100).fill({
        url: 'https://old.com',
        hostname: 'old.com',
        reason: 'Old report',
        timestamp: Date.now()
      });
      
      await security.reportSite('https://new.com', 'New report');
      
      expect(global.__chromeStorageSync.siteReports).toHaveLength(100);
      expect(global.__chromeStorageSync.siteReports[99].reason).toBe('New report');
    });

    it('should handle invalid URLs gracefully', async () => {
      const result = await security.reportSite('not-a-url', 'Test');
      
      expect(result.success).toBe(false);
    });
  });
});
