/**
 * OTP Service
 * Handles One-Time Password generation and verification for phone authentication
 */

const crypto = require('crypto');

const logger = require('./logger');

// In-memory OTP store (use Redis in production)
const otpStore = new Map();

// OTP expiry time in milliseconds (5 minutes)
const OTP_EXPIRY = 5 * 60 * 1000;

class OtpService {
  /**
   * Generate a 6-digit OTP
   * @returns {string} 6-digit OTP code
   */
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Store OTP for a phone number
   * @param {string} phone - Phone number
   * @returns {string} Generated OTP
   */
  async createOTP(phone) {
    const normalizedPhone = this.normalizePhone(phone);
    const otp = this.generateOTP();
    
    otpStore.set(normalizedPhone, {
      code: otp,
      expiresAt: Date.now() + OTP_EXPIRY,
      attempts: 0
    });

    logger.info('OTP created for phone', { phone: this.maskPhone(normalizedPhone) });
    
    return otp;
  }

  /**
   * Verify OTP for a phone number
   * @param {string} phone - Phone number
   * @param {string} code - OTP code to verify
   * @returns {boolean} True if OTP is valid
   */
  async verifyOTP(phone, code) {
    const normalizedPhone = this.normalizePhone(phone);
    const stored = otpStore.get(normalizedPhone);

    if (!stored) {
      logger.warn('OTP not found for phone', { phone: this.maskPhone(normalizedPhone) });
      return false;
    }

    // Check if expired
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(normalizedPhone);
      logger.warn('OTP expired for phone', { phone: this.maskPhone(normalizedPhone) });
      return false;
    }

    // Check attempts (max 3)
    if (stored.attempts >= 3) {
      otpStore.delete(normalizedPhone);
      logger.warn('OTP max attempts exceeded', { phone: this.maskPhone(normalizedPhone) });
      return false;
    }

    stored.attempts++;

    if (stored.code !== code) {
      logger.warn('OTP verification failed', { 
        phone: this.maskPhone(normalizedPhone),
        attempts: stored.attempts 
      });
      return false;
    }

    // OTP verified successfully, remove it
    otpStore.delete(normalizedPhone);
    logger.info('OTP verified successfully', { phone: this.maskPhone(normalizedPhone) });
    
    return true;
  }

  /**
   * Normalize phone number (remove spaces, add country code if missing)
   * @param {string} phone - Phone number
   * @returns {string} Normalized phone number
   */
  normalizePhone(phone) {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');
    
    // Add default country code if not present
    if (!normalized.startsWith('+')) {
      normalized = '+91' + normalized; // Default to India
    }
    
    return normalized;
  }

  /**
   * Mask phone number for logging
   * @param {string} phone - Phone number
   * @returns {string} Masked phone number
   */
  maskPhone(phone) {
    if (phone.length < 6) return '****';
    return phone.slice(0, 4) + '****' + phone.slice(-2);
  }

  /**
   * Send OTP via SMS using the SMS service
   * @param {string} phone - Phone number
   * @param {string} otp - OTP code
   * @returns {Promise<object>} Result with success status
   */
  async sendOTP(phone, otp) {
    const smsService = require('./smsService');
    return smsService.sendOTP(phone, otp);
  }

  /**
   * Clean up expired OTPs (call this periodically)
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [phone, data] of otpStore.entries()) {
      if (now > data.expiresAt) {
        otpStore.delete(phone);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired OTPs`);
    }
  }
}

// Run cleanup every minute
const otpService = new OtpService();
setInterval(() => otpService.cleanup(), 60000);

module.exports = otpService;
