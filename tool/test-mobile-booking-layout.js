const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'index.html');
const source = fs.readFileSync(sourcePath, 'utf8');

function expectPattern(pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

expectPattern(
  /<meta\s+name="viewport"\s+content="[^"]*width=device-width[^"]*initial-scale=1\.0[^"]*">/i,
  'The public page must keep a device-width viewport.',
);
expectPattern(
  /\.dialog\s*\{[\s\S]*?width:\s*min\(900px,\s*calc\(100vw\s*-\s*36px\)\);[\s\S]*?max-width:\s*100%;/,
  'Booking dialogs must remain inside the mobile viewport.',
);
expectPattern(
  /\.field\s*\{[\s\S]*?min-width:\s*0;/,
  'Form grid children must be allowed to shrink on phones.',
);
expectPattern(
  /input,\s*\n\s*select,\s*\n\s*textarea\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/,
  'Form controls must not force horizontal overflow.',
);
expectPattern(
  /@media\s*\(max-width:\s*540px\)[\s\S]*?input,\s*\n\s*select,\s*\n\s*textarea\s*\{\s*font-size:\s*16px;/,
  'iPhone form controls must use at least 16px text to prevent Safari auto-zoom.',
);
expectPattern(
  /function\s+syncModalBodyLock\(\)[\s\S]*?document\.documentElement\.classList\.toggle\('modal-open',\s*modalIsOpen\);[\s\S]*?document\.body\.classList\.toggle\('modal-open',\s*modalIsOpen\);/,
  'Opening a dialog must lock the background page without changing its scale.',
);

console.log('Mobile booking layout safeguards are present.');
