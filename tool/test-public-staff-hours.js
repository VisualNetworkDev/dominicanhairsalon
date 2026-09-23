const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

function expect(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(
  page,
  /function workerCanDoService\([\s\S]*?Array\.isArray\(worker\.services\)[\s\S]*?\['\*', 'todos', 'todas', 'all'\]/,
  'Staff service assignments must accept Cloudflare wildcard arrays.',
);
expect(
  page,
  /activeWorkers\.length === 1[\s\S]*?\$\('#preferredWorker'\)\.value = activeWorkers\[0\]\.username/,
  'A single available staff member must be selected directly instead of showing Anyone available.',
);
expect(
  page,
  /function sanitizeAvailabilitySlots\([\s\S]*?start < opening \|\| start \+ duration > closing/,
  'Returned times must be constrained to the salon opening and closing hours.',
);
expect(
  page,
  /function getAvailableSlotsStatic\([\s\S]*?const dayHours = salonHoursForDate\(dateIso\);[\s\S]*?minutes \+ duration <= end/,
  'Static fallback times must use the selected weekday hours.',
);
expect(
  page,
  /function workerAvailableStatic\([\s\S]*?worker\.role === 'admin'[\s\S]*?salonHoursForDate\(dateIso\)/,
  'The administrator must remain bookable within salon hours even without a separate staff schedule.',
);

expect(
  admin,
  /html\s*\{[\s\S]*?-webkit-text-size-adjust:\s*100%;[\s\S]*?overflow-x:\s*hidden;/,
  'Admin and staff pages must prevent Safari text autosizing and horizontal viewport drift.',
);
expect(
  admin,
  /\.tab\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?font-size:\s*14px;[\s\S]*?line-height:\s*1\.2;/,
  'Menu labels must keep a stable size when tabs or permissions change.',
);
expect(
  admin,
  /@media\s*\(max-width:\s*620px\)[\s\S]*?\.tabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?\.tab\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/,
  'The mobile admin and staff menu must remain a stable two-column grid.',
);

console.log('Public staff, salon-hour, and admin/staff menu safeguards are present.');
