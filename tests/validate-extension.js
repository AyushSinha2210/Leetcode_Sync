const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🔍 EXTENSION INTEGRITY & VALIDATION CHECK');
console.log('====================================================\n');

const root = path.join(__dirname, '..');

// 1. Validate manifest.json
console.log('1️⃣ Checking manifest.json...');
const manifestPath = path.join(root, 'manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error('manifest.json missing');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
console.log('  ✅ Manifest Version 3 confirmed.');

// 2. Validate all referenced files exist
console.log('\n2️⃣ Verifying all declared assets and script files exist...');
const filesToCheck = [
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  ...(manifest.content_scripts?.[0]?.js || []),
  ...(manifest.content_scripts?.[0]?.css || []),
  ...(manifest.web_accessible_resources?.[0]?.resources || []),
  manifest.action?.default_icon?.['16'],
  manifest.action?.default_icon?.['32'],
  manifest.action?.default_icon?.['48'],
  manifest.action?.default_icon?.['128']
];

filesToCheck.forEach(file => {
  if (file && !file.includes('*')) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Referenced file does not exist: ${file}`);
    }
    console.log(`  ✅ File exists: ${file}`);
  }
});

// 3. Check popup HTML referenced scripts
console.log('\n3️⃣ Verifying popup.html script references...');
const popupHtmlPath = path.join(root, 'popup', 'popup.html');
const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
const scriptMatches = popupHtml.match(/src="([^"]+)"/g) || [];

scriptMatches.forEach(tag => {
  const relPath = tag.replace(/src="|"/g, '');
  const scriptFullPath = path.join(root, 'popup', relPath);
  if (!fs.existsSync(scriptFullPath)) {
    throw new Error(`popup.html references missing script: ${relPath}`);
  }
  console.log(`  ✅ popup.html script exists: ${relPath}`);
});

console.log('\n====================================================');
console.log('🎉 EXTENSION INTEGRITY VALIDATED: 100% HEALTHY');
console.log('====================================================');
