/**
 * Simple build script for TRINETRA extension
 * Copies files to dist folder for Chrome extension loading
 */

/* eslint-env node */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Create dist directory
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Directories to copy
const dirs = ['popup', 'options', 'content', 'background', 'utils', 'api', 'assets', 'auth'];

// Copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy manifest
fs.copyFileSync(
  path.join(srcDir, 'manifest.json'),
  path.join(distDir, 'manifest.json')
);

// Copy all directories
for (const dir of dirs) {
  const srcPath = path.join(srcDir, dir);
  const destPath = path.join(distDir, dir);
  if (fs.existsSync(srcPath)) {
    copyDir(srcPath, destPath);
  }
}

console.log('Build complete! Extension files copied to dist/');
console.log('');
console.log('To load the extension:');
console.log('1. Open Chrome and go to chrome://extensions/');
console.log('2. Enable "Developer mode"');
console.log('3. Click "Load unpacked"');
console.log('4. Select the dist folder');
