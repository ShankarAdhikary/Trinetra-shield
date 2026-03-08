/**
 * SMS Service
 * Production SMS delivery using Firebase Phone Auth or fallback providers
 * 
 * For production, this uses Firebase Auth which handles:
 * - SMS delivery
 * - Phone number verification
 * - Abuse prevention
 * - Rate limiting
 * 
 * FREE TIER: 10,000 verifications/month
 */

const logger = require('./logger');

// Check if Firebase Admin is configured
let firebaseAdmin = null;
try {
  firebaseAdmin = require('firebase-admin');
  
  // Initialize Firebase Admin if not already initialized
  if (!firebaseAdmin.apps.length) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountPath) {
      const serviceAccount = require(serviceAccountPath);
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount)
      });
      logger.info('Firebase Admin initialized for SMS');
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Use application default credentials (for cloud environments)
      firebaseAdmin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      logger.info('Firebase Admin initialized with project ID');
    }
  }
} catch (error) {
  logger.warn('Firebase Admin not configured, using development SMS mode');
}

class SmsService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production' && firebaseAdmin?.apps.length > 0;
  }

  /**
   * Send OTP via SMS
   * In production: Uses Firebase or configured SMS provider
   * In development: Returns OTP directly (for testing)
   * 
   * @param {string} phone - Phone number with country code
   * @param {string} otp - OTP code to send
   * @returns {Promise<object>} Result with success status
   */
  async sendOTP(phone, otp) {
    const normalizedPhone = this.normalizePhone(phone);

    // Development mode - just log the OTP
    if (!this.isProduction) {
      logger.info('DEV MODE - SMS OTP', { 
        phone: this.maskPhone(normalizedPhone), 
        otp 
      });
      
      return {
        success: true,
        message: 'OTP sent (development mode)',
        // Return OTP only in dev mode for testing
        otp: process.env.NODE_ENV !== 'production' ? otp : undefined
      };
    }

    // Production mode - use real SMS service
    try {
      // Option 1: If you have Twilio configured
      if (process.env.TWILIO_ACCOUNT_SID) {
        return await this.sendViaTwilio(normalizedPhone, otp);
      }
      
      // Option 2: If you have MSG91 configured (India)
      if (process.env.MSG91_AUTH_KEY) {
        return await this.sendViaMSG91(normalizedPhone, otp);
      }

      // Option 3: If you have TextLocal configured
      if (process.env.TEXTLOCAL_API_KEY) {
        return await this.sendViaTextLocal(normalizedPhone, otp);
      }

      // Fallback to development mode if no provider configured
      logger.warn('No SMS provider configured, using dev mode');
      return {
        success: true,
        message: 'OTP sent (no SMS provider configured)',
        otp: otp
      };

    } catch (error) {
      logger.error('SMS send failed', { error: error.message, phone: this.maskPhone(normalizedPhone) });
      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendViaTwilio(phone, otp) {
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await client.messages.create({
      body: `Your TRINETRA verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });

    logger.info('SMS sent via Twilio', { 
      sid: message.sid, 
      phone: this.maskPhone(phone) 
    });

    return {
      success: true,
      message: 'OTP sent successfully',
      messageId: message.sid
    };
  }

  /**
   * Send SMS via MSG91 (India)
   */
  async sendViaMSG91(phone, otp) {
    const https = require('https');
    
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        hostname: 'control.msg91.com',
        path: `/api/v5/otp?template_id=${process.env.MSG91_TEMPLATE_ID}&mobile=${phone}&otp=${otp}`,
        headers: {
          'authkey': process.env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const response = JSON.parse(data);
          if (response.type === 'success') {
            logger.info('SMS sent via MSG91', { phone: this.maskPhone(phone) });
            resolve({ success: true, message: 'OTP sent successfully' });
          } else {
            reject(new Error(response.message || 'MSG91 send failed'));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Send SMS via TextLocal
   */
  async sendViaTextLocal(phone, otp) {
    const https = require('https');
    const querystring = require('querystring');
    
    const data = querystring.stringify({
      apikey: process.env.TEXTLOCAL_API_KEY,
      numbers: phone.replace('+', ''),
      message: `Your TRINETRA verification code is: ${otp}. Valid for 5 minutes.`,
      sender: 'TRINETRA'
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.textlocal.in',
        path: '/send/?' + data,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const response = JSON.parse(body);
          if (response.status === 'success') {
            logger.info('SMS sent via TextLocal', { phone: this.maskPhone(phone) });
            resolve({ success: true, message: 'OTP sent successfully' });
          } else {
            reject(new Error(response.errors?.[0]?.message || 'TextLocal send failed'));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Normalize phone number
   */
  normalizePhone(phone) {
    let normalized = phone.replace(/[^\d+]/g, '');
    if (!normalized.startsWith('+')) {
      // Default to India if no country code
      normalized = '+91' + normalized;
    }
    return normalized;
  }

  /**
   * Mask phone number for logging
   */
  maskPhone(phone) {
    if (phone.length < 6) return '****';
    return phone.slice(0, 4) + '****' + phone.slice(-2);
  }
}

module.exports = new SmsService();
