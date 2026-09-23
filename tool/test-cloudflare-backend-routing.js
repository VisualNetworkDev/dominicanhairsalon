const fs = require('fs');
const path = require('path');

const worker = fs.readFileSync(path.join(__dirname, '..', '_worker.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const manage = fs.readFileSync(path.join(__dirname, '..', 'manage-appointment.html'), 'utf8');
const adminConfig = fs.readFileSync(path.join(__dirname, '..', 'assets', 'admin-config.js'), 'utf8');
const clientConfig = fs.readFileSync(path.join(__dirname, '..', 'assets', 'client-actions-config.js'), 'utf8');

function expect(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(worker, /DEFAULT_CORE_API\s*=\s*'https:\/\/reset-salon-api\.2808joel\.workers\.dev'/, 'Pages must use the Cloudflare D1 Worker.');
expect(worker, /url\.pathname === '\/api\/compat'[\s\S]*?proxyCompatMutation/, 'Public mutations must be proxied to the Cloudflare Worker.');
expect(worker, /cacheUrl\.searchParams\.set\('__business', businessId\)/, 'Cache keys must be isolated by business.');
expect(worker, /'x-reset-backend': 'cloudflare-d1'/, 'Responses must identify the Cloudflare D1 backend.');
expect(worker, /contentLength > 18 \* 1024 \* 1024/, 'The same-origin proxy must accept compressed admin gallery uploads.');
if (/script\.google\.com/i.test(worker)) throw new Error('Pages reads must not proxy Apps Script.');

expect(page, /compatUrl:\s*'\/api\/compat'/, 'The public page must send mutations through the same-origin Cloudflare proxy.');
expect(page, /async function postToCloudflareBackend[\s\S]*?fetch\(endpoint,[\s\S]*?functionName,[\s\S]*?args:/, 'The public page must use JSON requests for Cloudflare mutations.');
if (/postToAppsScript/.test(page)) throw new Error('The active public page must not call the legacy Apps Script transport.');

expect(admin, /apiBaseUrl:\s*'\/api\/compat'/, 'Admin and staff must use the same-origin Cloudflare proxy.');
expect(admin, /async function postToCloudflareBackend[\s\S]*?fetch\(endpoint,[\s\S]*?functionName,[\s\S]*?args:/, 'Admin and staff must use JSON requests.');
if (/postToAppsScript|script\.google\.com/i.test(admin)) throw new Error('Admin and staff must not call the legacy Apps Script transport.');

expect(manage, /apiBaseUrl:'\/api\/compat'/, 'Appointment management links must use Cloudflare.');
expect(manage, /async function gas[\s\S]*?functionName:fn,args:\[arg\]/, 'Appointment management must use JSON requests.');
if (/script\.google\.com/i.test(manage)) throw new Error('Appointment management must not call Apps Script.');

for (const [name, source] of [['admin config', adminConfig], ['client actions config', clientConfig]]) {
  if (/script\.google\.com/i.test(source)) throw new Error(`${name} still references Apps Script.`);
  expect(source, /\/api\/compat/, `${name} must point to the same-origin Cloudflare proxy.`);
}

console.log('Public, admin, staff, and appointment-management Cloudflare routing is present.');
