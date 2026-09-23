const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function expectPattern(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expectPattern(
  /async function prefetchAvailabilityMatrix\(\)[\s\S]*?matchMedia\('\(max-width: 720px\)'\)\.matches\) return null;/,
  'Phones must not download the full multi-day availability matrix.',
);
expectPattern(
  /const matrixFresh = state\.availabilityMatrix/,
  'An already available matrix should still accelerate larger screens.',
);
if (/if \(!state\.availabilityMatrix && state\.availabilityMatrixPromise\)\s*\{\s*await state\.availabilityMatrixPromise/.test(source)) {
  throw new Error('A selected date must not wait for the background matrix request.');
}
expectPattern(
  /window\.setTimeout\(\(\) => \{[\s\S]*?resetTimedOut = true;[\s\S]*?\.abort\(\);[\s\S]*?\}, 20000\)/,
  'Availability requests must have a visible timeout instead of loading forever.',
);
expectPattern(
  /resetTimedOut[\s\S]*?slotGrid\.innerHTML = `<div class="empty">\$\{escapeHtml\(t\('slotsTimeout'\)\)\}<\/div>`/,
  'A timed-out request must replace the loading message with a retry instruction.',
);
expectPattern(
  /if \(availability && availability\.staleCatalog\)[\s\S]*?fetchPublicDataFast\(true\)[\s\S]*?window\.setTimeout\(loadSlots, 0\);/,
  'A refreshed service catalog must automatically retry the interrupted availability lookup.',
);
expectPattern(
  /catalogRetryVersion === availabilityPayload\.catalogVersion[\s\S]*?slotsTimeout/,
  'Repeated stale catalog responses must stop with a retry message instead of looping forever.',
);

console.log('Mobile availability loading safeguards are present.');
