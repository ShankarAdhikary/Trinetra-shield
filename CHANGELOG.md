# Changelog

All notable changes to the TRINETRA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-09

### Added

#### Security
- Phishing detection with pattern matching, suspicious TLD checks, and homograph attack detection
- Google Safe Browsing API integration for comprehensive URL safety checks
- Real-time URL checking on navigation via `webNavigation` API
- Content script analysis: detects login forms, password fields, brand impersonation
- Blocked page with warning UI for dangerous sites
- Security threat notifications with Chrome notifications API
- Automatic threat blocklist updates from backend (every 6 hours)
- URL safety check caching (5-minute TTL) for performance
- User-reported threat submissions
- Whitelist support to skip checks on trusted domains

#### Authentication
- Email/password authentication with bcrypt password hashing
- Phone/OTP authentication with SMS delivery (Twilio, MSG91, TextLocal)
- Google OAuth login with server-side token verification
- JWT-based sessions with 7-day expiry and 30-day refresh window
- Cloudflare Turnstile CAPTCHA on signup and OTP endpoints
- Account deletion with full data cleanup (GDPR compliance)
- Multi-provider support detection in `/api/auth/config`

#### Productivity
- Task management: create, edit, delete, toggle completion
- Task priority levels, tags, and due dates
- Time tracking per website with daily and weekly summaries
- Focus Mode with customizable Pomodoro timer (default: 25 minutes)
- Configurable blocked sites list for Focus Mode
- Break reminders at configurable intervals
- Daily browsing summary notifications

#### Data Sync
- Cloud synchronization for tasks, time data, and settings
- Conflict resolution with client-wins strategy
- Automatic sync every 5 minutes when authenticated
- Manual sync trigger from popup UI
- Offline support with local storage fallback
- Connection status indicator (synced, syncing, offline, error)

#### Backend
- Express.js REST API with comprehensive security headers (Helmet)
- Rate limiting: general (200/15min), auth (20/15min), OTP (5/hour)
- Input validation with express-validator on all endpoints
- CORS configured for Chrome extensions
- JSON file-based database with debounced writes
- Winston logger with file rotation
- Error handling middleware with production-safe error messages
- Health check endpoint for monitoring
- Render deployment configuration (render.yaml)
- Docker support (Dockerfile)

#### UI/UX
- Popup with tabbed interface (Security, Tasks, Time, Focus)
- Options page with categorized settings
- Light/dark theme support
- Login page with email, phone, and Google OAuth tabs
- Profile section with avatar and sync status
- Data export in JSON format

#### DevOps
- GitHub Actions CI/CD (ci.yml, deploy-backend.yml, release.yml)
- Jest test suite with jsdom environment
- Webpack build configuration
- ESLint and Prettier code formatting
- Husky pre-commit hooks
- Issue and PR templates

#### Documentation
- README with features, setup, and usage instructions
- QUICKSTART guide for developers
- Backend Integration Guide (API documentation)
- Troubleshooting Guide
- Privacy Policy
- Contributing guidelines

### Security
- Google OAuth tokens now verified server-side against Google's API
- OTP codes no longer returned in API responses in production mode
- Password validation requires uppercase, lowercase, and number
- All user input sanitized and validated before processing
