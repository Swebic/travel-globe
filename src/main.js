import './style.css';
import Globe from 'globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-50m.json';
import {
  CONTINENTS,
  CONTINENT_OF,
  CONTINENT_SIZE,
  SOVEREIGN,
  TOTAL_COUNTRIES,
  countryName,
  flag,
  featureAlpha2,
} from './countries.js';
import * as db from './db.js';

// One drawn icon set: 24px grid, 1.8 stroke, round caps (matches the tab bar).
const svg = (d, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>', 'ico-sm'),
  camera: svg('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>', 'ico-xl'),
};

// ---------- state ----------
let trips = [];
const photoUrls = new Map(); // photoId -> object URL
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function photoUrl(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  const blob = await db.getPhoto(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  photoUrls.set(id, url);
  return url;
}

// ---------- derived stats ----------
function computeStats() {
  const cities = new Map(); // key -> {stop, trips:[]}
  const countryTrips = new Map(); // code -> Set(tripId)
  for (const t of trips) {
    for (const s of t.stops) {
      const key = s.geoId ? 'g' + s.geoId : `${s.name}|${s.countryCode}`;
      if (!cities.has(key)) cities.set(key, { stop: s, trips: [] });
      cities.get(key).trips.push(t);
      if (!countryTrips.has(s.countryCode)) countryTrips.set(s.countryCode, new Set());
      countryTrips.get(s.countryCode).add(t.id);
    }
  }
  const visited = [...countryTrips.keys()];
  const sovereign = visited.filter((c) => SOVEREIGN.has(c));
  const territories = visited.filter((c) => !SOVEREIGN.has(c));
  const perContinent = Object.fromEntries(CONTINENTS.map((c) => [c, 0]));
  for (const c of sovereign) perContinent[CONTINENT_OF[c]]++;
  return {
    cities,
    countryTrips,
    visitedSet: new Set(visited),
    sovereign,
    territories,
    perContinent,
    continentsVisited: CONTINENTS.filter((c) => perContinent[c] > 0).length,
    pct: (sovereign.length / TOTAL_COUNTRIES) * 100,
  };
}
let stats = computeStats();

const fmtPct = (p) => (p === 0 ? '0' : p < 10 ? p.toFixed(1) : Math.round(p).toString());

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtRange(t) {
  if (!t.start) return 'No date';
  if (!t.end || t.end === t.start) return fmtDate(t.start);
  const a = new Date(t.start + 'T12:00:00');
  const b = new Date(t.end + 'T12:00:00');
  if (a.getFullYear() === b.getFullYear()) {
    const left = a.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `${left} – ${fmtDate(t.end)}`;
  }
  return `${fmtDate(t.start)} – ${fmtDate(t.end)}`;
}
const sortTrips = (list) =>
  [...list].sort((a, b) => (b.start || '0000').localeCompare(a.start || '0000') || b.createdAt - a.createdAt);

function tripTitle(t) {
  if (t.title) return t.title;
  const names = [...new Set(t.stops.map((s) => countryName(s.countryCode)))];
  return names.length ? names.join(' & ') : 'Trip';
}

// ---------- globe ----------
const countriesGeo = feature(world, world.objects.countries).features.filter((f) => f.properties.name !== 'Antarctica');
for (const f of countriesGeo) f.properties.a2 = featureAlpha2(f);

const globeEl = $('#globe');
const globe = new Globe(globeEl, { animateIn: true })
  .backgroundColor('rgba(0,0,0,0)')
  .showAtmosphere(true)
  .atmosphereColor('#7fb2ff')
  .atmosphereAltitude(0.18)
  .polygonsData(countriesGeo)
  .polygonCapCurvatureResolution(5)
  .polygonsTransitionDuration(400)
  .polygonStrokeColor((f) => (stats.visitedSet.has(f.properties.a2) ? 'rgba(255,214,150,0.9)' : 'rgba(170,190,230,0.22)'))
  .polygonSideColor((f) => (stats.visitedSet.has(f.properties.a2) ? 'rgba(255,170,70,0.35)' : 'rgba(0,0,0,0)'))
  .polygonCapColor((f) => (stats.visitedSet.has(f.properties.a2) ? 'rgba(255,176,72,0.88)' : 'rgba(120,140,185,0.16)'))
  .polygonAltitude((f) => (stats.visitedSet.has(f.properties.a2) ? 0.014 : 0.004))
  .onPolygonClick((f) => {
    const code = f.properties.a2;
    if (code && stats.visitedSet.has(code)) openCountry(code);
  })
  .htmlElementsData([])
  .htmlLat((d) => d.stop.lat)
  .htmlLng((d) => d.stop.lon)
  .htmlAltitude(0.016)
  .htmlTransitionDuration(0)
  .htmlElement((d) => {
    const el = document.createElement('button');
    el.className = 'city-dot';
    el.setAttribute('aria-label', d.stop.name);
    el.innerHTML = '<span></span>';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openCity(d);
    });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    return el;
  })
  .htmlElementVisibilityModifier((el, visible) => {
    el.style.opacity = visible ? 1 : 0;
    el.style.pointerEvents = visible ? 'auto' : 'none';
  });

globe.globeMaterial(
  new MeshPhongMaterial({ color: new Color('#0d2246'), emissive: new Color('#06122a'), shininess: 12 }),
);
globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.35;
globe.controls().enableDamping = true;
globe.controls().minDistance = 130;
globe.controls().maxDistance = 600;
globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));
globeEl.addEventListener('pointerdown', () => (globe.controls().autoRotate = false));

function sizeGlobe() {
  globe.width(window.innerWidth).height(window.innerHeight);
}
window.addEventListener('resize', sizeGlobe);
sizeGlobe();

function refreshGlobe() {
  // re-assign the colour accessors so the polygon layer redraws visited countries
  globe
    .polygonCapColor(globe.polygonCapColor())
    .polygonSideColor(globe.polygonSideColor())
    .polygonStrokeColor(globe.polygonStrokeColor())
    .polygonAltitude(globe.polygonAltitude());
  globe.htmlElementsData([...stats.cities.values()]);
}

// On a tall, narrow phone screen the globe needs more distance to fit sideways.
const homeAltitude = () => (window.innerWidth < window.innerHeight ? 3.3 : 2.3);

function flyTo(lat, lng, altitude = window.innerWidth < window.innerHeight ? 2.1 : 1.6) {
  globe.controls().autoRotate = false;
  globe.pointOfView({ lat, lng, altitude }, 1200);
}

// ---------- header ----------
// The app's one authored moment: the country count climbs to its value as the globe turns in.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let shownCount = 0;
function countTo(el, to) {
  const from = shownCount;
  shownCount = to;
  if (reduceMotion || from === to) {
    el.textContent = to;
    return;
  }
  const t0 = performance.now();
  const dur = 1100;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(2, -10 * k); // exponential ease-out
    el.textContent = Math.round(from + (to - from) * (k === 1 ? 1 : eased));
    if (k < 1 && shownCount === to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // rAF pauses in background tabs; make sure the real number always lands.
  setTimeout(() => shownCount === to && (el.textContent = to), dur + 50);
}

function renderHeader() {
  countTo($('#hdr-count'), stats.sovereign.length);
  $('#hdr-label').textContent = stats.sovereign.length === 1 ? 'country' : 'countries';
  $('#hdr-pct').textContent = `${fmtPct(stats.pct)}% of the world`;
  const nCities = stats.cities.size;
  $('#hdr-cities').textContent = `${nCities} ${nCities === 1 ? 'city' : 'cities'}`;
  $('#empty-hint').hidden = trips.length > 0;
}

// ---------- tabs ----------
let currentTab = 'globe';
function showTab(name) {
  currentTab = name;
  for (const b of document.querySelectorAll('.tabbar button')) b.classList.toggle('active', b.dataset.tab === name);
  $('#view-trips').hidden = name !== 'trips';
  $('#view-stats').hidden = name !== 'stats';
  $('#globe-ui').hidden = name !== 'globe';
  if (name === 'globe') globe.resumeAnimation();
  else globe.pauseAnimation();
  if (name === 'trips') renderTrips();
  if (name === 'stats') renderStats();
}
for (const b of document.querySelectorAll('.tabbar button')) b.addEventListener('click', () => showTab(b.dataset.tab));
$('#hdr').addEventListener('click', () => showTab('stats'));

// ---------- trips list ----------
async function renderTrips() {
  const list = $('#trip-list');
  if (!trips.length) {
    list.innerHTML = `<div class="empty"><div class="empty-globe">${ICON.globe}</div><p>No trips yet.</p><p class="muted">Add the places you've been and they'll light up on your globe.</p></div>`;
    return;
  }
  let html = '';
  let year = null;
  for (const t of sortTrips(trips)) {
    const y = t.start ? t.start.slice(0, 4) : 'No dates yet';
    if (y !== year) {
      year = y;
      html += `<h3 class="year">${esc(y)}</h3>`;
    }
    const cover = t.photoIds?.[0];
    const codes = [...new Set(t.stops.map((s) => s.countryCode))];
    const title = tripTitle(t);
    const cities = t.stops.map((s) => s.name).join(' · ');
    const meta = [t.start ? fmtRange(t) : '', t.photoIds?.length ? `${t.photoIds.length} ${t.photoIds.length === 1 ? 'photo' : 'photos'}` : '']
      .filter(Boolean)
      .join(' · ');
    html += `<button class="trip-row" data-id="${esc(t.id)}">
      <div class="thumb ${codes.length > 1 ? 'multi' : ''}" ${cover ? `data-photo="${esc(cover)}"` : ''}>${cover ? '' : codes.slice(0, 3).map((c) => `<span>${flag(c)}</span>`).join('')}</div>
      <div class="trip-text">
        <div class="trip-title">${esc(title)}</div>
        ${cities !== title ? `<div class="trip-cities">${esc(cities)}</div>` : ''}
        ${meta ? `<div class="trip-date">${esc(meta)}</div>` : ''}
      </div>
    </button>`;
  }
  list.innerHTML = html;
  for (const row of list.querySelectorAll('.trip-row')) {
    row.addEventListener('click', () => openTrip(trips.find((t) => t.id === row.dataset.id)));
  }
  for (const th of list.querySelectorAll('.thumb[data-photo]')) {
    photoUrl(th.dataset.photo).then((u) => u && (th.style.backgroundImage = `url("${u}")`));
  }
}

// ---------- stats ----------
function renderStats() {
  const s = stats;
  const R = 54;
  const C = 2 * Math.PI * R;
  const dash = (s.pct / 100) * C;
  const countriesSorted = [...s.countryTrips.keys()].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const firstYear = (code) => {
    const ys = trips.filter((t) => t.stops.some((x) => x.countryCode === code) && t.start).map((t) => t.start.slice(0, 4));
    return ys.sort()[0] || '';
  };
  const citiesIn = (code) => [...s.cities.values()].filter((c) => c.stop.countryCode === code).length;
  $('#stats-body').innerHTML = `
    <section class="ring-card">
      <svg viewBox="0 0 128 128" class="ring" aria-hidden="true">
        <circle cx="64" cy="64" r="${R}" class="ring-bg"/>
        <circle cx="64" cy="64" r="${R}" class="ring-fg" stroke-dasharray="${Math.max(dash, s.pct ? 2 : 0)} ${C}" transform="rotate(-90 64 64)"/>
      </svg>
      <div class="ring-text"><div class="ring-pct">${fmtPct(s.pct)}<small>%</small></div><div class="muted">of the world</div></div>
      <p class="ring-caption"><b>${s.sovereign.length}</b> of ${TOTAL_COUNTRIES} countries visited</p>
    </section>
    <section class="tiles">
      <div class="tile"><b>${s.cities.size}</b><span>cities</span></div>
      <div class="tile"><b>${trips.length}</b><span>trips</span></div>
      <div class="tile"><b>${s.continentsVisited}<small>/6</small></b><span>continents</span></div>
    </section>
    <section class="card">
      <h3>Continents</h3>
      ${CONTINENTS.map((c) => {
        const n = s.perContinent[c];
        const tot = CONTINENT_SIZE[c];
        return `<div class="bar-row"><div class="bar-label"><span>${c}</span><span class="muted">${n} / ${tot}</span></div>
          <div class="bar"><div style="width:${(n / tot) * 100}%"></div></div></div>`;
      }).join('')}
    </section>
    <section class="card">
      <h3>Countries</h3>
      ${
        countriesSorted.length
          ? `<ul class="country-list">${countriesSorted
              .map(
                (code) => `<li><button data-code="${esc(code)}"><span class="flag">${flag(code)}</span>
                <span class="cname">${esc(countryName(code))}${SOVEREIGN.has(code) ? '' : ' <em>territory</em>'}</span>
                <span class="muted">${citiesIn(code)} ${citiesIn(code) === 1 ? 'city' : 'cities'}${s.countryTrips.get(code).size > 1 ? ` · ${s.countryTrips.get(code).size} visits` : ''}${firstYear(code) ? ' · ' + firstYear(code) : ''}</span></button></li>`,
              )
              .join('')}</ul>`
          : '<p class="muted">Countries you visit will be listed here.</p>'
      }
      ${s.territories.length ? `<p class="muted small">Territories like Hong Kong or Puerto Rico appear on your globe but don't count toward the ${TOTAL_COUNTRIES}. The ${TOTAL_COUNTRIES} are the 193 UN members plus Vatican City and Palestine.</p>` : `<p class="muted small">The ${TOTAL_COUNTRIES} countries are the 193 UN members plus Vatican City and Palestine.</p>`}
    </section>
    <section class="card">
      <h3>Backup</h3>
      <p class="muted small">Your trips and photos are saved only on this phone. Export a backup now and then so you don't lose them.</p>
      <div class="btn-row">
        <button class="btn" id="btn-export">Export backup</button>
        <label class="btn btn-ghost">Import backup<input type="file" id="file-import" accept="application/json,.json" hidden></label>
      </div>
      <p class="muted small" id="backup-msg"></p>
    </section>`;
  for (const b of document.querySelectorAll('.country-list button')) b.addEventListener('click', () => openCountry(b.dataset.code));
  $('#btn-export').onclick = doExport;
  $('#file-import').addEventListener('change', doImport);
}

// Export is two taps: first build the file (can take a while with many photos),
// then a "Save backup" tap opens the share sheet. iOS only allows the share
// sheet straight from a tap, so it can't wait on the slow part.
async function doExport() {
  const msg = $('#backup-msg');
  const btn = $('#btn-export');
  msg.textContent = 'Preparing backup…';
  btn.disabled = true;
  try {
    const data = await db.exportBackup();
    const name = `travel-globe-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    msg.textContent = `Backup ready: ${data.trips.length} trips, ${Object.keys(data.photos).length} photos.`;
    btn.textContent = 'Save backup';
    btn.disabled = false;
    btn.onclick = () => {
      saveFile(file).then(
        () => (msg.textContent = 'Saved. Keep it in Files or iCloud Drive.'),
        (err) => (msg.textContent = err.name === 'AbortError' ? msg.textContent : 'Could not save: ' + err.message),
      );
    };
  } catch (e) {
    btn.disabled = false;
    msg.textContent = 'Export failed: ' + e.message;
  }
}

function saveFile(file) {
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: 'Travel Globe backup' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return Promise.resolve();
}

async function doImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const msg = $('#backup-msg');
  try {
    const data = JSON.parse(await file.text());
    const n = await db.importBackup(data);
    await reload();
    renderStats();
    $('#backup-msg').textContent = `Imported ${n} trips.`;
  } catch (err) {
    msg.textContent = 'Import failed: ' + err.message;
  }
}

// ---------- sheets ----------
const sheet = $('#sheet');
const sheetBody = $('#sheet-body');
let openRaf = 0;
function openSheet(html, { tall = false } = {}) {
  sheetBody.innerHTML = html;
  sheet.classList.toggle('tall', tall);
  sheet.hidden = false;
  cancelAnimationFrame(openRaf);
  openRaf = requestAnimationFrame(() => sheet.classList.add('open'));
  sheetBody.scrollTop = 0;
}
function closeSheet() {
  cancelAnimationFrame(openRaf);
  sheet.classList.remove('open');
  panel.style.transform = '';
  setTimeout(() => {
    if (!sheet.classList.contains('open')) sheet.hidden = true;
  }, 250);
}
// Closing by tap-outside, Escape or swipe asks first if the trip form has unsaved changes.
function dismissSheet() {
  if (draft && draftDirty && !confirm('Discard the changes to this trip?')) {
    panel.style.transform = '';
    return;
  }
  if (draft) {
    cleanupDraftPhotos();
    draft = null;
  }
  closeSheet();
}
$('#sheet-backdrop').addEventListener('click', dismissSheet);
document.addEventListener('keydown', (e) => e.key === 'Escape' && !sheet.hidden && $('#viewer').hidden && dismissSheet());

// Swipe the sheet down to close it, like an iOS sheet.
const panel = $('.sheet-panel');
let dragStartY = null;
let dragStartX = 0;
let dragDy = 0;
function endDrag() {
  dragStartY = null;
  panel.style.transition = '';
}
panel.addEventListener('touchstart', (e) => {
  // Sideways photo swipes, text fields and search results keep their own gestures.
  if (e.target.closest('.photo-strip, input, textarea, .results')) {
    dragStartY = null;
    return;
  }
  const onHandle = e.target.closest('.grabber, .sheet-head, .editor-head');
  dragStartY = onHandle || sheetBody.scrollTop <= 0 ? e.touches[0].clientY : null;
  dragStartX = e.touches[0].clientX;
  dragDy = 0;
}, { passive: true });
panel.addEventListener('touchmove', (e) => {
  if (dragStartY == null) return;
  const dx = e.touches[0].clientX - dragStartX;
  dragDy = e.touches[0].clientY - dragStartY;
  if (Math.abs(dx) > Math.abs(dragDy) && Math.abs(dx) > 10) {
    endDrag(); // mostly sideways: not a dismiss gesture
    panel.style.transform = '';
  } else if (dragDy > 0) {
    panel.style.transition = 'none';
    panel.style.transform = `translateY(${dragDy}px)`;
  } else if (dragDy < -8) {
    endDrag(); // scrolling up: let the content scroll
    panel.style.transform = '';
  }
}, { passive: true });
panel.addEventListener('touchend', () => {
  if (dragStartY == null) return;
  endDrag();
  if (dragDy > 110) dismissSheet();
  else panel.style.transform = '';
});

function photoStrip(ids, title) {
  if (!ids?.length) return '';
  return `<div class="photo-strip">${ids.map((id, i) => `<img data-photo="${esc(id)}" alt="${esc(`Photo ${i + 1} from ${title}`)}">`).join('')}</div>`;
}
function hydratePhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) photoUrl(img.dataset.photo).then((u) => u && (img.src = u));
  for (const img of root.querySelectorAll('.photo-strip img')) {
    img.addEventListener('click', () => {
      if (!img.src) return;
      const v = $('#viewer');
      const big = document.createElement('img');
      big.alt = 'Trip photo';
      big.src = img.src;
      v.replaceChildren(big);
      v.hidden = false;
    });
  }
}
$('#viewer').addEventListener('click', () => ($('#viewer').hidden = true));

function tripCard(t) {
  return `<article class="trip-card">
    ${
      t.photoIds?.length
        ? photoStrip(t.photoIds, tripTitle(t))
        : `<button class="add-photos" data-edit="${esc(t.id)}">${ICON.camera}<span>Add photos to remember this trip</span></button>`
    }
    <h2>${esc(tripTitle(t))}</h2>
    <div class="muted">${t.start ? esc(fmtRange(t)) : 'No dates yet'}</div>
    <div class="chips">${t.stops.map((s) => `<span class="chip">${flag(s.countryCode)} ${esc(s.name)}</span>`).join('')}</div>
    ${t.notes ? `<p class="notes">${esc(t.notes)}</p>` : ''}
    <div class="btn-row"><button class="btn btn-ghost" data-edit="${esc(t.id)}">Edit</button><button class="btn btn-ghost" data-globe="${esc(t.id)}">Show on globe</button></div>
  </article>`;
}
function wireTripCards(root) {
  for (const b of root.querySelectorAll('[data-edit]')) b.addEventListener('click', () => openEditor(trips.find((t) => t.id === b.dataset.edit)));
  for (const b of root.querySelectorAll('[data-globe]'))
    b.addEventListener('click', () => {
      const t = trips.find((x) => x.id === b.dataset.globe);
      closeSheet();
      showTab('globe');
      if (t?.stops[0]) flyTo(t.stops[0].lat, t.stops[0].lon);
    });
  hydratePhotos(root);
}

function openTrip(t) {
  if (!t) return;
  openSheet(tripCard(t).replace('class="trip-card"', 'class="trip-card solo"'));
  wireTripCards(sheetBody);
}

function openCity(d) {
  const s = d.stop;
  const sub = [s.admin1, countryName(s.countryCode)].filter(Boolean).join(', ');
  openSheet(`<div class="sheet-head"><div class="big-flag">${flag(s.countryCode)}</div><div><h2>${esc(s.name)}</h2><div class="muted">${esc(sub)}</div></div></div>
    ${sortTrips(d.trips).map(tripCard).join('')}`);
  wireTripCards(sheetBody);
}

function openCountry(code) {
  const ts = sortTrips(trips.filter((t) => t.stops.some((s) => s.countryCode === code)));
  const cities = [...stats.cities.values()].filter((c) => c.stop.countryCode === code).map((c) => c.stop.name);
  openSheet(`<div class="sheet-head"><div class="big-flag">${flag(code)}</div><div><h2>${esc(countryName(code))}</h2>
    <div class="muted">${cities.length} ${cities.length === 1 ? 'city' : 'cities'} · ${ts.length} ${ts.length === 1 ? 'visit' : 'visits'}</div></div></div>
    <button class="btn btn-wide" id="btn-revisit">${ICON.plus} Add another visit to ${esc(countryName(code))}</button>
    ${ts.map(tripCard).join('')}`);
  wireTripCards(sheetBody);
  // Start the new visit with the cities from the latest one; remove any you didn't go to.
  $('#btn-revisit').addEventListener('click', () =>
    openEditor(null, { stops: (ts[0]?.stops || []).filter((s) => s.countryCode === code) }),
  );
}

// ---------- editor ----------
let draft = null;
let draftDirty = false; // any edit since the form opened

function openEditor(t, preset = {}) {
  draft = t
    ? { ...t, stops: [...t.stops], photoIds: [...(t.photoIds || [])], newPhotos: [], removed: [] }
    : { id: null, title: '', start: '', end: '', notes: '', stops: [...(preset.stops || [])], photoIds: [], newPhotos: [], removed: [] };
  openSheet(
    `<form id="editor" class="editor" autocomplete="off">
      <div class="editor-head"><button type="button" class="link" id="ed-cancel">Cancel</button><h2>${t ? 'Edit trip' : 'New trip'}</h2><button type="submit" class="link strong">Save</button></div>
      <label class="field"><span>Where did you go?</span>
        <div class="search"><input id="ed-search" type="search" placeholder="Search a city, e.g. Kyoto" enterkeyhint="search"></div>
      </label>
      <ul id="ed-results" class="results"></ul>
      <div id="ed-stops" class="chips"></div>
      <div class="field-row">
        <label class="field"><span>From</span><input type="date" id="ed-start" value="${esc(draft.start)}"></label>
        <label class="field"><span>To</span><input type="date" id="ed-end" value="${esc(draft.end)}"></label>
      </div>
      <label class="field"><span>Trip name <em>(optional)</em></span><input id="ed-title" value="${esc(draft.title)}" placeholder="e.g. Spring break in Japan"></label>
      <div class="field"><span>Photos</span>
        <div id="ed-photos" class="photo-grid"></div>
      </div>
      <label class="field"><span>Notes</span><textarea id="ed-notes" rows="3" placeholder="What do you want to remember?">${esc(draft.notes)}</textarea></label>
      <p id="ed-error" class="error" hidden></p>
      ${t ? '<button type="button" class="btn btn-danger" id="ed-delete">Delete trip</button>' : ''}
    </form>`,
    { tall: true },
  );
  draftDirty = false;
  renderStops();
  renderPhotoGrid();
  $('#editor').addEventListener('input', (e) => {
    if (e.target.id !== 'ed-search') draftDirty = true;
  });
  const input = $('#ed-search');
  let timer;
  let seq = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) {
      $('#ed-results').innerHTML = '';
      return;
    }
    timer = setTimeout(async () => {
      const mine = ++seq;
      $('#ed-results').innerHTML = '<li class="muted">Searching…</li>';
      try {
        const res = await searchCities(q);
        if (mine !== seq) return;
        renderResults(res);
      } catch {
        if (mine !== seq) return;
        $('#ed-results').innerHTML = `<li class="muted">${navigator.onLine ? "Couldn't search right now. Try again." : 'City search needs an internet connection.'}</li>`;
      }
    }, 300);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
  $('#ed-cancel').addEventListener('click', dismissSheet);
  $('#editor').addEventListener('submit', saveDraft);
  $('#ed-delete')?.addEventListener('click', deleteDraft);
  if (!t) setTimeout(() => input.focus(), 300);
}

async function searchCities(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('search failed');
  const j = await r.json();
  // Drop airports, stations and hotels; list towns, islands and regions before
  // other landmarks (GeoNames feature codes), keeping the API's order otherwise.
  const skip = /^(AIR|RSTN|HTL|BLDG)/;
  const placeLike = /^(PPL|ISL|ADM|PCL|ARCH|PRSH)/;
  const all = (j.results || []).filter((x) => x.country_code && !skip.test(x.feature_code || ''));
  return [...all.filter((x) => placeLike.test(x.feature_code || '')), ...all.filter((x) => !placeLike.test(x.feature_code || ''))];
}

function renderResults(res) {
  const ul = $('#ed-results');
  if (!res.length) {
    ul.innerHTML = '<li class="muted">No places found.</li>';
    return;
  }
  ul.innerHTML = res
    .map(
      (r, i) => `<li><button type="button" data-i="${i}"><span class="flag">${flag(r.country_code)}</span>
      <span><b>${esc(r.name)}</b><br><small class="muted">${esc([r.admin1, r.country || countryName(r.country_code)].filter(Boolean).join(', '))}</small></span></button></li>`,
    )
    .join('');
  for (const b of ul.querySelectorAll('button')) {
    b.addEventListener('click', () => {
      const r = res[+b.dataset.i];
      if (!draft.stops.some((s) => s.geoId === r.id)) {
        draft.stops.push({
          geoId: r.id,
          name: r.name,
          admin1: r.admin1 || '',
          countryCode: r.country_code.toUpperCase(),
          lat: r.latitude,
          lon: r.longitude,
        });
      }
      $('#ed-search').value = '';
      ul.innerHTML = '';
      draftDirty = true;
      renderStops();
    });
  }
}

function renderStops() {
  const el = $('#ed-stops');
  el.innerHTML = draft.stops.length
    ? draft.stops
        .map((s, i) => `<span class="chip removable">${flag(s.countryCode)} ${esc(s.name)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(s.name)}">${ICON.close}</button></span>`)
        .join('')
    : '<span class="muted small">Add one or more cities from this trip.</span>';
  for (const b of el.querySelectorAll('[data-rm]'))
    b.addEventListener('click', () => {
      draft.stops.splice(+b.dataset.rm, 1);
      draftDirty = true;
      renderStops();
    });
}

function renderPhotoGrid() {
  const el = $('#ed-photos');
  const items = [
    ...draft.photoIds.map((id) => ({ kind: 'saved', id })),
    ...draft.newPhotos.map((p, i) => ({ kind: 'new', i, url: p.url })),
  ];
  el.innerHTML =
    items
      .map(
        (p, idx) => `<div class="ph" ${p.kind === 'saved' ? `data-photo="${esc(p.id)}"` : `style="background-image:url('${p.url}')"`}>
        ${idx === 0 ? '<span class="cover-tag">Cover</span>' : ''}
        <button type="button" data-kind="${p.kind}" data-key="${p.kind === 'saved' ? esc(p.id) : p.i}" aria-label="Remove photo">${ICON.close}</button></div>`,
      )
      .join('') +
    `<label class="ph add"><input type="file" accept="image/*" multiple hidden id="ed-file">${ICON.camera}<small>Add photos</small></label>`;
  for (const ph of el.querySelectorAll('.ph[data-photo]')) photoUrl(ph.dataset.photo).then((u) => u && (ph.style.backgroundImage = `url("${u}")`));
  for (const b of el.querySelectorAll('.ph button')) {
    b.addEventListener('click', () => {
      if (b.dataset.kind === 'saved') {
        draft.photoIds = draft.photoIds.filter((x) => x !== b.dataset.key);
        draft.removed.push(b.dataset.key);
      } else {
        const [p] = draft.newPhotos.splice(+b.dataset.key, 1);
        URL.revokeObjectURL(p.url);
      }
      draftDirty = true;
      renderPhotoGrid();
    });
  }
  $('#ed-file').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    const label = e.target.closest('.ph');
    label.classList.add('busy');
    for (const f of files) {
      try {
        const blob = await db.shrinkImage(f);
        draft.newPhotos.push({ blob, url: URL.createObjectURL(blob) });
      } catch (err) {
        showError(err.message);
      }
    }
    draftDirty = true;
    renderPhotoGrid();
  });
}

function cleanupDraftPhotos() {
  for (const p of draft?.newPhotos || []) URL.revokeObjectURL(p.url);
}

function showError(text) {
  const e = $('#ed-error');
  e.textContent = text;
  e.hidden = !text;
}

async function saveDraft(e) {
  e.preventDefault();
  if (!draft.stops.length) {
    showError('Add at least one city.');
    $('#ed-search').focus();
    return;
  }
  const start = $('#ed-start').value;
  let end = $('#ed-end').value;
  if (start && end && end < start) {
    showError('The end date is before the start date.');
    return;
  }
  const newIds = [];
  for (const p of draft.newPhotos) {
    const id = db.uid();
    await db.putPhoto(id, p.blob);
    photoUrls.set(id, p.url); // reuse the preview URL
    newIds.push(id);
  }
  for (const id of draft.removed) {
    await db.deletePhoto(id);
    if (photoUrls.has(id)) URL.revokeObjectURL(photoUrls.get(id));
    photoUrls.delete(id);
  }
  const existing = draft.id ? trips.find((t) => t.id === draft.id) : null;
  const trip = {
    id: draft.id || db.uid(),
    title: $('#ed-title').value.trim(),
    start,
    end,
    notes: $('#ed-notes').value.trim(),
    stops: draft.stops,
    photoIds: [...draft.photoIds, ...newIds],
    createdAt: existing?.createdAt || Date.now(),
  };
  trips = existing ? trips.map((t) => (t.id === trip.id ? trip : t)) : [...trips, trip];
  await db.saveTrips(trips);
  draft = null;
  afterChange();
  closeSheet();
  if (currentTab === 'globe') flyTo(trip.stops[0].lat, trip.stops[0].lon);
}

async function deleteDraft() {
  const t = trips.find((x) => x.id === draft.id);
  if (!t || !confirm(`Delete "${tripTitle(t)}"? This can't be undone.`)) return;
  for (const id of t.photoIds || []) await db.deletePhoto(id);
  cleanupDraftPhotos();
  trips = trips.filter((x) => x.id !== t.id);
  await db.saveTrips(trips);
  draft = null;
  afterChange();
  closeSheet();
}

function afterChange() {
  stats = computeStats();
  renderHeader();
  refreshGlobe();
  if (currentTab === 'trips') renderTrips();
  if (currentTab === 'stats') renderStats();
}

$('#fab').addEventListener('click', () => openEditor(null));

// ---------- boot ----------
async function reload() {
  trips = await db.loadTrips();
  afterChange();
}

(async () => {
  await reload();
  const latest = sortTrips(trips)[0];
  if (latest?.stops[0]) globe.pointOfView({ lat: latest.stops[0].lat, lng: latest.stops[0].lon, altitude: homeAltitude() }, 0);
  else globe.pointOfView({ lat: 25, lng: 10, altitude: homeAltitude() }, 0);
  navigator.storage?.persist?.();
})();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
