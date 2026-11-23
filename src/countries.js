import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

// The 195 countries the app counts: 193 UN members + Vatican City + Palestine.
// Anything else (Hong Kong, Taiwan, Puerto Rico, Kosovo...) still shows on the
// globe but counts as a "territory", not toward the 195.
const BY_CONTINENT = {
  Africa:
    'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW',
  Asia:
    'AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TJ TH TL TR TM AE UZ VN YE',
  Europe:
    'AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA',
  'North America': 'AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US',
  'South America': 'AR BO BR CL CO EC GY PY PE SR UY VE',
  Oceania: 'AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU',
};

export const CONTINENTS = Object.keys(BY_CONTINENT);
export const CONTINENT_OF = {};
export const CONTINENT_SIZE = {};
for (const [cont, codes] of Object.entries(BY_CONTINENT)) {
  const list = codes.split(' ');
  CONTINENT_SIZE[cont] = list.length;
  for (const c of list) CONTINENT_OF[c] = cont;
}
export const SOVEREIGN = new Set(Object.keys(CONTINENT_OF));
export const TOTAL_COUNTRIES = SOVEREIGN.size; // 195

const SHORT_NAMES = {
  US: 'United States',
  GB: 'United Kingdom',
  RU: 'Russia',
  KR: 'South Korea',
  KP: 'North Korea',
  IR: 'Iran',
  SY: 'Syria',
  VN: 'Vietnam',
  LA: 'Laos',
  BO: 'Bolivia',
  VE: 'Venezuela',
  TZ: 'Tanzania',
  MD: 'Moldova',
  CD: 'DR Congo',
  CG: 'Congo',
  VA: 'Vatican City',
  PS: 'Palestine',
  TW: 'Taiwan',
  XK: 'Kosovo',
  FM: 'Micronesia',
  BN: 'Brunei',
  CZ: 'Czechia',
  MK: 'North Macedonia',
  CI: "Côte d'Ivoire",
};

export function countryName(code) {
  if (!code) return 'Unknown';
  return SHORT_NAMES[code] || countries.getName(code, 'en') || code;
}

export function flag(code) {
  if (!code || code.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

// world-atlas features use ISO 3166 numeric ids; a few have none.
const NO_ID_NAMES = { Kosovo: 'XK', 'N. Cyprus': 'CY', Somaliland: 'SO' };

export function featureAlpha2(feature) {
  if (feature.id) {
    const a2 = countries.numericToAlpha2(feature.id);
    if (a2) return a2;
  }
  return NO_ID_NAMES[feature.properties?.name] || null;
}
