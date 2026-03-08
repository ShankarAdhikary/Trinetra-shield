/**
 * Login Page Script
 * Handles Email, Phone, and Google authentication
 * Includes CAPTCHA verification via Cloudflare Turnstile
 */

/* global turnstile */

import { AuthService } from '../api/authService.js';
import { ApiClient } from '../api/apiClient.js';

class LoginPage {
  constructor() {
    this.auth = new AuthService();
    this.api = new ApiClient();
    this.isSignupMode = false;
    this.currentPhone = '';
    this.resendTimerInterval = null;
    this.captchaConfig = null;
    this.captchaWidgets = {};
    
    this.init();
  }

  async init() {
    await this.loadCaptchaConfig();
    this.bindElements();
    this.bindEvents();
    this.initCaptcha();
    this.checkExistingAuth();
    this.handleTabFromUrl();
  }

  /**
   * Load CAPTCHA configuration from backend
   */
  async loadCaptchaConfig() {
    try {
      this.captchaConfig = await this.api.get('/api/auth/config');
    } catch (error) {
      console.warn('Failed to load CAPTCHA config:', error);
      this.captchaConfig = { captcha: { enabled: false } };
    }
  }

  /**
   * Initialize CAPTCHA widgets
   */
  initCaptcha() {
    if (!this.captchaConfig?.captcha?.enabled) {
      // Hide captcha containers if not enabled
      document.querySelectorAll('.captcha-container').forEach(el => {
        el.style.display = 'none';
      });
      return;
    }

    const siteKey = this.captchaConfig.captcha.siteKey;
    if (!siteKey) return;

    // Wait for Turnstile to load
    if (typeof turnstile === 'undefined') {
      window.addEventListener('load', () => this.renderCaptchaWidgets(siteKey));
    } else {
      this.renderCaptchaWidgets(siteKey);
    }
  }

  renderCaptchaWidgets(siteKey) {
    // Render for email form
    const emailContainer = document.getElementById('email-captcha');
    if (emailContainer && typeof turnstile !== 'undefined') {
      this.captchaWidgets.email = turnstile.render(emailContainer, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => { this.captchaWidgets.emailToken = token; }
      });
    }

    // Render for phone form
    const phoneContainer = document.getElementById('phone-captcha');
    if (phoneContainer && typeof turnstile !== 'undefined') {
      this.captchaWidgets.phone = turnstile.render(phoneContainer, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => { this.captchaWidgets.phoneToken = token; }
      });
    }
  }

  getCaptchaToken(formType) {
    if (!this.captchaConfig?.captcha?.enabled) {
      return null;
    }
    return formType === 'email' ? this.captchaWidgets.emailToken : this.captchaWidgets.phoneToken;
  }

  resetCaptcha(formType) {
    if (typeof turnstile !== 'undefined' && this.captchaWidgets[formType]) {
      turnstile.reset(this.captchaWidgets[formType]);
    }
  }

  handleTabFromUrl() {
    // Check if a specific tab was requested via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTab = urlParams.get('tab');
    
    if (requestedTab && ['email', 'phone', 'google'].includes(requestedTab)) {
      this.switchTab(requestedTab);
    }
  }

  bindElements() {
    // Tabs
    this.authTabs = document.querySelectorAll('.auth-tab');
    this.authForms = document.querySelectorAll('.auth-form');

    // Messages
    this.errorMessage = document.getElementById('error-message');
    this.successMessage = document.getElementById('success-message');

    // Email form
    this.emailForm = document.getElementById('email-auth-form');
    this.emailInput = document.getElementById('email');
    this.passwordInput = document.getElementById('password');
    this.nameInput = document.getElementById('name');
    this.nameGroup = document.getElementById('name-group');
    this.emailSubmitBtn = document.getElementById('email-submit-btn');
    this.toggleAuthMode = document.getElementById('toggle-auth-mode');
    this.toggleText = document.getElementById('toggle-text');
    this.passwordRequirements = document.getElementById('password-requirements');

    // Phone form
    this.phoneSendForm = document.getElementById('phone-send-form');
    this.phoneEntry = document.getElementById('phone-entry');
    this.otpEntry = document.getElementById('otp-entry');
    this.countryCodeInput = document.getElementById('country-code');
    this.phoneInput = document.getElementById('phone');
    this.sendOtpBtn = document.getElementById('send-otp-btn');
    this.otpInputs = document.querySelectorAll('.otp-input');
    this.verifyOtpBtn = document.getElementById('verify-otp-btn');
    this.resendOtpBtn = document.getElementById('resend-otp-btn');
    this.resendTimer = document.getElementById('resend-timer');
    this.otpPhoneDisplay = document.getElementById('otp-phone-display');
    this.changePhoneLink = document.getElementById('change-phone');

    // Google form
    this.googleSignInBtn = document.getElementById('google-signin-btn');
  }

  bindEvents() {
    // Tab switching
    this.authTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Email form
    this.emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
    this.toggleAuthMode.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleEmailMode();
    });

    // Phone form
    this.phoneSendForm.addEventListener('submit', (e) => this.handleSendOTP(e));
    this.verifyOtpBtn.addEventListener('click', () => this.handleVerifyOTP());
    this.resendOtpBtn.addEventListener('click', () => this.handleResendOTP());
    this.changePhoneLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showPhoneEntry();
    });

    // OTP input auto-focus
    this.otpInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        if (e.target.value && index < this.otpInputs.length - 1) {
          this.otpInputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          this.otpInputs[index - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6);
        pastedData.split('').forEach((char, i) => {
          if (this.otpInputs[i]) {
            this.otpInputs[i].value = char;
          }
        });
      });
    });

    // Google sign in
    this.googleSignInBtn.addEventListener('click', () => this.handleGoogleSignIn());
  }

  async checkExistingAuth() {
    try {
      const isAuthenticated = await this.auth.isAuthenticated();
      if (isAuthenticated) {
        this.redirectToPopup();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  }

  switchTab(tabName) {
    // Update tabs
    this.authTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update forms
    this.authForms.forEach(form => {
      form.classList.remove('active');
    });
    document.getElementById(`${tabName}-form`).classList.add('active');

    // Clear messages
    this.hideMessages();
  }

  toggleEmailMode() {
    this.isSignupMode = !this.isSignupMode;

    if (this.isSignupMode) {
      this.emailSubmitBtn.textContent = 'Create Account';
      this.toggleText.textContent = 'Already have an account?';
      this.toggleAuthMode.textContent = 'Sign In';
      this.nameGroup.style.display = 'block';
      this.passwordRequirements.style.display = 'block';
    } else {
      this.emailSubmitBtn.textContent = 'Sign In';
      this.toggleText.textContent = "Don't have an account?";
      this.toggleAuthMode.textContent = 'Sign Up';
      this.nameGroup.style.display = 'none';
      this.passwordRequirements.style.display = 'none';
    }

    this.hideMessages();
  }

  async handleEmailSubmit(e) {
    e.preventDefault();
    this.hideMessages();

    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;
    const name = this.nameInput.value.trim();
    const captchaToken = this.getCaptchaToken('email');

    this.setLoading(this.emailSubmitBtn, true);

    try {
      if (this.isSignupMode) {
        await this.auth.signupWithEmail(email, password, name, captchaToken);
        this.showSuccess('Account created successfully!');
      } else {
        await this.auth.loginWithEmail(email, password, captchaToken);
      }

      setTimeout(() => this.redirectToPopup(), 500);
    } catch (error) {
      this.showError(error.message || 'Authentication failed');
      this.resetCaptcha('email');
    } finally {
      this.setLoading(this.emailSubmitBtn, false);
    }
  }

  async handleSendOTP(e) {
    e.preventDefault();
    this.hideMessages();

    const countryCode = this.countryCodeInput.value.trim();
    const phone = this.phoneInput.value.trim();
    const captchaToken = this.getCaptchaToken('phone');
    this.currentPhone = countryCode + phone;

    this.setLoading(this.sendOtpBtn, true);

    try {
      const result = await this.auth.sendOTP(this.currentPhone, captchaToken);
      
      if (result.success) {
        this.showOTPEntry();
        this.startResendTimer();
        
        // Show OTP in dev mode (remove in production)
        if (result.otp) {
          console.log('DEV MODE - OTP:', result.otp);
          this.showSuccess(`OTP sent! (Dev: ${result.otp})`);
        } else {
          this.showSuccess('OTP sent to your phone');
        }
      }
    } catch (error) {
      this.showError(error.message || 'Failed to send OTP');
      this.resetCaptcha('phone');
    } finally {
      this.setLoading(this.sendOtpBtn, false);
    }
  }

  showOTPEntry() {
    this.phoneEntry.classList.remove('active');
    this.phoneEntry.style.display = 'none';
    this.otpEntry.classList.add('active');
    this.otpPhoneDisplay.textContent = this.currentPhone;
    this.otpInputs[0].focus();
  }

  showPhoneEntry() {
    this.otpEntry.classList.remove('active');
    this.phoneEntry.classList.add('active');
    this.phoneEntry.style.display = 'block';
    this.clearOTPInputs();
    this.hideMessages();
    if (this.resendTimerInterval) {
      clearInterval(this.resendTimerInterval);
    }
  }

  clearOTPInputs() {
    this.otpInputs.forEach(input => {
      input.value = '';
    });
  }

  getOTPValue() {
    return Array.from(this.otpInputs).map(input => input.value).join('');
  }

  async handleVerifyOTP() {
    this.hideMessages();

    const otp = this.getOTPValue();
    if (otp.length !== 6) {
      this.showError('Please enter the complete 6-digit OTP');
      return;
    }

    this.setLoading(this.verifyOtpBtn, true);

    try {
      const result = await this.auth.verifyOTP(this.currentPhone, otp);
      
      if (result.isNewUser) {
        this.showSuccess('Welcome to TRINETRA!');
      } else {
        this.showSuccess('Login successful!');
      }

      setTimeout(() => this.redirectToPopup(), 500);
    } catch (error) {
      this.showError(error.message || 'OTP verification failed');
      this.clearOTPInputs();
      this.otpInputs[0].focus();
    } finally {
      this.setLoading(this.verifyOtpBtn, false);
    }
  }

  async handleResendOTP() {
    this.hideMessages();
    this.resendOtpBtn.disabled = true;

    try {
      const result = await this.auth.sendOTP(this.currentPhone);
      
      if (result.success) {
        this.startResendTimer();
        
        if (result.otp) {
          this.showSuccess(`OTP resent! (Dev: ${result.otp})`);
        } else {
          this.showSuccess('OTP resent to your phone');
        }
      }
    } catch (error) {
      this.showError(error.message || 'Failed to resend OTP');
      this.resendOtpBtn.disabled = false;
    }
  }

  startResendTimer() {
    let seconds = 30;
    this.resendOtpBtn.disabled = true;
    this.resendTimer.textContent = seconds;
    this.resendOtpBtn.innerHTML = `Resend OTP in <span id="resend-timer">${seconds}</span>s`;

    if (this.resendTimerInterval) {
      clearInterval(this.resendTimerInterval);
    }

    this.resendTimerInterval = setInterval(() => {
      seconds--;
      this.resendTimer.textContent = seconds;

      if (seconds <= 0) {
        clearInterval(this.resendTimerInterval);
        this.resendOtpBtn.disabled = false;
        this.resendOtpBtn.textContent = 'Resend OTP';
      }
    }, 1000);
  }

  async handleGoogleSignIn() {
    this.hideMessages();
    this.setLoading(this.googleSignInBtn, true);

    try {
      const result = await this.auth.loginWithGoogle();
      
      if (result.isNewUser) {
        this.showSuccess('Welcome to TRINETRA!');
      } else {
        this.showSuccess('Login successful!');
      }

      setTimeout(() => this.redirectToPopup(), 500);
    } catch (error) {
      this.showError(error.message || 'Google sign-in failed');
    } finally {
      this.setLoading(this.googleSignInBtn, false);
    }
  }

  setLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = '<span class="loading"></span>';
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.add('show');
    this.successMessage.classList.remove('show');
  }

  showSuccess(message) {
    this.successMessage.textContent = message;
    this.successMessage.classList.add('show');
    this.errorMessage.classList.remove('show');
  }

  hideMessages() {
    this.errorMessage.classList.remove('show');
    this.successMessage.classList.remove('show');
  }

  redirectToPopup() {
    // Close this window and the popup will show authenticated state
    if (window.opener) {
      window.opener.location.reload();
      window.close();
    } else {
      // If opened directly, redirect to popup
      window.location.href = '../popup/popup.html';
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LoginPage();
});
