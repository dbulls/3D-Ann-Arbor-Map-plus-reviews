/* Ann Arbor in 3D — MapLibre GL JS with OpenFreeMap vector tiles (OpenStreetMap
   data) and AWS Terrarium elevation tiles. No API keys required. */

const HOME = { center: [-83.7412, 42.2782], zoom: 15.4, pitch: 62, bearing: -18 };
const BOUNDS = [[-83.98, 42.14], [-83.52, 42.42]];
const TERRAIN = { source: 'dem', exaggeration: 1.8 };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CAR_MIN_ZOOM = 14.5; // cars are too small to see below this

/* ---------- Colours ---------- */
const P = {
  bg: '#ebe7de', urban: '#e6e1d7', campus: '#efe6cf', wood: '#bcd6a6', grass: '#d3e3bd',
  park: '#c5dfae', pitch: '#b5d69c', water: '#8fbfe0', waterway: '#8fbfe0',
  path: '#c9bfae', minor: '#ffffff', major: '#fff1b8', motorway: '#f6c35f', rail: '#a9a39a',
  bldg: ['#f4f1ea', '#e6dcc8', '#9fb4cc', '#2f5f93'], hover: '#ffcb05',
  label: '#22303f', halo: 'rgba(255,255,255,0.9)', roadLabel: '#5b6470',
  shade: '#5a4a3a', highlight: '#ffffff',
  sky: { 'sky-color': '#7fb2e6', 'horizon-color': '#dfeaf5', 'fog-color': '#e6ebee' },
  light: { anchor: 'map', position: [1.5, 210, 40], color: '#ffffff', intensity: 0.45 }
};

const skyFor = (p) => Object.assign({
  'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.55, 'atmosphere-blend': 0
}, p.sky);

/* ---------- Style layers ---------- */
const roadWidth = (a, b) => ['interpolate', ['exponential', 1.6], ['zoom'], 11, a, 18, b];
const classIn = (...classes) => ['in', ['get', 'class'], ['literal', classes]];
const HEIGHT = ['coalesce', ['get', 'render_height'], 8];

function buildLayers(p) {
  const road = (id, filter, color, a, b, extra = {}) => ({
    id, type: 'line', source: 'omt', 'source-layer': 'transportation', filter,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: Object.assign({ 'line-color': color, 'line-width': roadWidth(a, b) }, extra.paint),
    ...(extra.minzoom ? { minzoom: extra.minzoom } : {})
  });
  const fill = (id, layer, filter, color) => ({
    id, type: 'fill', source: 'omt', 'source-layer': layer,
    ...(filter ? { filter } : {}), paint: { 'fill-color': color }
  });

  return [
    { id: 'bg', type: 'background', paint: { 'background-color': p.bg } },
    fill('urban', 'landuse', classIn('residential', 'commercial', 'retail', 'industrial'), p.urban),
    fill('campus', 'landuse', classIn('school', 'university', 'college', 'hospital'), p.campus),
    fill('grass', 'landcover', classIn('grass', 'farmland'), p.grass),
    fill('wood', 'landcover', classIn('wood'), p.wood),
    fill('park', 'park', null, p.park),
    fill('pitch', 'landuse', classIn('pitch', 'stadium', 'track', 'playground'), p.pitch),
    {
      id: 'hillshade', type: 'hillshade', source: 'dem-shade',
      paint: {
        'hillshade-exaggeration': 0.45,
        'hillshade-shadow-color': p.shade,
        'hillshade-highlight-color': p.highlight,
        'hillshade-accent-color': p.shade
      }
    },
    {
      id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
      paint: { 'line-color': p.waterway, 'line-width': roadWidth(0.8, 6) }
    },
    fill('water', 'water', null, p.water),

    road('path', classIn('path', 'track'), p.path, 0.3, 3,
      { minzoom: 14, paint: { 'line-dasharray': [2, 1.5] } }),
    road('minor', classIn('minor', 'service'), p.minor, 0.4, 12, { minzoom: 12 }),
    road('mid', classIn('tertiary', 'secondary'), p.minor, 1, 18),
    road('major', classIn('primary', 'trunk'), p.major, 1.4, 24),
    road('motorway', classIn('motorway'), p.motorway, 1.8, 28),
    {
      id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: classIn('rail'),
      paint: { 'line-color': p.rail, 'line-width': roadWidth(0.6, 4), 'line-dasharray': [3, 2] }
    },

    {
      id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color':
          ['interpolate', ['linear'], HEIGHT, 0, p.bldg[0], 12, p.bldg[1], 35, p.bldg[2], 90, p.bldg[3]],
        'fill-extrusion-height': HEIGHT,
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-vertical-gradient': true,
        'fill-extrusion-opacity': 1
      }
    },
    {
      id: 'cars', type: 'fill-extrusion', source: 'cars', minzoom: CAR_MIN_ZOOM,
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'h'],
        'fill-extrusion-base': ['get', 'b']
      }
    },
    {
      id: 'building-hover', type: 'fill-extrusion', source: 'hover',
      paint: {
        'fill-extrusion-color': p.hover,
        'fill-extrusion-height': ['get', 'h'],
        'fill-extrusion-base': ['get', 'b']
      }
    },

    {
      id: 'label-road', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
      layout: {
        'symbol-placement': 'line', 'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-letter-spacing': 0.04
      },
      paint: { 'text-color': p.roadLabel, 'text-halo-color': p.halo, 'text-halo-width': 1.4 }
    },
    {
      id: 'label-water', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 12 },
      paint: { 'text-color': p.roadLabel, 'text-halo-color': p.halo, 'text-halo-width': 1.2 }
    },
    {
      id: 'label-place', type: 'symbol', source: 'omt', 'source-layer': 'place',
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
        'text-size': ['match', ['get', 'class'], 'city', 18, 'town', 15, 12],
        'text-transform': ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter'], 'uppercase', 'none'],
        'text-letter-spacing': 0.06, 'text-max-width': 8
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.6 }
    }
  ];
}

function buildStyle(p) {
  const dem = () => ({
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium', tileSize: 256, maxzoom: 14,
    attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen terrain tiles on AWS</a>'
  });
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      dem: dem(),
      'dem-shade': dem(), // separate source: sharing one between terrain and hillshade degrades both
      hover: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      cars: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
    },
    layers: buildLayers(p),
    terrain: TERRAIN,
    sky: skyFor(p),
    light: p.light
  };
}

/* ---------- Map ---------- */
const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(P),
  center: HOME.center,
  zoom: reduceMotion ? HOME.zoom : 12.3,
  pitch: reduceMotion ? HOME.pitch : 20,
  bearing: reduceMotion ? HOME.bearing : 0,
  minZoom: 11,
  maxZoom: 19,
  maxPitch: 80,
  maxBounds: BOUNDS,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.FullscreenControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right');

// Keep the camera target clear of the panel: left of it on wide screens,
// above the bottom sheet on narrow ones.
function framing() {
  const panelEl = document.getElementById('panel');
  return window.innerWidth > 700
    ? { top: 0, right: 0, bottom: 0, left: panelEl.offsetWidth + 32 }
    : { top: 0, right: 0, bottom: panelEl.offsetHeight + 16, left: 0 };
}
function goTo(pose, duration) {
  const target = { ...pose, padding: framing() };
  if (reduceMotion) map.jumpTo(target);
  else map.flyTo({ ...target, duration, curve: 1.3, essential: true });
}

map.on('load', () => {
  map.resize();
  goTo(HOME, 5000);
});

/* ---------- Your data: reviews, places you added, building names ---------- */
// server.py saves this to data/my-data.json. It is also mirrored in this browser,
// which is what gets used if the map is served without server.py.
//   places:    restaurants and bars you added (several can share one building)
//   buildings: names you gave buildings
//   reviews:   { placeKey: [review, ...] }
const LOCAL_KEY = 'aa3d-my-data';
let userData = { version: 2, reviews: {}, places: [], buildings: [] };
let savingToFile = true;

const toastEl = el('div', 'toast');
toastEl.setAttribute('role', 'status');
document.body.append(toastEl);
function toast(message, ms = 2600) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)); } catch (err) { return null; }
}
function writeLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(userData)); } catch (err) { /* private mode */ }
}
const validData = (d) => !!d && typeof d.reviews === 'object' && Array.isArray(d.buildings);
const isEmptyData = (d) => !Object.keys(d.reviews).length && !d.buildings.length;
const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2));

const userDataReady = fetch('/api/data', { cache: 'no-store' })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((fromFile) => {
    const local = readLocal();
    if (validData(fromFile) && !(isEmptyData(fromFile) && validData(local) && !isEmptyData(local))) {
      userData = fromFile;
      writeLocal();
    } else if (validData(local)) {
      userData = local; // first run with server.py after using the map without it
      saveUserData();
    }
  })
  .catch(() => {
    savingToFile = false;
    const local = readLocal();
    if (validData(local)) userData = local;
    toast('Saving in this browser only. Start the map with "python3 server.py" to save to a file.', 8000);
  })
  .then(() => { if (migrate()) saveUserData(); });

// Version 1 stored a restaurant you added as the building's own name and type, which
// allowed only one per building. Move each into the places list; its reviews keep
// the same key, and the building keeps the name you gave it.
function migrate() {
  let changed = false;
  if (!Array.isArray(userData.places)) { userData.places = []; changed = true; }
  for (const b of userData.buildings) {
    if (b.kind === 'food' || b.kind === 'bars') {
      userData.places.push({ id: b.id, name: b.name, kind: b.kind, lng: b.lng, lat: b.lat,
                             created: b.created, updated: b.updated });
      delete b.kind;
      changed = true;
    }
  }
  if (userData.version !== 2) { userData.version = 2; changed = true; }
  return changed;
}

let saveChain = Promise.resolve();
function saveUserData(message) {
  writeLocal();
  if (!savingToFile) { if (message) toast(message); return; }
  const body = JSON.stringify(userData);
  saveChain = saveChain
    .then(() => fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body }))
    .then((r) => { if (!r.ok) throw new Error(r.status); if (message) toast(message); })
    .catch(() => toast('Couldn’t save to the file. It’s kept in this browser for now.', 5000));
}

/* ---------- Places: food and bar filters, pins, and the in-view list ---------- */
const CATEGORIES = [
  { id: 'food', label: 'Food', color: '#e4572e' },
  { id: 'bars', label: 'Bars', color: '#9b5de5' }
];
const FOLD = { coffee: 'food' }; // cafés are listed under Food
const REVIEWED = 'reviewed';     // the "My reviews" filter
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const MAX_RESULTS = 150;

const popup = new maplibregl.Popup({ offset: 16, maxWidth: '300px' });
const filtersEl = document.getElementById('filters');
const resultsEl = document.getElementById('results');
const resultsHead = document.getElementById('results-count');
const resultsEmpty = document.getElementById('results-empty');
const clearBtn = document.getElementById('clear-filters');
const active = new Set(); // selected filter ids
const chips = new Map();  // filter id -> chip button
let basePlaces = [];      // from places.json
let places = [];          // basePlaces plus restaurants/bars you added; index = feature id
let placesReady = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function button(text, className, onClick) {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const placeKey = (name, lng, lat) => `${name}@${lng.toFixed(4)},${lat.toFixed(4)}`;
const reviewsOf = (p) => userData.reviews[p.key] || [];
function averageStars(p) {
  const list = reviewsOf(p);
  return list.length ? list.reduce((sum, r) => sum + r.stars, 0) / list.length : 0;
}
const starString = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

// A teardrop map pin in the category's colour, drawn at 2x for sharp rendering.
// Places you have reviewed get a star instead of a dot.
function pinImage(color, starred) {
  const canvas = document.createElement('canvas');
  canvas.width = 52; canvas.height = 68;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.beginPath();
  ctx.moveTo(13, 32);
  ctx.bezierCurveTo(13, 26, 3, 21, 3, 13);
  ctx.arc(13, 13, 10, Math.PI, 0);
  ctx.bezierCurveTo(23, 21, 13, 26, 13, 32);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = starred ? '#ffcb05' : '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  if (starred) {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.6 : 6.2;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(13 + r * Math.cos(a), 13.4 + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = '#ffcb05';
  } else {
    ctx.arc(13, 13, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
  }
  ctx.fill();
  return ctx.getImageData(0, 0, 52, 68);
}

function placesGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature', id: p.id,
      properties: { n: p.name, c: p.cat, r: reviewsOf(p).length > 0 },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
    }))
  };
}

// Restaurants and bars you added to buildings become places too.
function rebuildPlaces() {
  const yours = userData.places
    .filter((b) => CAT[b.kind])
    .map((b) => ({ name: b.name, cat: b.kind, kind: 'Added by you', lng: b.lng, lat: b.lat,
                   key: `custom:${b.id}`, custom: b }));
  places = [...basePlaces, ...yours].map((p, id) => ({ ...p, id }));
  const src = map.getSource('places');
  if (src) src.setData(placesGeoJSON());
}

const mapLoaded = new Promise((resolve) => map.on('load', resolve));
const placesData = fetch('places.json').then((r) => r.json());

Promise.all([placesData, mapLoaded, userDataReady]).then(([data]) => {
  for (const [name, c, kind, lng, lat] of data.places) {
    const cat = FOLD[data.categories[c]] || data.categories[c];
    if (CAT[cat]) basePlaces.push({ name, cat, kind, lng, lat, key: placeKey(name, lng, lat) });
  }
  rebuildPlaces();

  for (const c of CATEGORIES) {
    map.addImage(`pin-${c.id}`, pinImage(c.color, false), { pixelRatio: 2 });
    map.addImage(`pin-${c.id}-r`, pinImage(c.color, true), { pixelRatio: 2 });
  }
  map.addSource('places', {
    type: 'geojson', data: placesGeoJSON(),
    attribution: 'Places: OpenStreetMap, <a href="https://overturemaps.org/">Overture Maps</a>'
  });
  const pinLayout = {
    'icon-image': ['concat', 'pin-', ['get', 'c'], ['case', ['get', 'r'], '-r', '']],
    'icon-anchor': 'bottom',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'symbol-sort-key': ['case', ['get', 'r'], 1, 0] // reviewed pins draw on top
  };
  map.addLayer({
    id: 'places', type: 'symbol', source: 'places',
    filter: placesFilter(),
    layout: { ...pinLayout, 'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 1] }
  });
  // The hovered pin, redrawn larger on top (with its name when hovered from the list).
  map.addLayer({
    id: 'place-hover', type: 'symbol', source: 'places',
    filter: ['==', ['id'], -1],
    layout: {
      ...pinLayout, 'icon-size': 1.4,
      'text-field': '', 'text-font': ['Noto Sans Bold'], 'text-size': 13,
      'text-anchor': 'top', 'text-offset': [0, 0.3], 'text-allow-overlap': true
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(8,20,38,0.95)', 'text-halo-width': 2 }
  });

  const filters = [...CATEGORIES, { id: REVIEWED, label: 'My reviews' }];
  for (const f of filters) {
    const chip = button('', '', () => setFilter(f.id, !active.has(f.id)));
    chip.setAttribute('aria-pressed', 'false');
    let mark;
    if (f.id === REVIEWED) {
      mark = el('span', 'star-dot', '★');
      mark.setAttribute('aria-hidden', 'true');
    } else {
      mark = el('span', 'dot');
      mark.style.background = f.color;
      chip.title = `${basePlaces.filter((p) => p.cat === f.id).length} places`;
    }
    chip.append(mark, f.label);
    chips.set(f.id, chip);
    filtersEl.append(chip);
  }
  placesReady = true;
  applyFilters();
});

function placesFilter() {
  const cats = [...active].filter((id) => id !== REVIEWED);
  return ['any', ['in', ['get', 'c'], ['literal', cats]],
    active.has(REVIEWED) ? ['==', ['get', 'r'], true] : false];
}
const isShown = (p) => active.has(p.cat) || (active.has(REVIEWED) && reviewsOf(p).length > 0);

function setFilter(id, on) {
  if (on) active.add(id); else active.delete(id);
  const chip = chips.get(id);
  if (chip) chip.setAttribute('aria-pressed', String(on));
  applyFilters();
}

function applyFilters() {
  map.setFilter('places', placesFilter());
  clearBtn.hidden = active.size === 0;
  if (popup.isOpen() && popup.place && !isShown(popup.place)) popup.remove();
  updateResults();
}

clearBtn.addEventListener('click', () => [...active].forEach((id) => setFilter(id, false)));

// List the filtered places that are on screen right now (and not under the panel),
// nearest the middle of the view first.
function updateResults() {
  if (!placesReady) return;
  resultsEl.replaceChildren();
  if (active.size === 0) {
    resultsHead.textContent = 'In view';
    resultsEmpty.textContent = 'Pick Food or Bars to drop pins on the map, or My reviews to see places you’ve rated.';
    resultsEmpty.hidden = false;
    return;
  }
  const canvas = map.getCanvas();
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const bounds = map.getBounds();
  const cover = panel.getBoundingClientRect();
  const visible = [];
  for (const p of places) {
    if (!isShown(p) || !bounds.contains([p.lng, p.lat])) continue;
    const s = map.project([p.lng, p.lat]);
    if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
    if (s.x >= cover.left && s.x <= cover.right && s.y >= cover.top && s.y <= cover.bottom) continue;
    visible.push({ p, d: (s.x - w / 2) ** 2 + (s.y - h / 2) ** 2 });
  }
  visible.sort((a, b) => a.d - b.d);

  resultsHead.textContent = visible.length > MAX_RESULTS
    ? `${visible.length} in view · nearest ${MAX_RESULTS} shown`
    : `${visible.length} in view`;
  resultsEmpty.textContent = active.has(REVIEWED) && active.size === 1
    ? 'None of your reviewed places are on screen. Pan or zoom out.'
    : 'Nothing matching is on screen. Pan or zoom out.';
  resultsEmpty.hidden = visible.length > 0;

  for (const { p } of visible.slice(0, MAX_RESULTS)) {
    const item = el('li');
    const row = button('', '', () => selectPlace(p, true));
    const dot = el('span', 'dot');
    dot.style.background = CAT[p.cat].color;
    const text = el('span', 'text');
    const sub = el('span', 'kind', placeKind(p));
    if (reviewsOf(p).length) sub.prepend(el('span', 'rating', `★ ${averageStars(p).toFixed(1)}`), ' · ');
    text.append(el('span', 'name', p.name), sub);
    row.append(dot, text);
    row.addEventListener('mouseenter', () => setPlaceHover(p.id, true));
    row.addEventListener('mouseleave', () => setPlaceHover(null));
    row.addEventListener('focus', () => setPlaceHover(p.id, true));
    row.addEventListener('blur', () => setPlaceHover(null));
    item.append(row);
    resultsEl.append(item);
  }
}

const placeKind = (p) => {
  const label = CAT[p.cat].label;
  return p.kind && p.kind.toLowerCase() !== label.toLowerCase() ? `${p.kind} · ${label}` : label;
};
const placeSummary = (p) => (reviewsOf(p).length
  ? `★ ${averageStars(p).toFixed(1)} · ${placeKind(p)}` : placeKind(p));

const formatDate = (iso) => (iso
  ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined,
    { month: 'short', day: 'numeric', year: 'numeric' })
  : '');

function placeCard(p) {
  const card = el('div', 'popup place');
  const cat = el('p', 'cat', CAT[p.cat].label);
  const dot = el('span', 'dot');
  dot.style.background = CAT[p.cat].color;
  cat.prepend(dot);
  card.append(cat, el('h2', '', p.name));
  if (p.kind) card.append(el('p', 'sub', p.kind));

  const reviews = [...reviewsOf(p)].sort((a, b) =>
    (b.visited || b.created).localeCompare(a.visited || a.created));
  if (reviews.length) {
    const line = el('p', 'rating-line');
    line.append(el('span', 'stars', starString(averageStars(p))),
      ` ${averageStars(p).toFixed(1)} · ${reviews.length} review${reviews.length > 1 ? 's' : ''}`);
    card.append(line);
  }
  const actions = el('div', 'actions');
  actions.append(button(reviews.length ? 'Add another review' : 'Write a review', 'btn primary',
    () => openReview(p, null)));
  if (p.custom) actions.append(button('Remove place', 'btn', () => removeYourPlace(p.custom)));
  card.append(actions);

  for (const r of reviews) {
    const box = el('div', 'review');
    const head = el('div', 'review-head');
    const stars = el('span', 'stars', starString(r.stars));
    stars.setAttribute('aria-label', `${r.stars} out of 5 stars`);
    head.append(stars, el('span', 'date', formatDate(r.visited || r.created)));
    box.append(head);
    const list = el('dl');
    for (const [field, label] of [['food', 'Food'], ['atmosphere', 'Atmosphere'], ['service', 'Service']]) {
      if (r[field]) list.append(el('dt', '', label), el('dd', '', r[field]));
    }
    if (list.childElementCount) box.append(list);
    const tools = el('div', 'review-tools');
    tools.append(button('Edit', 'btn link', () => openReview(p, r)),
      button('Delete', 'btn link', () => deleteReview(p, r)));
    box.append(tools);
    card.append(box);
  }
  return card;
}

// Pan the map just enough to bring an open popup fully into view.
function fitPopup() {
  requestAnimationFrame(() => {
    const node = popup.isOpen() && popup.getElement();
    if (!node) return;
    const box = node.getBoundingClientRect();
    const below = box.bottom - window.innerHeight + 40; // clear of the attribution bar
    const above = box.top - 12;
    if (below > 0) map.panBy([0, Math.min(below, above)], { duration: reduceMotion ? 0 : 300 });
    else if (above < 0) map.panBy([0, above], { duration: reduceMotion ? 0 : 300 });
  });
}

function selectPlace(p, fly) {
  popup.setLngLat([p.lng, p.lat]).setOffset(34).setDOMContent(placeCard(p)).addTo(map);
  popup.place = p;
  if (!fly) fitPopup();
  if (fly) {
    goTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16.5),
           pitch: map.getPitch(), bearing: map.getBearing() }, 1800);
  }
}

/* ---------- Writing reviews ---------- */
const reviewDialog = document.getElementById('review-dialog');
const reviewForm = document.getElementById('review-form');
const reviewError = document.getElementById('review-error');
let reviewTarget = null; // { place, review }

function openReview(place, review) {
  reviewTarget = { place, review };
  reviewForm.reset();
  document.getElementById('review-title').textContent = place.name;
  document.getElementById('review-kicker').textContent = review ? 'Edit your review' : 'Your review';
  const f = reviewForm.elements;
  if (review) {
    reviewForm.querySelector(`input[name="stars"][value="${review.stars}"]`).checked = true;
    f.visited.value = review.visited || '';
    f.food.value = review.food || '';
    f.atmosphere.value = review.atmosphere || '';
    f.service.value = review.service || '';
  } else {
    const now = new Date();
    f.visited.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  reviewError.hidden = true;
  reviewDialog.showModal();
}

reviewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = reviewForm.elements;
  const stars = Number(new FormData(reviewForm).get('stars'));
  if (!stars) {
    reviewError.hidden = false;
    reviewForm.querySelector('input[name="stars"]').focus();
    return;
  }
  const { place, review } = reviewTarget;
  const now = new Date().toISOString();
  const entry = review || { id: newId(), created: now };
  Object.assign(entry, {
    stars,
    visited: f.visited.value,
    food: f.food.value.trim(),
    atmosphere: f.atmosphere.value.trim(),
    service: f.service.value.trim(),
    updated: now,
    place: { name: place.name, lng: place.lng, lat: place.lat }
  });
  if (!review) (userData.reviews[place.key] = userData.reviews[place.key] || []).push(entry);
  saveUserData(review ? 'Review updated' : `Review saved for ${place.name}`);
  reviewDialog.close();
  afterReviewChange(place);
});
document.getElementById('review-cancel').addEventListener('click', () => reviewDialog.close());

function deleteReview(place, review) {
  if (!confirm(`Delete your ${review.stars}-star review of ${place.name}?`)) return;
  const list = reviewsOf(place).filter((r) => r !== review);
  if (list.length) userData.reviews[place.key] = list; else delete userData.reviews[place.key];
  saveUserData('Review deleted');
  afterReviewChange(place);
}

function afterReviewChange(place) {
  rebuildPlaces();
  updateResults();
  const fresh = places.find((p) => p.key === place.key);
  if (fresh) selectPlace(fresh, false);
}

let resultsTimer = null;
map.on('moveend', () => {
  clearTimeout(resultsTimer);
  resultsTimer = setTimeout(updateResults, 150);
});

document.getElementById('reset').addEventListener('click', () => {
  popup.remove();
  goTo(HOME, 2500);
});

/* ---------- Cars ---------- */
// Little 3D cars that wander the real street network (roads.json, from OpenStreetMap).
// They are spawned around the middle of the view and recycled when they drive away.
const CAR_COUNT = 160;
const CAR_SCALE = 1.5; // drawn a bit larger than life so they read at city zooms
const CAR_SPEED = [29, 22, 16, 14, 12, 10, 9]; // m/s by road class, motorway -> residential
const CAR_COLORS = ['#d7263d', '#f4f4f2', '#1b1b1e', '#2e86de', '#9aa5b1', '#f6ae2d', '#2d6a4f', '#c0c5ce', '#7d1128'];
const M_PER_LAT = 110540;
const M_PER_LNG = 111320 * Math.cos(42.28 * Math.PI / 180);
const carsOn = !reduceMotion; // cars stay parked for people who prefer reduced motion
let road = null; // { nodes, rank, to: [[node...]], cls: [[class...]] }
const cars = [];

fetch('roads.json').then((r) => r.json()).then((data) => {
  const count = data.rank.length;
  const to = Array.from({ length: count }, () => []);
  const cls = Array.from({ length: count }, () => []);
  for (const [c, oneway, path] of data.ways) {
    for (let i = 0; i < path.length - 1; i++) {
      to[path[i]].push(path[i + 1]); cls[path[i]].push(c);
      if (!oneway) { to[path[i + 1]].push(path[i]); cls[path[i + 1]].push(c); }
    }
  }
  road = { nodes: data.nodes, rank: data.rank, to, cls };
  for (let i = 0; i < CAR_COUNT; i++) {
    cars.push({ color: CAR_COLORS[i % CAR_COLORS.length], pace: 0.8 + Math.random() * 0.4, live: false });
  }
  requestAnimationFrame(carFrame);
}).catch((err) => console.warn('Cars unavailable:', err));

function setEdge(car, from, k) {
  const n = road.nodes;
  const to = road.to[from][k];
  const dx = (n[to * 2] - n[from * 2]) * M_PER_LNG;
  const dy = (n[to * 2 + 1] - n[from * 2 + 1]) * M_PER_LAT;
  const len = Math.hypot(dx, dy) || 0.01;
  car.from = from; car.to = to; car.len = len;
  car.ux = dx / len; car.uy = dy / len;
  car.speed = CAR_SPEED[road.cls[from][k]] * car.pace;
}

// At the end of a segment: usually carry straight on, sometimes turn, never U-turn
// unless it is a dead end.
function nextEdge(car) {
  const at = car.to;
  const options = road.to[at];
  if (!options.length) return false;
  let choices = [];
  for (let k = 0; k < options.length; k++) if (options[k] !== car.from) choices.push(k);
  if (!choices.length) choices = [0];
  let pick = choices[Math.floor(Math.random() * choices.length)];
  if (choices.length > 1 && Math.random() < 0.7) {
    let bestDot = -Infinity;
    const n = road.nodes;
    for (const k of choices) {
      const dx = (n[options[k] * 2] - n[at * 2]) * M_PER_LNG;
      const dy = (n[options[k] * 2 + 1] - n[at * 2 + 1]) * M_PER_LAT;
      const dot = (dx * car.ux + dy * car.uy) / (Math.hypot(dx, dy) || 1);
      if (dot > bestDot) { bestDot = dot; pick = k; }
    }
  }
  setEdge(car, at, pick);
  return true;
}

function spawn(car, candidates) {
  car.live = false;
  if (!candidates.length) return;
  let node = candidates[Math.floor(Math.random() * candidates.length)];
  // Favour busier streets over the far more numerous residential ones.
  for (let tries = 0; tries < 6 && road.rank[node] >= 5 && Math.random() > 0.35; tries++) {
    node = candidates[Math.floor(Math.random() * candidates.length)];
  }
  setEdge(car, node, Math.floor(Math.random() * road.to[node].length));
  car.d = Math.random() * car.len;
  car.live = true;
}

// Recycle cars that have left the area around the middle of the view.
function recycleCars() {
  const c = map.getCenter();
  const radius = Math.min(1400, Math.max(350, 700 * 2 ** (16 - map.getZoom())));
  const rx = radius / M_PER_LNG, ry = radius / M_PER_LAT;
  const n = road.nodes;
  const outside = (lng, lat, f) => Math.abs(lng - c.lng) > rx * f || Math.abs(lat - c.lat) > ry * f;
  const stale = cars.filter((car) => !car.live || outside(n[car.from * 2], n[car.from * 2 + 1], 1.4));
  if (!stale.length) return;
  const candidates = [];
  for (let i = 0; i < road.rank.length; i++) {
    if (road.to[i].length && !outside(n[i * 2], n[i * 2 + 1], 1)) candidates.push(i);
  }
  stale.forEach((car) => spawn(car, candidates));
}

function box(cx, cy, ux, uy, halfLen, halfWid) {
  const fx = ux * halfLen / M_PER_LNG, fy = uy * halfLen / M_PER_LAT;   // forward
  const sx = uy * halfWid / M_PER_LNG, sy = -ux * halfWid / M_PER_LAT;  // to the right
  const a = [cx + fx + sx, cy + fy + sy], b = [cx + fx - sx, cy + fy - sy];
  const c = [cx - fx - sx, cy - fy - sy], d = [cx - fx + sx, cy - fy + sy];
  return [[a, b, c, d, a]];
}

let carClock = 0, carCheck = -Infinity, carsDrawn = false;
function carFrame(t) {
  requestAnimationFrame(carFrame);
  const dt = Math.min((t - carClock) / 1000, 0.1);
  carClock = t;
  const source = map.getSource('cars');
  if (!source) return;
  if (!carsOn || map.getZoom() < CAR_MIN_ZOOM) {
    if (carsDrawn) { source.setData({ type: 'FeatureCollection', features: [] }); carsDrawn = false; }
    return;
  }
  if (t - carCheck > 1000) { carCheck = t; recycleCars(); }

  const n = road.nodes;
  const features = [];
  for (const car of cars) {
    if (!car.live) continue;
    car.d += car.speed * dt;
    while (car.live && car.d >= car.len) {
      car.d -= car.len;
      car.live = nextEdge(car);
    }
    if (!car.live) continue;
    const f = car.d / car.len;
    // Position along the segment, shifted right into the driving lane.
    const x = n[car.from * 2] + (n[car.to * 2] - n[car.from * 2]) * f + (car.uy * 2.2) / M_PER_LNG;
    const y = n[car.from * 2 + 1] + (n[car.to * 2 + 1] - n[car.from * 2 + 1]) * f - (car.ux * 2.2) / M_PER_LAT;
    const k = CAR_SCALE;
    const backX = x - (car.ux * 0.3 * k) / M_PER_LNG, backY = y - (car.uy * 0.3 * k) / M_PER_LAT;
    features.push({
      type: 'Feature', properties: { color: car.color, b: 0.3 * k, h: 1.3 * k },
      geometry: { type: 'Polygon', coordinates: box(x, y, car.ux, car.uy, 2.4 * k, 1.05 * k) }
    }, {
      type: 'Feature', properties: { color: '#1c2530', b: 1.3 * k, h: 2.0 * k },
      geometry: { type: 'Polygon', coordinates: box(backX, backY, car.ux, car.uy, 1.3 * k, 0.9 * k) }
    });
  }
  source.setData({ type: 'FeatureCollection', features });
  carsDrawn = true;
}

const panel = document.getElementById('panel');
const collapseBtn = document.getElementById('collapse');
collapseBtn.addEventListener('click', () => {
  const collapsed = panel.classList.toggle('collapsed');
  collapseBtn.setAttribute('aria-expanded', String(!collapsed));
});

/* ---------- Building names (buildings.json, built from OpenStreetMap) ---------- */
// The map tiles carry no building names, so names and street addresses come from a
// local file of OSM outlines, matched to the hovered building by position.
const CELL = 0.002; // grid cell size in degrees for the spatial index
const nameIndex = new Map();
const cellKey = (x, y) => `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`;

fetch('buildings.json')
  .then((r) => r.json())
  .then((rows) => {
    for (const [label, isName, ring] of rows) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < ring.length; i += 2) {
        minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]);
        minY = Math.min(minY, ring[i + 1]); maxY = Math.max(maxY, ring[i + 1]);
      }
      const entry = { label, isName: !!isName, ring, minX, minY, maxX, maxY };
      for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
        for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
          const key = `${cx}:${cy}`;
          if (!nameIndex.has(key)) nameIndex.set(key, []);
          nameIndex.get(key).push(entry);
        }
      }
    }
  })
  .catch((err) => console.warn('Building names unavailable:', err));

function inFlatRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// outer: [[lng, lat], ...] ring of the hovered building. Sample points inside it and
// return the OSM outline that contains the most of them.
function lookupBuilding(outer) {
  let cx = 0, cy = 0;
  for (const [x, y] of outer) { cx += x; cy += y; }
  cx /= outer.length; cy /= outer.length;
  const step = Math.max(1, Math.floor(outer.length / 12));
  const samples = [[cx, cy]];
  for (let i = 0; i < outer.length; i += step) {
    samples.push([outer[i][0] + (cx - outer[i][0]) * 0.25, outer[i][1] + (cy - outer[i][1]) * 0.25]);
  }
  const seen = new Set();
  let best = null, bestScore = 0;
  for (const [x, y] of samples) {
    for (const entry of nameIndex.get(cellKey(x, y)) || []) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      let score = 0;
      for (const [sx, sy] of samples) {
        if (sx >= entry.minX && sx <= entry.maxX && sy >= entry.minY && sy <= entry.maxY &&
            inFlatRing(sx, sy, entry.ring)) score++;
      }
      // Prefer a real name over a bare address when both cover the building.
      const weighted = score + (entry.isName ? 0.5 : 0);
      if (score >= samples.length / 3 && weighted > bestScore) { best = entry; bestScore = weighted; }
    }
  }
  return best;
}

/* ---------- Building hover + click ---------- */
// Tile features can bundle several separate buildings under one id, and a building
// that crosses a tile edge arrives in pieces. So the hover highlight is drawn from
// the exact polygon under the cursor (plus the rest of that building) in its own layer.
const tip = el('div', 'tip');
tip.hidden = true;
document.body.append(tip);

const polygonsOf = (f) => (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]);
const heightOf = (f) => Number(f.properties.render_height != null ? f.properties.render_height : 8);
const baseOf = (f) => Number(f.properties.render_min_height || 0);

function ringBox(outer) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function inScreenRing(pt, ring, dy) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i].y - dy, yj = ring[j].y - dy;
    if ((yi > pt.y) !== (yj > pt.y) &&
        pt.x < ((ring[j].x - ring[i].x) * (pt.y - yi)) / (yj - yi) + ring[i].x) inside = !inside;
  }
  return inside;
}

// The tiles merge many separate buildings of equal height into one feature, so work
// out which of its polygons the cursor is on: compare the cursor with each polygon's
// on-screen shape (the roof outline first, then the footprint-to-roof extent).
function polygonUnderCursor(feature, e) {
  const polys = polygonsOf(feature);
  if (polys.length === 1) return polys[0];
  const lat = map.getCenter().lat * Math.PI / 180;
  const pxPerMetre = (512 * 2 ** map.getZoom()) / (40075016.686 * Math.cos(lat));
  const lift = heightOf(feature) * pxPerMetre * Math.sin(map.getPitch() * Math.PI / 180);
  const near = 0.006; // degrees; skip polygons nowhere near the cursor before projecting
  let best = null, bestRank = 0, bestArea = Infinity;
  for (const poly of polys) {
    const first = poly[0][0];
    if (Math.abs(first[0] - e.lngLat.lng) > near || Math.abs(first[1] - e.lngLat.lat) > near) continue;
    const screen = poly[0].map((c) => map.project(c));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of screen) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    }
    const pad = 3;
    const p = e.point;
    if (p.x < minX - pad || p.x > maxX + pad || p.y < minY - lift * 1.3 - pad || p.y > maxY + pad) continue;
    const rank = inScreenRing(p, screen, lift) ? 2 : 1;
    const area = (maxX - minX) * (maxY - minY);
    if (rank > bestRank || (rank === bestRank && area < bestArea)) {
      best = poly; bestRank = rank; bestArea = area;
    }
  }
  return best || polys[0];
}

// Every drawn piece that belongs with the hovered polygon. For a building matched to
// an OSM outline that is each part inside the outline (towers, wings, pieces from
// neighbouring tiles); otherwise just overlapping pieces of the same tile feature.
function buildingPieces(feature, poly, match) {
  const pieces = [{ poly, h: heightOf(feature), b: baseOf(feature) }];
  const isSame = (p) => p[0].length === poly[0].length &&
    p[0][0][0] === poly[0][0][0] && p[0][0][1] === poly[0][0][1];
  const a = ringBox(poly[0]);
  const eps = 1e-6;
  for (const other of map.queryRenderedFeatures({ layers: ['buildings'] })) {
    if (!match && other.id !== feature.id) continue;
    for (const p of polygonsOf(other)) {
      const ring = p[0];
      if (isSame(p)) continue;
      if (match) {
        const [x, y] = ring[0];
        if (x < match.minX - eps || x > match.maxX + eps || y < match.minY - eps || y > match.maxY + eps) continue;
        let cx = 0, cy = 0;
        for (const c of ring) { cx += c[0]; cy += c[1]; }
        if (!inFlatRing(cx / ring.length, cy / ring.length, match.ring)) continue;
      } else {
        const b = ringBox(ring);
        if (b.minX > a.maxX + eps || b.maxX < a.minX - eps || b.minY > a.maxY + eps || b.maxY < a.minY - eps) continue;
      }
      pieces.push({ poly: p, h: heightOf(other), b: baseOf(other) });
    }
  }
  return pieces;
}

const pairsOf = (flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
};
const inPairRing = (x, y, ring) => inFlatRing(x, y, ring.flat());

// A point safely inside a building outline (the centre can fall outside an L-shape).
function interiorPoint(ring) {
  let cx = 0, cy = 0;
  for (const [x, y] of ring) { cx += x; cy += y; }
  cx /= ring.length; cy /= ring.length;
  if (inPairRing(cx, cy, ring)) return [cx, cy];
  for (const t of [0.5, 0.7, 0.3, 0.85, 0.15]) {
    for (const [x, y] of ring) {
      const px = x + (cx - x) * t, py = y + (cy - y) * t;
      if (inPairRing(px, py, ring)) return [px, py];
    }
  }
  return ring[0];
}

// A building you named: its saved point lies inside this outline.
function yourBuilding(ring) {
  return userData.buildings.find((b) => inPairRing(b.lng, b.lat, ring)) || null;
}

// Food and bar places whose pin lies inside this outline.
function placesInside(ring) {
  const box = ringBox(ring);
  return places.filter((p) => p.lng >= box.minX && p.lng <= box.maxX && p.lat >= box.minY &&
    p.lat <= box.maxY && inPairRing(p.lng, p.lat, ring));
}

function describe(feature, poly) {
  const match = lookupBuilding(poly[0]);
  const ring = match ? pairsOf(match.ring) : poly[0];
  const yours = yourBuilding(ring);
  const pieces = buildingPieces(feature, poly, match);
  const metres = match
    ? Math.max(...pieces.map((p) => p.h))
    : heightOf(feature) - baseOf(feature);
  let title = 'Unnamed building', kind = 'Building';
  if (yours) { title = yours.name; kind = 'Named by you'; }
  else if (match) { title = match.label; kind = match.isName ? 'Building' : 'Address'; }
  const here = placesInside(ring);
  const height = `${Math.round(metres * 3.281)} ft · ${Math.round(metres)} m`;
  return {
    pieces, match, ring, yours, title, kind, here, height,
    anchor: interiorPoint(ring),
    tipLine: here.length ? `${here.length} place${here.length > 1 ? 's' : ''} · ${height}` : height,
    estimated: feature.properties.render_height == null
  };
}

/* ---------- Building card: places inside, adding places, naming ---------- */
function buildingCard(info, lngLat) {
  const card = el('div', 'popup place');
  card.append(el('p', 'cat', info.kind), el('h2', '', info.title), el('p', 'big', info.height));

  if (info.here.length) {
    card.append(el('p', 'section-label', `In this building (${info.here.length})`));
    const list = el('ul', 'here-list');
    for (const p of [...info.here].sort((a, b) => a.name.localeCompare(b.name))) {
      const row = button('', '', () => selectPlace(p, false));
      const dot = el('span', 'dot');
      dot.style.background = CAT[p.cat].color;
      const text = el('span', 'text');
      text.append(el('span', 'name', p.name), el('span', 'kind', placeSummary(p)));
      row.append(dot, text);
      const item = el('li');
      item.append(row);
      list.append(item);
    }
    card.append(list);
  }
  card.append(addPlaceForm(info, lngLat), nameForm(info, lngLat));
  return card;
}

const keepKeysOffMap = (form) => form.addEventListener('keydown', (e) => e.stopPropagation());

function addPlaceForm(info, lngLat) {
  const form = el('form', 'name-form');
  form.append(el('p', 'section-label',
    info.here.length ? 'Add another restaurant or bar here' : 'Add a restaurant or bar here'));
  const input = el('input');
  input.maxLength = 80;
  input.autocomplete = 'off';
  input.placeholder = 'Name';
  input.setAttribute('aria-label', 'Name of the restaurant or bar');
  const select = el('select');
  select.setAttribute('aria-label', 'Type');
  for (const [value, text] of [['food', 'Restaurant / food'], ['bars', 'Bar']]) {
    const option = el('option', '', text);
    option.value = value;
    select.append(option);
  }
  const add = el('button', 'btn primary', 'Add');
  add.type = 'submit';
  const row = el('div', 'add-row');
  row.append(input, select, add);
  form.append(row);
  keepKeysOffMap(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    addYourPlace(info, name, select.value, lngLat);
  });
  return form;
}

function nameForm(info, lngLat) {
  const details = el('details', 'rename');
  details.append(el('summary', '', info.yours ? 'Rename this building' : 'Name this building'));
  const form = el('form', 'name-form');
  const input = el('input');
  input.maxLength = 80;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Building name');
  input.placeholder = info.match && info.match.isName ? info.match.label : 'Building name';
  input.value = info.yours ? info.yours.name : '';
  const actions = el('div', 'actions');
  const save = el('button', 'btn primary', info.yours ? 'Update' : 'Save name');
  save.type = 'submit';
  actions.append(save);
  if (info.yours) actions.append(button('Remove name', 'btn', () => removeYourBuilding(info.yours, lngLat)));
  form.append(input, actions);
  details.append(form);
  keepKeysOffMap(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    saveYourBuilding(info, name, lngLat);
  });
  return details;
}

// A spot inside the building for a new pin, a few metres clear of the pins already there.
function freeSpot(ring, anchor, taken) {
  const gap = 7; // metres
  const ok = (x, y) => inPairRing(x, y, ring) && taken.every(([tx, ty]) =>
    Math.hypot((tx - x) * M_PER_LNG, (ty - y) * M_PER_LAT) >= gap);
  if (ok(anchor[0], anchor[1])) return anchor;
  for (let r = gap; r <= 80; r += gap / 2) {
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const x = anchor[0] + (r * Math.cos(a)) / M_PER_LNG;
      const y = anchor[1] + (r * Math.sin(a)) / M_PER_LAT;
      if (ok(x, y)) return [x, y];
    }
  }
  return anchor;
}

function addYourPlace(info, name, kind, lngLat) {
  const [lng, lat] = freeSpot(info.ring, info.anchor, info.here.map((p) => [p.lng, p.lat]));
  const now = new Date().toISOString();
  userData.places.push({ id: newId(), name, kind, lng: +lng.toFixed(7), lat: +lat.toFixed(7),
                         created: now, updated: now });
  saveUserData(`Added “${name}”`);
  afterBuildingChange(lngLat);
  if (!active.has(kind)) setFilter(kind, true);
}

function removeYourPlace(b) {
  const n = (userData.reviews[`custom:${b.id}`] || []).length;
  const extra = n ? ` This also deletes your ${n} review${n > 1 ? 's' : ''} of it.` : '';
  if (!confirm(`Remove “${b.name}” from the map?${extra}`)) return;
  userData.places = userData.places.filter((x) => x !== b);
  delete userData.reviews[`custom:${b.id}`];
  saveUserData(`Removed “${b.name}”`);
  popup.remove();
  rebuildPlaces();
  updateResults();
}

function saveYourBuilding(info, name, lngLat) {
  let b = info.yours;
  const now = new Date().toISOString();
  if (!b) {
    b = { id: newId(), lng: +info.anchor[0].toFixed(7), lat: +info.anchor[1].toFixed(7), created: now };
    userData.buildings.push(b);
  }
  Object.assign(b, { name, updated: now });
  saveUserData(`Saved “${name}”`);
  afterBuildingChange(lngLat);
}

function removeYourBuilding(b, lngLat) {
  if (!confirm(`Remove your name “${b.name}” for this building?`)) return;
  userData.buildings = userData.buildings.filter((x) => x !== b);
  saveUserData(`Removed “${b.name}”`);
  afterBuildingChange(lngLat);
}

function afterBuildingChange(lngLat) {
  hoverKey = null;
  rebuildPlaces();
  updateResults();
  const point = map.project(lngLat);
  const feature = buildingAt(point);
  if (!feature) { popup.remove(); return; }
  const info = describe(feature, polygonUnderCursor(feature, { point, lngLat }));
  popup.setDOMContent(buildingCard(info, lngLat));
  fitPopup();
}

let hoverKey = null;   // building currently highlighted
let hoverPlace = null; // place pin currently enlarged

function clearBuildingHighlight() {
  if (hoverKey === null) return;
  hoverKey = null;
  const src = map.getSource('hover');
  if (src) src.setData({ type: 'FeatureCollection', features: [] });
}
function setPlaceHover(id, showName) {
  if (!map.getLayer('place-hover')) return;
  if (id === hoverPlace) return;
  hoverPlace = id;
  map.setLayoutProperty('place-hover', 'text-field', showName ? ['get', 'n'] : '');
  map.setFilter('place-hover', ['==', ['id'], id == null ? -1 : id]);
}
function clearHover() {
  clearBuildingHighlight();
  setPlaceHover(null);
  tip.hidden = true;
  map.getCanvas().style.cursor = '';
}
function showTip(point, title, sub) {
  if (title !== null) {
    tip.replaceChildren(el('strong', '', title), el('span', '', sub));
    tip.hidden = false;
  }
  // Keep the tooltip beside the cursor and inside the window.
  const x = Math.min(point.x + 14, window.innerWidth - tip.offsetWidth - 8);
  const y = Math.max(point.y - tip.offsetHeight - 10, 8);
  tip.style.transform = `translate(${x}px, ${y}px)`;
}
const placeAt = (point) => {
  if (!placesReady || active.size === 0) return null;
  const hit = map.queryRenderedFeatures(
    [[point.x - 4, point.y - 2], [point.x + 4, point.y + 6]], { layers: ['places'] })[0];
  return hit ? places[hit.id] || null : null;
};
const buildingAt = (point) =>
  (map.getLayer('buildings') ? map.queryRenderedFeatures(point, { layers: ['buildings'] })[0] : null);

map.on('mousemove', (e) => {
  // Place pins sit on top of everything, so they win over the building beneath.
  const place = placeAt(e.point);
  if (place) {
    clearBuildingHighlight();
    map.getCanvas().style.cursor = 'pointer';
    const changed = hoverPlace !== place.id;
    setPlaceHover(place.id, false);
    showTip(e.point, changed || tip.hidden ? place.name : null, placeSummary(place));
    return;
  }
  setPlaceHover(null);

  const feature = buildingAt(e.point);
  if (!feature) return clearHover();
  const poly = polygonUnderCursor(feature, e);
  const key = `${feature.id}:${poly[0][0][0]},${poly[0][0][1]}:${poly[0].length}`;
  let info = null;
  if (key !== hoverKey || tip.hidden) {
    hoverKey = key;
    map.getCanvas().style.cursor = 'pointer';
    info = describe(feature, poly);
    map.getSource('hover').setData({
      type: 'FeatureCollection',
      features: info.pieces.map((piece) => ({
        type: 'Feature',
        properties: { h: piece.h + 0.3, b: piece.b },
        geometry: { type: 'Polygon', coordinates: piece.poly }
      }))
    });
  }
  showTip(e.point, info ? info.title : null, info ? info.tipLine : null);
});
map.on('mouseout', clearHover);
map.on('movestart', clearHover);

map.on('click', (e) => {
  const place = placeAt(e.point);
  if (place) return selectPlace(place, false);
  const feature = buildingAt(e.point);
  if (!feature) return;
  const info = describe(feature, polygonUnderCursor(feature, e));
  popup.setLngLat(e.lngLat).setOffset(16).setDOMContent(buildingCard(info, e.lngLat)).addTo(map);
  popup.place = null;
  fitPopup();
});

window.map = map; // handy for debugging in the console
