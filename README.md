# TRINETRA Chrome Extension

<p align="center">
  <img src="assets/icons/icon128.png" alt="TRINETRA Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Your Third Eye for Safe and Productive Browsing</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#setup">Setup</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

TRINETRA is a powerful Chrome extension designed to enhance your web browsing experience through improved security and productivity features. Named after the "third eye" in Hindu mythology, TRINETRA watches over your browsing activities to keep you safe from phishing attacks while helping you stay productive.

## Features

### 🔒 Enhanced Security
- **Real-time Phishing Detection**: Scans URLs against known phishing databases
- **Malicious Site Blocking**: Prevents access to harmful websites
- **Google Safe Browsing Integration**: Leverages Google's threat intelligence

### 📋 Productivity Tools
- **Task Management**: Create, edit, and track tasks directly from your browser
- **Time Tracking**: Monitor time spent on different websites
- **Browsing Analytics**: Understand your browsing patterns

### 🔔 Smart Notifications
- **Customizable Alerts**: Set notifications based on browsing habits
- **Break Reminders**: Get reminded to take breaks after extended sessions
- **Focus Mode**: Block distracting sites during work hours

### ⚙️ Personalization
- **Cloud Sync**: Sync your preferences across devices
- **Custom Configurations**: Tailor the extension to your needs
- **Dark/Light Themes**: Choose your preferred visual style

## Installation

### From Chrome Web Store (Recommended)
1. Visit the [TRINETRA Chrome Web Store page](#)
2. Click "Add to Chrome"
3. Confirm the installation

### From Source (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/trinetra.git
   cd trinetra
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Setup

### Account Creation
1. Click the TRINETRA icon in your browser toolbar
2. Click "Sign Up" to create a new account
3. Verify your email address
4. Complete the onboarding wizard

### Configuration
1. Right-click the TRINETRA icon and select "Options"
2. Configure your preferences:
   - Security sensitivity level
   - Notification preferences
   - Time tracking categories
   - Blocked/allowed sites

## Development

### Prerequisites
- Node.js (v18 or higher)
- npm (v8 or higher)
- Chrome browser

### Local Development
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

### Project Structure
```
trinetra/
├── src/
│   ├── background/      # Background service worker
│   ├── content/         # Content scripts
│   ├── popup/           # Popup UI
│   ├── options/         # Options page
│   ├── utils/           # Shared utilities
│   └── api/             # API client
├── backend/             # Backend server
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── models/      # Data models
│   │   ├── middleware/  # Express middleware
│   │   └── services/    # Business logic
│   └── tests/           # Backend tests
├── assets/              # Static assets
├── tests/               # Extension tests
├── docs/                # Documentation
└── .github/             # GitHub workflows and templates
```

## API Reference

See the [Backend Integration Guide](docs/BACKEND_INTEGRATION.md) for detailed API documentation.

## Troubleshooting

See the [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for common issues and solutions.

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Quick Start for Contributors
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Google Safe Browsing API for security threat data
- Chrome Extensions API
- All our amazing contributors

---

<p align="center">
  Made with ❤️ by the TRINETRA Team
</p>
