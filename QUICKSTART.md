# TRINETRA Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- Google Chrome browser
- Terminal/Command Prompt

## 1. Start the Backend Server

Open a terminal and run:

```bash
cd backend
npm install
node src/server.js
```

The backend will start at `http://localhost:3000`

To verify it's running, visit: http://localhost:3000/health

> **Note:** The extension is pre-configured to use the production API at `https://trinetra-shield.onrender.com`. For local development, update `src/api/apiClient.js` to use `http://localhost:3000`.

## 2. Build the Chrome Extension

Open a new terminal and run:

```bash
npm install
npm run build:simple
```

This creates the `dist/` folder with all extension files.

## 3. Load Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to and select the `dist` folder inside the project directory:
   - Path: `C:\Users\adhik\Downloads\File\Tri-netra\dist`
5. The TRINETRA extension icon should appear in your toolbar

## 4. Using TRINETRA

### Popup Features
- Click the TRINETRA icon in your toolbar
- **Security Status**: Shows real-time protection status
- **Tasks Tab**: Add and manage your tasks
- **Time Tab**: View time spent on different websites
- **Focus Tab**: Enable focus mode to block distracting sites

### Options Page
- Right-click the extension icon → **Options**
- Configure security settings, notifications, blocked sites, etc.

## Troubleshooting

### Extension won't load
- Make sure all files are in the `dist` folder
- Check Chrome console for errors (`chrome://extensions/` → click "Errors" on the extension card)

### Backend not connecting
- Ensure the backend is running on port 3000
- Check if another process is using port 3000

### Icons not showing
- Run `node create-icons.js` in the project root
- Rebuild with `npm run build:simple`

## API Endpoints

The backend provides these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/auth/register` | POST | Register/Login user |
| `/api/tasks` | GET/POST | Task management |
| `/api/time` | GET/POST | Time tracking data |
| `/api/security/check?url=` | GET | Check URL safety |
| `/api/sync` | POST | Sync all data |

## Development

### Watch mode (auto-rebuild on changes)
```bash
npm run dev
```

### Run tests
```bash
npm test
```

### Backend development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

## Project Structure

```
Tri-netra/
├── dist/                  # Built extension (load this in Chrome)
├── src/                   # Extension source code
│   ├── popup/             # Popup UI
│   ├── options/           # Settings page
│   ├── background/        # Service worker
│   ├── content/           # Content scripts
│   ├── utils/             # Utilities
│   └── api/               # API client
├── backend/               # Node.js backend
│   └── src/
│       ├── routes/        # API routes
│       ├── services/      # Business logic
│       └── middleware/    # Auth, errors
└── docs/                  # Documentation
```
