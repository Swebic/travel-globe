// Sanity check for src/countries.js: run with `node scripts/check-countries.mjs`
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const src = fs.readFileSync(new URL('../src/countries.js', import.meta.url), 'utf8').replace(
  /^import en.*$/m,
  "import { createRequire } from 'module'; const en = createRequire(import.meta.url)('i18n-iso-countries/langs/en.json');");
const tmp = new URL('../src/.countries-check.mjs', import.meta.url);
fs.writeFileSync(tmp, src);
try {
  const m = await import(tmp.href);
  const c = require('i18n-iso-countries');
  console.log('total', m.TOTAL_COUNTRIES, m.CONTINENT_SIZE);
  console.log('invalid codes', [...m.SOVEREIGN].filter((x) => !c.isValid(x)));
  console.log('not counted:', Object.keys(c.getAlpha2Codes()).filter((x) => !m.SOVEREIGN.has(x)).join(' '));
  const t = require('world-atlas/countries-50m.json');
  const mapped = new Set(t.objects.countries.geometries.map((f) => m.featureAlpha2(f)));
  console.log('counted countries with no polygon:', [...m.SOVEREIGN].filter((x) => !mapped.has(x)));
  console.log(['US', 'GB', 'HK', 'XK', 'JP', 'CI', 'TR'].map((x) => m.flag(x) + ' ' + m.countryName(x)).join(' | '));
} finally { fs.unlinkSync(tmp); }
