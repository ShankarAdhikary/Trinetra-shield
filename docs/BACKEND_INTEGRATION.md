# Backend Integration Guide

## Architecture Overview

TRINETRA uses a Node.js/Express backend deployed on Render. The Chrome extension communicates with the backend via REST API for authentication, data sync, and security checks.

```
Chrome Extension (Frontend)
    ├── popup/       → Main UI
    ├── background/  → Service worker (security checks, time tracking)
    ├── content/     → Page analysis
    ├── options/     → Settings
    └── api/         → apiClient.js → Backend API
              ↓
Backend (Express API)
    ├── /api/auth     → Authentication (email, phone, Google OAuth)
    ├── /api/user     → User profile & settings
    ├── /api/tasks    → Task management
    ├── /api/time     → Time tracking data
    ├── /api/security → URL safety checks
    ├── /api/sync     → Data synchronization
    └── /health       → Health check
```

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | No | Register with email/password |
| POST | `/login` | No | Login with email/password |
| POST | `/phone/send-otp` | No | Send OTP to phone |
| POST | `/phone/verify-otp` | No | Verify OTP & login |
| POST | `/google` | No | Google OAuth login |
| POST | `/refresh` | Bearer | Refresh JWT token |
| POST | `/logout` | Bearer | Logout |
| GET | `/me` | Bearer | Get current user |
| GET | `/config` | No | Get auth config (CAPTCHA keys, enabled providers) |

### User (`/api/user`) — Requires Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get user profile |
| PATCH | `/profile` | Update profile |
| GET | `/settings` | Get user settings |
| PUT | `/settings` | Update settings |
| DELETE | `/account` | Delete account (GDPR) |
| GET | `/data` | Export all user data (GDPR) |

### Tasks (`/api/tasks`) — Requires Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all tasks |
| POST | `/` | Create task |
| PUT | `/:id` | Update task |
| DELETE | `/:id` | Delete task |

### Time Tracking (`/api/time`) — Requires Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/today` | Get today's time data |
| GET | `/range` | Get time data for date range |
| POST | `/track` | Submit time tracking data |

### Security (`/api/security`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/check?url=` | No | Check URL safety |
| POST | `/batch-check` | No | Check multiple URLs |
| POST | `/report` | No | Report malicious URL |
| GET | `/stats` | No | Get threat statistics |
| GET | `/blocklist` | No | Get threat blocklist for auto-update |

### Sync (`/api/sync`) — Requires Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/push` | Push local data to server |
| GET | `/pull` | Pull latest data from server |
| POST | `/full` | Full bidirectional sync |

## Authentication Flow

### JWT Tokens
- Tokens expire after **7 days**
- Tokens can be refreshed within **30 days** of issuance
- Include token in `Authorization: Bearer <token>` header

### Email/Password
```
1. POST /api/auth/signup → { email, password, name, captchaToken }
2. Server hashes password with bcrypt, creates user
3. Returns { user, token }
```

### Phone/OTP
```
1. POST /api/auth/phone/send-otp → { phone, captchaToken }
2. Server generates 6-digit OTP, sends via SMS
3. POST /api/auth/phone/verify-otp → { phone, otp }
4. Returns { user, token, isNewUser }
```

### Google OAuth
```
1. Extension calls chrome.identity.getAuthToken()
2. Fetches user info from Google API
3. POST /api/auth/google → { token, email, name, providerId, picture }
4. Backend verifies token with Google's API
5. Returns { user, token, isNewUser }
```

## Environment Variables

### Required for Production
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<strong-random-secret>
```

### Optional Services
```env
# Google OAuth verification
GOOGLE_CLIENT_ID=<your-google-client-id>

# Google Safe Browsing API
GOOGLE_SAFE_BROWSING_API_KEY=<your-api-key>

# CAPTCHA (Cloudflare Turnstile)
TURNSTILE_SECRET_KEY=<your-secret-key>

# Email (Gmail SMTP)
EMAIL_USER=your.email@gmail.com
EMAIL_APP_PASSWORD=<gmail-app-password>

# Or Generic SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_SECURE=false

# SMS Providers (choose one)
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE_NUMBER=+1234567890

# Or MSG91 (India)
MSG91_AUTH_KEY=<key>
MSG91_TEMPLATE_ID=<template-id>

# Firebase (optional)
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_SERVICE_ACCOUNT=<path-to-service-account.json>

# CORS
ALLOWED_ORIGINS=https://your-domain.com
```

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 200 requests | 15 minutes |
| Auth (signup/login) | 20 requests | 15 minutes |
| OTP send | 5 requests | 1 hour |

## Security Features

- **Helmet** — Security headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** — Configured for Chrome extensions and allowed origins
- **Rate Limiting** — Per-endpoint with express-rate-limit
- **Input Validation** — express-validator on all endpoints
- **JWT** — Stateless authentication with refresh support
- **CAPTCHA** — Cloudflare Turnstile on signup and OTP endpoints
- **Password Hashing** — bcrypt with salt rounds

## Deployment (Render)

The backend is configured for auto-deployment on Render via `render.yaml`:

1. Push code to the `main` branch
2. Render builds and deploys automatically
3. Set environment variables in Render dashboard
4. Health check: `GET /health`

## Local Development

```bash
cd backend
npm install
cp .env.example .env  # Configure your environment
npm run dev            # Starts with nodemon on port 3000
```

## Testing

```bash
cd backend
npm test               # Run all tests
npm run test:coverage  # Run with coverage report
```
