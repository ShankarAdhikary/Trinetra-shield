/**
 * Email Service
 * Production email delivery using Gmail SMTP (free)
 * 
 * Setup:
 * 1. Enable 2FA on your Gmail account
 * 2. Generate App Password: Google Account → Security → App Passwords
 * 3. Set environment variables:
 *    - EMAIL_USER=your.email@gmail.com
 *    - EMAIL_APP_PASSWORD=your-app-password
 */

const nodemailer = require('nodemailer');

const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.EMAIL_USER || 'noreply@trinetra.app';
    this.fromName = 'TRINETRA';
    
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Gmail SMTP configuration
    if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD
        }
      });
      
      logger.info('Email transporter initialized with Gmail');
    } else if (process.env.SMTP_HOST) {
      // Generic SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      logger.info('Email transporter initialized with SMTP');
    } else {
      logger.warn('No email configuration found, emails will be logged only');
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, verificationToken, name = '') {
    const verifyUrl = `${process.env.APP_URL || 'https://trinetra-shield.onrender.com'}/api/auth/verify-email?token=${verificationToken}`;
    
    const html = this.getVerificationEmailTemplate(name || email.split('@')[0], verifyUrl);
    
    return this.sendEmail({
      to: email,
      subject: 'Verify your TRINETRA account',
      html
    });
  }

  /**
   * Send OTP email
   */
  async sendOTPEmail(email, otp, name = '') {
    const html = this.getOTPEmailTemplate(name || email.split('@')[0], otp);
    
    return this.sendEmail({
      to: email,
      subject: `${otp} is your TRINETRA verification code`,
      html
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetToken, name = '') {
    const resetUrl = `${process.env.APP_URL || 'https://trinetra-shield.onrender.com'}/api/auth/reset-password?token=${resetToken}`;
    
    const html = this.getPasswordResetTemplate(name || email.split('@')[0], resetUrl);
    
    return this.sendEmail({
      to: email,
      subject: 'Reset your TRINETRA password',
      html
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, name = '') {
    const html = this.getWelcomeEmailTemplate(name || email.split('@')[0]);
    
    return this.sendEmail({
      to: email,
      subject: 'Welcome to TRINETRA! 🛡️',
      html
    });
  }

  /**
   * Core send email function
   */
  async sendEmail({ to, subject, html, text }) {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
      text: text || this.stripHtml(html)
    };

    if (!this.transporter) {
      // Development mode - just log
      logger.info('DEV MODE - Email would be sent', { 
        to, 
        subject,
        preview: html.substring(0, 200) 
      });
      return { success: true, messageId: 'dev-mode' };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent', { to, subject, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Email send failed', { to, subject, error: error.message });
      throw error;
    }
  }

  /**
   * Email Templates
   */
  getBaseTemplate(content) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TRINETRA</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 30px; text-align: center; }
    .header img { width: 64px; height: 64px; }
    .header h1 { color: white; margin: 10px 0 0 0; font-size: 24px; }
    .content { padding: 30px; }
    .content h2 { color: #1a1a2e; margin: 0 0 15px 0; }
    .content p { color: #4a5568; line-height: 1.6; margin: 0 0 15px 0; }
    .otp-code { background: #f0f9ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .otp-code span { font-size: 32px; font-weight: bold; color: #1a1a2e; letter-spacing: 8px; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 15px 0; }
    .btn:hover { background: #2563eb; }
    .footer { background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ TRINETRA</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© 2026 TRINETRA - Safe & Productive Browsing</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`;
  }

  getVerificationEmailTemplate(name, verifyUrl) {
    return this.getBaseTemplate(`
      <h2>Verify your email, ${name}!</h2>
      <p>Thanks for signing up for TRINETRA. Please verify your email address to complete your registration.</p>
      <p style="text-align: center;">
        <a href="${verifyUrl}" class="btn">Verify Email Address</a>
      </p>
      <p style="font-size: 14px; color: #718096;">This link will expire in 24 hours.</p>
      <p style="font-size: 12px; color: #a0aec0;">If the button doesn't work, copy this link:<br>${verifyUrl}</p>
    `);
  }

  getOTPEmailTemplate(name, otp) {
    return this.getBaseTemplate(`
      <h2>Your verification code</h2>
      <p>Hi ${name}, use this code to verify your TRINETRA account:</p>
      <div class="otp-code">
        <span>${otp}</span>
      </div>
      <p style="font-size: 14px; color: #718096;">This code expires in 5 minutes. Don't share it with anyone.</p>
    `);
  }

  getPasswordResetTemplate(name, resetUrl) {
    return this.getBaseTemplate(`
      <h2>Reset your password</h2>
      <p>Hi ${name}, we received a request to reset your TRINETRA password.</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </p>
      <p style="font-size: 14px; color: #718096;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `);
  }

  getWelcomeEmailTemplate(name) {
    return this.getBaseTemplate(`
      <h2>Welcome to TRINETRA, ${name}! 🎉</h2>
      <p>You're all set! TRINETRA is now protecting your browsing experience.</p>
      <p>Here's what you can do:</p>
      <ul style="color: #4a5568; line-height: 2;">
        <li>🛡️ <strong>Security Protection</strong> - Auto-detect phishing & malicious sites</li>
        <li>📋 <strong>Task Management</strong> - Stay organized with smart tasks</li>
        <li>⏱️ <strong>Time Tracking</strong> - Monitor your browsing habits</li>
        <li>🎯 <strong>Focus Mode</strong> - Block distractions when you need to concentrate</li>
      </ul>
      <p>Questions? Reply to this email - we're here to help!</p>
    `);
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();
