const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const mapHtml = fs.readFileSync(path.join(root, 'open-map.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scriptMatch = mapHtml.match(/<script>([\s\S]*?)<\/script>/i);
assert(scriptMatch, 'open-map.html must contain its routing script');

async function runScenario({ search = '', userAgent = '', platform = '', maxTouchPoints = 0, contact }) {
  const elements = Object.fromEntries(
    ['#address', '#googleMaps', '#appleMaps', '#title', '#copy', '#back', '#choices']
      .map((selector) => [selector, { textContent: '', href: '', hidden: selector === '#choices' }]),
  );
  let redirect = '';
  const context = {
    URLSearchParams,
    encodeURIComponent,
    String,
    document: {
      documentElement: { lang: '' },
      querySelector(selector) {
        return elements[selector];
      },
    },
    navigator: { language: 'es-US', userAgent, platform, maxTouchPoints },
    location: {
      search,
      replace(url) {
        redirect = url;
      },
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({ ok: true, data: { contact: contact || {} } }),
    }),
  };
  await vm.runInNewContext(scriptMatch[1], context);
  return { elements, redirect };
}

(async () => {
  const encoded = '1801%20wells%20rd%20Orange%20Park%20fl%2032073';
  const address = '1801 wells rd Orange Park fl 32073';

  const iphone = await runScenario({ search: `?address=${encoded}`, userAgent: 'iPhone' });
  assert.equal(iphone.redirect, '');
  assert.equal(iphone.elements['#choices'].hidden, false);
  assert.equal(iphone.elements['#address'].textContent, address);
  assert.match(iphone.elements['#appleMaps'].href, /^https:\/\/maps\.apple\.com\//);
  assert.match(iphone.elements['#googleMaps'].href, /^https:\/\/www\.google\.com\/maps\/search\//);

  const android = await runScenario({ search: `?address=${encoded}`, userAgent: 'Android' });
  assert.match(android.redirect, /^https:\/\/www\.google\.com\/maps\/search\//);

  const recoveredIphone = await runScenario({
    userAgent: 'iPhone',
    contact: { showAddress: true, address },
  });
  assert.equal(recoveredIphone.elements['#choices'].hidden, false);
  assert.equal(recoveredIphone.elements['#address'].textContent, address);

  const recoveredWindows = await runScenario({
    userAgent: 'Windows NT 10.0',
    contact: { showAddress: true, address },
  });
  assert.match(recoveredWindows.redirect, /^https:\/\/www\.google\.com\/maps\/search\//);

  const hiddenAddress = await runScenario({ userAgent: 'iPhone', contact: { showAddress: false, address } });
  assert.equal(hiddenAddress.redirect, '');
  assert.equal(hiddenAddress.elements['#choices'].hidden, true);
  assert.equal(hiddenAddress.elements['#title'].textContent, 'Dirección no disponible');

  assert.match(indexHtml, /const mapHref = contact\.address/);
  assert.match(indexHtml, /open-map\.html\?address=\$\{encodeURIComponent\(contact\.address\)\}/);
  console.log('Map routing tests passed for iPhone, Android, Windows, recovery, and hidden address.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
