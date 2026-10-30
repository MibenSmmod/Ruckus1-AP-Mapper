#!/usr/bin/env node
/**
 * Fail the build if API credentials might be packaged or hardcoded in source.
 * Saved credentials belong only in Electron userData (never in the installer).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];

const forbiddenProjectFiles = [
  'config.json',
  '.env',
  '.env.local',
  '.env.production',
  'credentials.json'
];

for (const name of forbiddenProjectFiles) {
  const full = path.join(root, name);
  if (fs.existsSync(full)) {
    errors.push(
      `Found ${name} in the project root. Move or delete it before building so it cannot be packaged.`
    );
  }
}

const sourceRoots = [
  path.join(root, 'main.js'),
  path.join(root, 'preload.js'),
  path.join(root, 'src')
];

const credentialFieldIds = ['tenant-id', 'client-id', 'client-secret'];
const suspiciousPatterns = [
  /id=["']tenant-id["'][^>]*\svalue=["'][^"']+["']/i,
  /id=["']client-id["'][^>]*\svalue=["'][^"']+["']/i,
  /id=["']client-secret["'][^>]*\svalue=["'][^"']+["']/i,
  /tenantId\s*[:=]\s*["'][0-9a-f-]{8,}["']/i,
  /clientId\s*[:=]\s*["'][^"']{8,}["']/i,
  /clientSecret\s*[:=]\s*["'][^"']{8,}["']/i
];

function walk(filePath, files = []) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(path.join(filePath, entry), files);
    }
    return files;
  }
  if (/\.(js|html|json|env|txt|md)$/i.test(filePath)) {
    files.push(filePath);
  }
  return files;
}

const filesToScan = [];
for (const start of sourceRoots) {
  if (fs.existsSync(start)) walk(start, filesToScan);
}

for (const file of filesToScan) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      errors.push(`Possible hardcoded credential pattern in ${path.relative(root, file)}`);
      break;
    }
  }

  // Catch filled-in login inputs even if attribute order differs.
  for (const id of credentialFieldIds) {
    const inputRe = new RegExp(`<input[^>]*id=["']${id}["'][^>]*>`, 'i');
    const match = text.match(inputRe);
    if (match && /\svalue=["'][^"']+["']/i.test(match[0])) {
      errors.push(`Login input #${id} has a non-empty value attribute in ${path.relative(root, file)}`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const filesGlob = (packageJson.build && packageJson.build.files) || [];
const hasConfigExclude = filesGlob.some((entry) => String(entry).includes('config.json') && String(entry).startsWith('!'));
if (!hasConfigExclude) {
  errors.push('package.json build.files must explicitly exclude config.json (e.g. "!config.json").');
}

if (errors.length) {
  console.error('\nCredential prebuild check failed:\n');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error('\nRemove secrets from the project, then rebuild.\n');
  process.exit(1);
}

console.log('Credential prebuild check passed: no project credentials found for packaging.');
