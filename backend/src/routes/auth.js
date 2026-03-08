/**
 * Authentication Routes
 * Supports Email/Password, Phone/OTP, and Google OAuth
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const UserService = require('../services/userService');
const otpService = require('../services/otpService');
const captchaService = require('../services/captchaService');
const emailService = require('../services/emailService');
const logger = require('../services/logger');

const userService = new UserService();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '7d';

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// CAPTCHA verification middleware
const verifyCaptcha = async (req, res, next) => {
  const captchaToken = req.body.captchaToken || req.headers['x-captcha-token'];
  const clientIp = req.ip || req.headers['x-forwarded-for'];
  
  const result = await captchaService.verify(captchaToken, clientIp);
  
  if (!result.success && captchaService.isActive()) {
    return res.status(400).json({ 
      error: result.error || 'CAPTCHA verification failed',
      captchaRequired: true
    });
  }
  
  next();
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, phone: user.phone },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

// ============================================
// EMAIL/PASSWORD AUTHENTICATION
// ============================================

/**
 * POST /api/auth/signup
 * Register a new user with email and password
 */
router.post('/signup', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  handleValidation,
  verifyCaptcha
], async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create new user
    const user = await userService.create({
      id: uuidv4(),
      email,
      password, // Will be hashed in userService
      name: name || email.split('@')[0],
      provider: 'email',
      createdAt: new Date().toISOString()
    });

    logger.info('New user registered with email', { userId: user.id, email });

    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail(email, user.name).catch(err => {
      logger.error('Failed to send welcome email', { error: err.message });
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation
], async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await userService.findByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.provider !== 'email') {
      return res.status(401).json({ 
        error: `This email is registered with ${user.provider}. Please use ${user.provider} to login.` 
      });
    }

    const isValid = await userService.verifyPassword(user, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    logger.info('User logged in with email', { userId: user.id, email });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PHONE/OTP AUTHENTICATION
// ============================================

/**
 * POST /api/auth/phone/send-otp
 * Send OTP to phone number
 */
router.post('/phone/send-otp', [
  body('phone').matches(/^\+?[1-9]\d{6,14}$/).withMessage('Invalid phone number'),
  handleValidation,
  verifyCaptcha
], async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Generate and send OTP
    const otp = await otpService.createOTP(phone);
    const result = await otpService.sendOTP(phone, otp);

    const isProduction = process.env.NODE_ENV === 'production';

    res.json({
      success: true,
      message: result.message || 'OTP sent successfully',
      // Never expose OTP in production
      ...(!isProduction && result.otp ? { otp: result.otp } : {})
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/phone/verify-otp
 * Verify OTP and login/register user
 */
router.post('/phone/verify-otp', [
  body('phone').matches(/^\+?[1-9]\d{6,14}$/).withMessage('Invalid phone number'),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Invalid OTP'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  handleValidation
], async (req, res, next) => {
  try {
    const { phone, otp, name } = req.body;

    // Verify OTP
    const isValid = await otpService.verifyOTP(phone, otp);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    const normalizedPhone = otpService.normalizePhone(phone);

    // Find or create user
    let user = await userService.findByPhone(normalizedPhone);
    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await userService.create({
        id: uuidv4(),
        phone: normalizedPhone,
        name: name || `User ${normalizedPhone.slice(-4)}`,
        provider: 'phone',
        createdAt: new Date().toISOString()
      });
      isNewUser = true;

      logger.info('New user registered with phone', { userId: user.id });
    } else {
      logger.info('User logged in with phone', { userId: user.id });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email
      },
      token,
      isNewUser
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GOOGLE OAUTH AUTHENTICATION
// ============================================

/**
 * POST /api/auth/google
 * Authenticate with Google OAuth token
 */
router.post('/google', [
  body('token').notEmpty().withMessage('Token is required'),
  body('email').isEmail().withMessage('Invalid email'),
  body('name').optional().trim(),
  handleValidation
], async (req, res, next) => {
  try {
    const { token, email, name, providerId, picture } = req.body;

    // Verify the Google OAuth token with Google's API
    let verifiedEmail = email;
    let verifiedName = name;
    let verifiedPicture = picture;
    let verifiedProviderId = providerId;

    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }

      const googleUser = await response.json();

      // Use verified data from Google instead of client-provided data
      verifiedEmail = googleUser.email;
      verifiedName = googleUser.name || name;
      verifiedPicture = googleUser.picture || picture;
      verifiedProviderId = googleUser.id || providerId;

      if (!googleUser.verified_email) {
        return res.status(401).json({ error: 'Google email not verified' });
      }
    } catch (verifyError) {
      logger.error('Google token verification failed', { error: verifyError.message });
      return res.status(401).json({ error: 'Failed to verify Google token' });
    }

    // Find or create user
    let user = await userService.findByEmail(verifiedEmail);
    let isNewUser = false;

    if (!user) {
      user = await userService.create({
        id: uuidv4(),
        email: verifiedEmail,
        name: verifiedName || verifiedEmail.split('@')[0],
        provider: 'google',
        providerId: verifiedProviderId,
        picture: verifiedPicture,
        createdAt: new Date().toISOString()
      });
      isNewUser = true;

      logger.info('New user registered with Google', { userId: user.id, email: verifiedEmail });
    } else {
      // Update Google-specific fields if needed
      if (user.provider === 'google') {
        await userService.update(user.id, { picture: verifiedPicture, name: verifiedName || user.name });
      }
      
      logger.info('User logged in with Google', { userId: user.id, email: verifiedEmail });
    }

    const jwtToken = generateToken(user);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      token: jwtToken,
      isNewUser
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LEGACY REGISTER ENDPOINT (for backwards compatibility)
// ============================================

/**
 * POST /api/auth/register
 * Register/login via OAuth (legacy endpoint)
 */
router.post('/register', [
  body('provider').isIn(['google', 'email', 'phone']).withMessage('Invalid provider'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  handleValidation
], async (req, res, next) => {
  try {
    const { provider, providerId, email, name, phone } = req.body;

    let user;

    if (provider === 'phone') {
      const normalizedPhone = otpService.normalizePhone(phone);
      user = await userService.findByPhone(normalizedPhone);
    } else {
      user = await userService.findByEmail(email);
    }

    if (!user) {
      user = await userService.create({
        id: uuidv4(),
        email,
        phone: phone ? otpService.normalizePhone(phone) : undefined,
        name: name || (email ? email.split('@')[0] : `User`),
        provider,
        providerId,
        createdAt: new Date().toISOString()
      });

      logger.info('New user registered', { userId: user.id, provider });
    } else {
      logger.info('User logged in', { userId: user.id, provider });
    }

    const jwtToken = generateToken(user);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name
      },
      token: jwtToken
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        ignoreExpiration: true
      });

      // Only allow refresh if token is not too old (within 30 days)
      const tokenAge = Date.now() / 1000 - decoded.iat;
      if (tokenAge > 30 * 24 * 60 * 60) {
        return res.status(401).json({ error: 'Token too old, please login again' });
      }

      const newToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email, phone: decoded.phone },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      res.json({ token: newToken });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', (req, res) => {
  // JWT tokens are stateless, so we just acknowledge the logout
  // In a production app, you might want to blacklist the token
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await userService.findById(decoded.userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          picture: user.picture,
          settings: user.settings
        }
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/config
 * Get public configuration for auth (CAPTCHA keys, etc.)
 */
router.get('/config', (req, res) => {
  res.json({
    captcha: {
      enabled: captchaService.isActive(),
      siteKey: captchaService.getSiteKey(),
      provider: 'turnstile' // cloudflare turnstile
    },
    providers: {
      email: true,
      phone: true,
      google: !!process.env.GOOGLE_CLIENT_ID
    }
  });
});

module.exports = router;
