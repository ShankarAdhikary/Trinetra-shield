# Privacy Policy

**TRINETRA — Safe & Productive Browsing**

*Last updated: March 9, 2026*

## Overview

TRINETRA is a Chrome browser extension designed to protect users from phishing and malicious websites while helping with productivity through task management, time tracking, and focus mode. This privacy policy explains what data we collect, how we use it, and your rights.

## Data We Collect

### 1. Account Information (Optional)

If you create an account to enable cloud sync:

- **Email address** — Used for authentication and account recovery
- **Phone number** — Used for OTP-based authentication (if chosen)
- **Display name** — Shown in your profile
- **Profile picture** — From Google OAuth (if using Google sign-in)

### 2. Browsing Data (Local Only by Default)

- **URLs visited** — Checked against phishing databases for your safety. URLs are processed locally and are NOT sent to our servers unless you enable cloud sync.
- **Time spent per website** — Tracked locally for your productivity dashboard. Only synced to our servers if you enable cloud sync.
- **Page analysis data** — Login forms, SSL status, and suspicious elements are analyzed locally in your browser. This data is never sent to external servers.

### 3. Task Data (Local Only by Default)

- **Tasks you create** — Stored locally in Chrome storage. Only synced to our servers if you enable cloud sync.

### 4. Settings & Preferences

- Theme, security level, blocked sites list, notification preferences — stored locally and optionally synced.

## Data We Do NOT Collect

- Passwords or form inputs
- Browsing history beyond the current session's time tracking
- Personal files or documents
- Keystrokes or screen content
- Data from private/incognito windows (unless explicitly enabled)

## How We Use Your Data

| Data | Purpose | Storage |
|------|---------|---------|
| URLs | Phishing/malware detection | Local (checked against local patterns + optional backend API) |
| Time tracking | Productivity analytics for you | Local (optionally synced) |
| Tasks | Your personal task list | Local (optionally synced) |
| Account info | Authentication & sync | Server (encrypted) |

## Third-Party Services

### Google Safe Browsing API (Optional)
- If configured, URLs may be checked against Google's Safe Browsing database
- Google's privacy policy applies: https://policies.google.com/privacy
- This is an opt-in feature based on backend configuration

### Google OAuth (Optional)
- If you sign in with Google, we receive your name, email, and profile picture from Google
- We do not access any other Google services or data

### Cloudflare Turnstile (CAPTCHA)
- Used during signup and OTP verification to prevent abuse
- Cloudflare's privacy policy applies: https://www.cloudflare.com/privacypolicy/

## Data Storage & Security

- **Local data** is stored in Chrome's extension storage (`chrome.storage.local`)
- **Server data** is stored on our backend hosted on Render
- Passwords are hashed using bcrypt (never stored in plain text)
- API communication uses HTTPS encryption
- JWT tokens expire after 7 days
- Backend uses security headers (Helmet), rate limiting, and input validation

## Data Retention

- **Local data** persists until you clear it or uninstall the extension
- **Server data** is retained while your account is active
- **Account deletion** permanently removes all your server-side data
- **Data export** is available at any time (Options → Account → Export Data)

## Your Rights (GDPR Compliance)

You have the right to:

1. **Access** — Export all your data (Options → Account → Export Data)
2. **Rectification** — Update your profile information at any time
3. **Erasure** — Delete your account and all associated data (Options → Account → Delete Account)
4. **Portability** — Export your data in JSON format
5. **Restriction** — Disable cloud sync to keep all data local only

## Children's Privacy

TRINETRA does not knowingly collect data from children under 13. If you believe a child has provided us with personal information, please contact us.

## Changes to This Policy

We may update this privacy policy. Changes will be posted in the extension's GitHub repository and the Chrome Web Store listing.

## Contact

For privacy questions or data requests:

- **GitHub:** [https://github.com/ShankarAdhikary/Trinetra-shield/issues](https://github.com/ShankarAdhikary/Trinetra-shield/issues)
- **Email:** Contact via GitHub Issues

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `storage` | Save your settings, tasks, and time data locally |
| `notifications` | Show security alerts and break reminders |
| `alarms` | Schedule periodic tasks (sync, break reminders, daily summary) |
| `tabs` | Track active tab for time tracking and security checks |
| `activeTab` | Analyze the current page for phishing indicators |
| `identity` | Google OAuth sign-in |
| `webNavigation` | Check URLs before pages load for phishing protection |
