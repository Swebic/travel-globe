import { createStore, get, set, del, keys } from 'idb-keyval';

// Everything is stored on the device in IndexedDB. Nothing is uploaded.
const store = createStore('travel-globe', 'kv');

export async function loadTrips() {
  return (await get('trips', store)) || [];
}

export async function saveTrips(trips) {
  await set('trips', trips, store);
}

export async function getPhoto(id) {
  return get('photo:' + id, store);
}

export async function putPhoto(id, blob) {
  await set('photo:' + id, blob, store);
}

export async function deletePhoto(id) {
  await del('photo:' + id, store);
}

export async function allPhotoIds() {
  return (await keys(store)).filter((k) => String(k).startsWith('photo:')).map((k) => k.slice(6));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Downscale a picked photo so it is small enough to keep many on a phone.
export async function shrinkImage(file, maxSide = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function exportBackup() {
  const trips = await loadTrips();
  const photos = {};
  for (const t of trips) {
    for (const id of t.photoIds || []) {
      const b = await getPhoto(id);
      if (b) photos[id] = await blobToDataURL(b);
    }
  }
  return { app: 'travel-globe', version: 1, exportedAt: new Date().toISOString(), trips, photos };
}

export async function importBackup(data) {
  if (!data || data.app !== 'travel-globe' || !Array.isArray(data.trips)) {
    throw new Error("That file isn't a Travel Globe backup.");
  }
  const existing = await loadTrips();
  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const t of data.trips) byId.set(t.id, t);
  for (const [id, dataUrl] of Object.entries(data.photos || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await putPhoto(id, blob);
  }
  const merged = [...byId.values()];
  await saveTrips(merged);
  return data.trips.length;
}
