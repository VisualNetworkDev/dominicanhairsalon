const fs = require('fs');
const path = require('path');

const worker = fs.readFileSync(path.join(__dirname, '..', '_worker.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function expect(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(worker, /DEFAULT_CORE_API\s*=\s*'https:\/\/reset-salon-api\.2808joel\.workers\.dev'/, 'Pages must use the Cloudflare D1 Worker.');
expect(worker, /url\.pathname === '\/api\/compat'[\s\S]*?proxyCompatMutation/, 'Public mutations must be proxied to the Cloudflare Worker.');
expect(worker, /cacheUrl\.searchParams\.set\('__business', businessId\)/, 'Cache keys must be isolated by business.');
expect(worker, /'x-reset-backend': 'cloudflare-d1'/, 'Responses must identify the Cloudflare D1 backend.');
if (/script\.google\.com/i.test(worker)) throw new Error('Pages reads must not proxy Apps Script.');

expect(page, /compatUrl:\s*'\/api\/compat'/, 'The public page must send mutations through the same-origin Cloudflare proxy.');
expect(page, /async function postToCloudflareBackend[\s\S]*?fetch\(endpoint,[\s\S]*?functionName,[\s\S]*?args:/, 'The public page must use JSON requests for Cloudflare mutations.');
if (/postToAppsScript/.test(page)) throw new Error('The active public page must not call the legacy Apps Script transport.');

console.log('Cloudflare backend routing and business cache isolation are present.');
