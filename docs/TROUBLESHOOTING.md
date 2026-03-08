# Troubleshooting Guide

## Common Issues

### Extension Not Loading

**Symptoms:** Extension icon doesn't appear in Chrome toolbar.

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** and select the `src/` folder (or `dist/` if built)
4. Check for errors — click **Errors** button on the extension card
5. Make sure `manifest.json` is valid JSON

**Fix for "service worker registration failed":**
- Ensure `background/background.js` exists and has no syntax errors
- Check Chrome console (`chrome://extensions/` → extension → **Inspect views: service worker**)

---

### Google Login Not Working

**Symptoms:** "Google OAuth not configured" error or blank popup.

1. **Get a Google Client ID:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project → APIs & Services → Credentials
   - Create **OAuth 2.0 Client ID** (type: Chrome Extension)
   - Add your extension ID (found at `chrome://extensions/`)

2. **Update manifest.json:**
   ```json
   "oauth2": {
     "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["openid", "email", "profile"]
   }
   ```

3. **Update backend:**
   Set `GOOGLE_CLIENT_ID` environment variable to the same Client ID.

4. **Reload the extension** at `chrome://extensions/`

---

### Backend Connection Failed

**Symptoms:** "Offline" status, sync not working, "Server unavailable".

1. **Check backend is running:**
   ```bash
   curl https://trinetra-shield.onrender.com/health
   ```
   Expected: `{"status":"ok","timestamp":"..."}`

2. **If running locally:**
   ```bash
   cd backend
   npm run dev
   curl http://localhost:3000/health
   ```

3. **Render free tier cold starts:**
   - Free Render instances spin down after 15 minutes of inactivity
   - First request after idle takes 30-60 seconds
   - The extension handles this gracefully — data is saved locally

4. **CORS errors:**
   - Chrome extensions should work without CORS issues (origin is `chrome-extension://`)
   - If testing from a web page, add the origin to `ALLOWED_ORIGINS` env var

---

### OTP Not Received

**Symptoms:** "OTP sent" message but no SMS arrives.

1. **Development mode:** If no SMS provider is configured, the OTP is logged to the server console and returned in the API response (dev mode only).

2. **Production SMS setup (choose one):**
   - **Twilio:** Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
   - **MSG91 (India):** Set `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`
   - **TextLocal:** Set `TEXTLOCAL_API_KEY`

3. **Check phone number format:** Must include country code (e.g., `+1234567890`)

4. **Rate limit:** Only 5 OTP requests per hour per IP address

---

### Emails Not Sending

**Symptoms:** Welcome email or verification email not received.

1. **Check backend logs** for "DEV MODE - Email would be sent" messages
2. **Configure Gmail SMTP:**
   - Enable 2-Factor Authentication on your Gmail account
   - Generate App Password: Google Account → Security → App Passwords
   - Set env vars: `EMAIL_USER=you@gmail.com`, `EMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx`
3. **Or use generic SMTP:** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
4. Check spam/junk folder

---

### Phishing Detection Not Working

**Symptoms:** Known phishing sites not being blocked.

1. **Check security settings:** Open extension options → Security → ensure "Phishing Protection" is enabled
2. **Check security level:** Set to "Medium" or "High" for more thorough checks
3. **Whitelisted sites** won't be checked — review your whitelist in options
4. **Google Safe Browsing:** Set `GOOGLE_SAFE_BROWSING_API_KEY` on backend for comprehensive checks
   - Get API key: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Enable Safe Browsing API → Create API Key
5. **Blocklist updates:** Extension auto-updates the local blocklist every 6 hours from the backend

---

### Focus Mode Issues

**Symptoms:** Sites not being blocked during focus mode, timer not working.

1. Enable focus mode via the toggle in the popup
2. Click **Start Focus** to begin the timer
3. Blocked sites are configured in Options → Productivity → Blocked Sites
4. Default blocked sites: facebook.com, twitter.com, instagram.com, reddit.com, youtube.com
5. Timer issues: Close and reopen the popup — the timer runs in the background service worker

---

### Time Tracking Inaccurate

**Symptoms:** Wrong times shown, missing sites.

1. Time tracking requires the `tabs` permission — check `chrome://extensions/` permissions
2. Data saves every 5 minutes — recent activity may not appear immediately
3. Chrome internal pages (`chrome://`, `chrome-extension://`) are excluded
4. Private/incognito tracking is disabled by default — enable in Options → Productivity

---

### Data Sync Issues

**Symptoms:** Tasks or settings not syncing between devices.

1. **Sign in** on both devices with the same account
2. Check sync status indicator in the popup (top-right dot)
   - 🟢 Green = synced
   - 🟡 Yellow = syncing
   - 🔴 Red = error/offline
3. Click the sync indicator to trigger manual sync
4. Ensure **Sync** is enabled in Options → General
5. Sync happens automatically every 5 minutes when signed in
6. **Conflict resolution:** If the same task is edited on multiple devices, the latest edit wins

---

### Build/Development Errors

**Extension build:**
```bash
npm install
npm run build          # Production build with webpack
npm run build:simple   # Simple copy-based build
npm run dev            # Watch mode for development
```

**Backend:**
```bash
cd backend
npm install
npm run dev            # Start with auto-restart (nodemon)
npm test               # Run tests
```

**Common build issues:**
- `rimraf not found` → Run `npm install` first
- Webpack errors → Check Node.js version (requires >= 18)
- Test failures → Ensure jest and jsdom are installed

---

### CAPTCHA Issues

**Symptoms:** "CAPTCHA verification failed" on signup/OTP.

1. CAPTCHA uses **Cloudflare Turnstile** (free tier)
2. If not configured, CAPTCHA is bypassed (dev mode)
3. To enable: Set `TURNSTILE_SECRET_KEY` on backend
4. Get keys: [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile → Add Site
5. Update the site key in the extension login page

---

## Getting Help

- **GitHub Issues:** [Report a bug](https://github.com/ShankarAdhikary/Trinetra-shield/issues/new?template=bug_report.md)
- **Discussions:** [Ask a question](https://github.com/ShankarAdhikary/Trinetra-shield/discussions)
