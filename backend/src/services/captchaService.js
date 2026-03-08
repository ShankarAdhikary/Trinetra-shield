/**
 * CAPTCHA Service
 * Cloudflare Turnstile verification (FREE forever)
 * 
 * Setup:
 * 1. Go to: https://dash.cloudflare.com/sign-up
 * 2. Navigate to: Turnstile → Add Site
 * 3. Get Site Key and Secret Key
 * 4. Set environment variables:
 *    - TURNSTILE_SITE_KEY=your-site-key (for frontend)
 *    - TURNSTILE_SECRET_KEY=your-secret-key (for backend)
 * 
 * FREE: Unlimited verifications, no rate limits
 */

const https = require('https');

const logger = require('./logger');

class CaptchaService {
  constructor() {
    this.secretKey = process.env.TURNSTILE_SECRET_KEY;
    this.isEnabled = !!this.secretKey && process.env.NODE_ENV === 'production';
    
    if (!this.isEnabled) {
      logger.warn('CAPTCHA verification disabled (dev mode or no secret key)');
    }
  }

  /**
   * Verify Turnstile CAPTCHA token
   * @param {string} token - Turnstile response token from frontend
   * @param {string} remoteip - User's IP address (optional)
   * @returns {Promise<object>} Verification result
   */
  async verify(token, remoteip = null) {
    // Skip verification in development
    if (!this.isEnabled) {
      logger.debug('CAPTCHA verification skipped (dev mode)');
      return { success: true, score: 1.0 };
    }

    if (!token) {
      logger.warn('CAPTCHA token missing');
      return { success: false, error: 'CAPTCHA verification required' };
    }

    try {
      const result = await this.verifyWithTurnstile(token, remoteip);
      
      if (result.success) {
        logger.info('CAPTCHA verified successfully');
        return { success: true, score: 1.0 };
      } else {
        logger.warn('CAPTCHA verification failed', { 
          errorCodes: result['error-codes'] 
        });
        return { 
          success: false, 
          error: 'CAPTCHA verification failed. Please try again.',
          codes: result['error-codes']
        };
      }
    } catch (error) {
      logger.error('CAPTCHA verification error', { error: error.message });
      // Don't block user on CAPTCHA service errors
      return { success: true, error: 'CAPTCHA service unavailable' };
    }
  }

  /**
   * Verify with Cloudflare Turnstile API
   */
  verifyWithTurnstile(token, remoteip) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        secret: this.secretKey,
        response: token,
        remoteip: remoteip
      });

      const options = {
        hostname: 'challenges.cloudflare.com',
        path: '/turnstile/v0/siteverify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid CAPTCHA response'));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Get site key for frontend
   */
  getSiteKey() {
    return process.env.TURNSTILE_SITE_KEY || null;
  }

  /**
   * Check if CAPTCHA is enabled
   */
  isActive() {
    return this.isEnabled;
  }
}

module.exports = new CaptchaService();
