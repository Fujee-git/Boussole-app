/* Boussole au trésor — tout reste sur le téléphone (localStorage). */
'use strict';

// ---------------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'boussole.places.v1';
const SEEDED_KEY = 'boussole.seeded.v1';
const HOME_ASKED_KEY = 'boussole.homeAsked.v1';

const EMOJIS = ['🏠', '💼', '🛒', '🥖', '☕', '🍻', '🍽️', '🏫', '🏥', '💊', '🏋️', '🌳',
  '⚓', '🚉', '🚋', '🅿️', '❤️', '👪', '⭐', '💎', '🏰', '🐘', '⛪', '🏢'];

const COLORS = ['#a3201b', '#1f4e79', '#2d6a2f', '#6b2d82', '#b8860b', '#8b4513', '#1b6b6b', '#c2185b'];

// Repères publics de Nantes (coordonnées approximatives, modifiables).
const PRESETS = [
  { name: 'Château des Ducs', emoji: '🏰', color: '#8b4513', lat: 47.2161, lon: -1.5497 },
  { name: 'Éléphant (Île de Nantes)', emoji: '🐘', color: '#1b6b6b', lat: 47.2066, lon: -1.5642 },
  { name: 'Gare de Nantes', emoji: '🚉', color: '#1f4e79', lat: 47.2174, lon: -1.5422 },
  { name: 'Tour Bretagne', emoji: '🏢', color: '#6b2d82', lat: 47.2177, lon: -1.5588 },
  { name: 'Cathédrale', emoji: '⛪', color: '#b8860b', lat: 47.2183, lon: -1.5508 },
  { name: 'Trentemoult (Rezé)', emoji: '⚓', color: '#2d6a2f', lat: 47.1946, lon: -1.5803 },
];

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadPlaces() {
  let places = [];
  try { places = JSON.parse(storageGet(STORAGE_KEY)) || []; } catch { places = []; }
  if (!storageGet(SEEDED_KEY)) {
    places = places.concat(PRESETS.map(p => ({ ...p, id: uid(), hidden: false, preset: true })));
    storageSet(SEEDED_KEY, '1');
    storageSet(STORAGE_KEY, JSON.stringify(places));
  }
  return places;
}

function savePlaces() {
  if (!storageSet(STORAGE_KEY, JSON.stringify(state.places))) {
    toast('Impossible d\'enregistrer sur ce téléphone 😕');
  }
}

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

const state = {
  places: loadPlaces(),
  position: null,          // { lat, lon, accuracy }
  heading: null,           // degrés, 0 = nord, sens horaire
  smooth: null,            // { x, y } vecteur lissé du cap
  targetId: null,          // lieu suivi en mode « Guide-moi »
  aligned: false,
  arrivedId: null,
  compassOk: false,
  wakeLock: null,
};

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;

function distanceM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  const φ1 = a.lat * RAD, φ2 = b.lat * RAD, Δλ = (b.lon - a.lon) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Angle relatif dans ]-180, 180] : négatif = à gauche. */
function relAngle(bearing, heading) {
  let d = (bearing - heading) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function formatDistance(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  const km = m / 1000;
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

function directionText(rel) {
  const a = Math.abs(rel);
  const side = rel < 0 ? 'gauche' : 'droite';
  if (a <= 15) return 'droit devant toi';
  if (a <= 60) return `un peu sur ta ${side}`;
  if (a <= 120) return `à ta ${side}`;
  if (a <= 160) return `derrière toi, sur la ${side}`;
  return 'juste derrière toi';
}

// ---------------------------------------------------------------------------
// Éléments
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);
const el = {
  compass: $('compass'),
  dial: $('dial'),
  layer: $('places-layer'),
  needle: $('needle'),
  phrase: $('phrase'),
  subphrase: $('subphrase'),
  status: $('status'),
  stopGuide: $('btn-stop-guide'),
  startOverlay: $('start-overlay'),
  screenCompass: $('screen-compass'),
  screenSettings: $('screen-settings'),
  list: $('place-list'),
  dialog: $('place-dialog'),
  form: $('place-form'),
  toast: $('toast'),
};

// Graduations du cadran
(function drawTicks() {
  const g = $('ticks');
  let svg = '';
  for (let d = 0; d < 360; d += 5) {
    const major = d % 45 === 0;
    const mid = d % 15 === 0;
    const r1 = 182, r2 = major ? 166 : mid ? 172 : 177;
    const a = d * RAD;
    const x1 = 200 + r1 * Math.sin(a), y1 = 200 - r1 * Math.cos(a);
    const x2 = 200 + r2 * Math.sin(a), y2 = 200 - r2 * Math.cos(a);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#5a3a1a" stroke-width="${major ? 2.5 : 1.2}"/>`;
  }
  g.innerHTML = svg;
})();

const cardinals = [...document.querySelectorAll('.cardinal')];

// ---------------------------------------------------------------------------
// Rendu de la boussole
// ---------------------------------------------------------------------------

let placeEls = new Map();

function visiblePlaces() {
  return state.places.filter(p => !p.hidden);
}

function buildPlaceEls() {
  el.layer.innerHTML = '';
  placeEls = new Map();
  for (const p of visiblePlaces()) {
    const b = document.createElement('button');
    b.className = 'place';
    b.type = 'button';
    b.style.setProperty('--c', p.color);
    b.innerHTML = `<span class="seal"></span><span class="place-label"><b></b><span class="dist"></span></span>`;
    b.querySelector('.seal').textContent = p.emoji;
    b.querySelector('b').textContent = p.name;
    b.setAttribute('aria-label', p.name);
    b.addEventListener('click', () => toggleGuide(p.id));
    el.layer.appendChild(b);
    placeEls.set(p.id, b);
  }
  if (state.targetId && !placeEls.has(state.targetId)) stopGuide();
  layoutPlaces();
}

/** Taille du sceau selon la distance : proche = gros, loin = petit. */
function sealSize(dist) {
  const near = 300, far = 15000, big = 64, small = 36;
  const t = (Math.log10(Math.max(near, Math.min(far, dist))) - Math.log10(near)) /
    (Math.log10(far) - Math.log10(near));
  return Math.round(big - t * (big - small));
}

let layout = new Map(); // id -> { bearing, dist, size, x, y }

/** Rayon selon la distance : proche = vers le centre, loin = vers le bord. */
function distRadius(dist, size) {
  const near = 200, far = 8000;
  const t = (Math.log10(Math.max(near, Math.min(far, dist))) - Math.log10(near)) /
    (Math.log10(far) - Math.log10(near));
  return size * (0.17 + t * 0.17);
}

/**
 * Calcule positions et tailles (seulement quand la position GPS change).
 * Les sceaux qui se chevauchent sont écartés, surtout vers le centre ou le
 * bord, et de 20° au plus sur le côté pour rester fidèles à la direction.
 */
function layoutPlaces() {
  layout = new Map();
  if (!state.position) {
    render();
    return;
  }
  const size = el.compass.clientWidth || 340;
  const rMin = size * 0.13, rMax = size * 0.35, maxDrift = 20 * RAD;
  const items = visiblePlaces().map(p => {
    const dist = distanceM(state.position, p);
    const bearing = bearingDeg(state.position, p);
    const r = distRadius(dist, size);
    const a = bearing * RAD;
    // Le lieu où l'on se trouve se pose au centre de la boussole.
    if (dist < 40) return { p, dist, bearing, size: sealSize(dist), x: 0, y: 0, fixed: true };
    return { p, dist, bearing, size: sealSize(dist), x: r * Math.sin(a), y: -r * Math.cos(a) };
  });

  for (let iter = 0; iter < 150; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i], B = items[j];
        const min = (A.size + B.size) / 2 + 30; // place pour l'étiquette
        let dx = B.x - A.x, dy = B.y - A.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) { dx = 0; dy = 1; d = 1; } // superposés : on écarte radialement
        if (A.fixed && B.fixed) continue;
        const kA = A.fixed ? 0 : B.fixed ? 1 : 0.5, kB = 1 - kA;
        const over = min - d;
        A.x -= dx / d * over * kA; A.y -= dy / d * over * kA;
        B.x += dx / d * over * kB; B.y += dy / d * over * kB;
        moved = true;
      }
    }
    // Contraintes : anneau [rMin, rMax] et dérive angulaire limitée.
    for (const it of items) {
      if (it.fixed) continue;
      let r = Math.hypot(it.x, it.y);
      let a = Math.atan2(it.x, -it.y);
      const target = it.bearing * RAD;
      let drift = Math.atan2(Math.sin(a - target), Math.cos(a - target));
      drift = Math.max(-maxDrift, Math.min(maxDrift, drift));
      a = target + drift;
      r = Math.max(rMin, Math.min(rMax, r));
      it.x = r * Math.sin(a); it.y = -r * Math.cos(a);
    }
    if (!moved) break;
  }

  for (const it of items) {
    layout.set(it.p.id, { bearing: it.bearing, dist: it.dist, size: it.size, x: it.x, y: it.y });
    const b = placeEls.get(it.p.id);
    if (b) {
      b.style.setProperty('--s', `${it.size}px`);
      b.querySelector('.dist').textContent = it.dist < 40 ? 'ici !' : formatDistance(it.dist);
    }
  }
  render();
}

function render() {
  const heading = state.heading ?? 0;
  el.dial.style.transform = `rotate(${-heading}deg)`;

  const size = el.compass.clientWidth || 340;
  const rc = size * 0.435;
  for (const c of cardinals) {
    const a = +c.dataset.angle * RAD;
    c.style.transform = `translate(${rc * Math.sin(a)}px, ${-rc * Math.cos(a)}px) rotate(${heading}deg)`;
  }

  let ahead = null;
  for (const [id, b] of placeEls) {
    const L = layout.get(id);
    if (!L) { b.hidden = true; continue; }
    b.hidden = false;
    // Le centre du sceau (pas de l'étiquette) est posé à sa position.
    b.style.transform = `translate(${L.x}px, ${L.y}px) rotate(${heading}deg)`;
    const rel = Math.abs(relAngle(L.bearing, heading));
    if (state.compassOk && rel <= 15 && (!ahead || rel < ahead.rel)) ahead = { id, rel };
    b.classList.toggle('target', id === state.targetId);
  }
  for (const [id, b] of placeEls) b.classList.toggle('ahead', !state.targetId && ahead?.id === id);

  renderGuide();
  renderPhrase(ahead);
}

function renderGuide() {
  const guiding = !!state.targetId;
  el.compass.classList.toggle('guiding', guiding);
  el.needle.hidden = !guiding;
  el.stopGuide.hidden = !guiding;
  if (!guiding) {
    el.compass.classList.remove('aligned');
    return;
  }
  const L = layout.get(state.targetId);
  if (!L) return;
  const rel = relAngle(L.bearing, state.heading ?? 0);
  el.needle.style.transform = `rotate(${rel}deg)`;

  // Hystérésis pour éviter de vibrer en boucle à la limite.
  const wasAligned = state.aligned;
  const abs = Math.abs(rel);
  state.aligned = state.compassOk && (wasAligned ? abs < 18 : abs < 10);
  el.compass.classList.toggle('aligned', state.aligned);
  if (state.aligned && !wasAligned) vibrate([70, 50, 70]);
}

function renderPhrase(ahead) {
  if (!state.position) {
    el.phrase.textContent = 'Je cherche ta position…';
    el.subphrase.textContent = 'Active la localisation si ce n\'est pas fait.';
    return;
  }
  const places = visiblePlaces();
  if (!places.length) {
    el.phrase.textContent = 'Aucun lieu sur ta carte.';
    el.subphrase.textContent = 'Touche 📜 pour ajouter tes lieux.';
    return;
  }

  if (state.targetId) {
    const p = state.places.find(x => x.id === state.targetId);
    const L = layout.get(state.targetId);
    if (!p || !L) return;
    if (L.dist < 40) {
      el.phrase.innerHTML = `${esc(p.emoji)} Tu es arrivé à <em>${esc(p.name)}</em> ! 🎉`;
      el.subphrase.textContent = 'Le trésor est à tes pieds.';
      if (state.arrivedId !== p.id) { state.arrivedId = p.id; vibrate([200, 100, 200, 100, 400]); }
      return;
    }
    const rel = relAngle(L.bearing, state.heading ?? 0);
    const dir = state.compassOk ? directionText(rel) : `au ${cardinalName(L.bearing)}`;
    el.phrase.innerHTML = state.aligned
      ? `${esc(p.emoji)} <em>${esc(p.name)}</em> est droit devant, avance !`
      : `${esc(p.emoji)} <em>${esc(p.name)}</em> est ${dir}`;
    el.subphrase.textContent = `à ${formatDistance(L.dist)} à vol d'oiseau`;
    return;
  }

  if (!state.compassOk) {
    const nearest = [...layout.entries()].sort((a, b) => a[1].dist - b[1].dist)[0];
    const p = state.places.find(x => x.id === nearest?.[0]);
    el.phrase.innerHTML = p
      ? `${esc(p.emoji)} <em>${esc(p.name)}</em> est au ${cardinalName(nearest[1].bearing)}, à ${formatDistance(nearest[1].dist)}`
      : '';
    el.subphrase.textContent = 'Touche un sceau pour te laisser guider.';
    return;
  }

  // Mode libre : on décrit le lieu le plus proche de l'axe du téléphone.
  let best = null;
  for (const [id, L] of layout) {
    const rel = relAngle(L.bearing, state.heading ?? 0);
    if (!best || Math.abs(rel) < Math.abs(best.rel)) best = { id, rel, L };
  }
  if (!best) return;
  const p = state.places.find(x => x.id === best.id);
  el.phrase.innerHTML = ahead
    ? `Droit devant : ${esc(p.emoji)} <em>${esc(p.name)}</em>`
    : `${esc(p.emoji)} <em>${esc(p.name)}</em> est ${directionText(best.rel)}`;
  el.subphrase.textContent = `à ${formatDistance(best.L.dist)} · touche un sceau pour te laisser guider`;
}

function cardinalName(bearing) {
  const names = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
  return names[Math.round(bearing / 45) % 8];
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Mode « Guide-moi »
// ---------------------------------------------------------------------------

function toggleGuide(id) {
  if (state.targetId === id) return stopGuide();
  state.targetId = id;
  state.aligned = false;
  state.arrivedId = null;
  vibrate(30);
  requestWakeLock();
  render();
}

function stopGuide() {
  state.targetId = null;
  state.aligned = false;
  releaseWakeLock();
  render();
}

el.stopGuide.addEventListener('click', stopGuide);

function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* pas de vibreur */ }
}

async function requestWakeLock() {
  try { state.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* refusé */ }
}
function releaseWakeLock() {
  try { state.wakeLock?.release(); } catch { /* déjà libéré */ }
  state.wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.targetId) requestWakeLock();
});

// ---------------------------------------------------------------------------
// Capteurs
// ---------------------------------------------------------------------------

function setStatus(text) {
  el.status.hidden = !text;
  el.status.textContent = text || '';
}

let statusMsgs = { gps: '', compass: '' };
function updateStatus() {
  setStatus([statusMsgs.gps, statusMsgs.compass].filter(Boolean).join(' · '));
}

function startGeolocation() {
  if (!('geolocation' in navigator)) {
    statusMsgs.gps = 'Localisation indisponible sur cet appareil.';
    updateStatus();
    return;
  }
  navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    const moved = !state.position || distanceM(state.position, { lat, lon }) > 3;
    state.position = { lat, lon, accuracy, time: Date.now() };
    statusMsgs.gps = accuracy > 150 ? `Position imprécise (± ${formatDistance(accuracy)})` : '';
    updateStatus();
    if (moved) layoutPlaces();
  }, err => {
    statusMsgs.gps = err.code === 1
      ? 'Localisation refusée : autorise-la dans les réglages du navigateur.'
      : 'Position introuvable pour le moment…';
    updateStatus();
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}

/**
 * Cap de l'avant du téléphone à partir d'alpha/beta/gamma (repère absolu).
 * On additionne la direction du haut de l'écran et celle du dos du téléphone,
 * projetées à l'horizontale : ça marche à plat comme tenu debout.
 */
function headingFromEuler(alpha, beta, gamma) {
  const a = alpha * RAD, b = beta * RAD, g = gamma * RAD;
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
  const sg = Math.sin(g), cg = Math.cos(g);
  // Haut de l'écran (axe y)
  const topE = -sa * cb, topN = ca * cb;
  // Dos du téléphone (axe -z)
  const backE = -sg * ca - cg * sb * sa;
  const backN = -sg * sa + cg * sb * ca;
  const e = topE + backE, n = topN + backN;
  return (Math.atan2(e, n) / RAD + 360) % 360;
}

function pushHeading(h) {
  // Lissage sur le cercle (pas de saut entre 359° et 0°).
  const x = Math.sin(h * RAD), y = Math.cos(h * RAD);
  const k = 0.25;
  state.smooth = state.smooth
    ? { x: state.smooth.x + k * (x - state.smooth.x), y: state.smooth.y + k * (y - state.smooth.y) }
    : { x, y };
  state.heading = (Math.atan2(state.smooth.x, state.smooth.y) / RAD + 360) % 360;
  if (!state.compassOk) {
    state.compassOk = true;
    statusMsgs.compass = '';
    updateStatus();
  }
  scheduleRender();
}

let rafPending = false;
function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; render(); });
}

function onAbsoluteOrientation(e) {
  if (e.alpha == null) return;
  pushHeading(headingFromEuler(e.alpha, e.beta ?? 0, e.gamma ?? 0));
}

function onOrientation(e) {
  if (typeof e.webkitCompassHeading === 'number') {
    pushHeading(e.webkitCompassHeading); // iPhone
  } else if (e.absolute && e.alpha != null) {
    pushHeading(headingFromEuler(e.alpha, e.beta ?? 0, e.gamma ?? 0));
  }
}

async function startCompass() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      if (await DOE.requestPermission() !== 'granted') {
        statusMsgs.compass = 'Boussole refusée.';
        updateStatus();
        return;
      }
    } catch { /* ignoré */ }
  }
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', onAbsoluteOrientation);
  } else {
    window.addEventListener('deviceorientation', onOrientation);
  }
  setTimeout(() => {
    if (!state.compassOk) {
      statusMsgs.compass = 'Pas de boussole détectée : le nord est en haut de l\'écran.';
      updateStatus();
      render();
    }
  }, 3000);
}

function start() {
  el.startOverlay.hidden = true;
  storageSet('boussole.started', '1');
  startCompass();
  startGeolocation();
  render();
  // Laisse d'abord passer la demande d'autorisation de localisation.
  setTimeout(askHomeOnce, 800);
}

/** Au tout premier lancement, propose d'enregistrer la maison (une seule fois). */
function askHomeOnce() {
  if (storageGet(HOME_ASKED_KEY) || state.places.some(p => !p.preset)) return;
  storageSet(HOME_ASKED_KEY, '1');
  openForm(null, {
    title: 'Où est ta maison ?',
    intro: 'Enregistre ton domicile pour toujours retrouver le chemin du retour. Il restera uniquement sur ce téléphone. Tu pourras ajouter d\'autres lieux plus tard avec 📜.',
    name: 'Maison',
    emoji: '🏠',
    color: COLORS[0],
    cancel: 'Plus tard',
  });
}

$('btn-start').addEventListener('click', start);

// Sur Android, les permissions déjà accordées n'ont pas besoin d'un clic :
// on saute l'écran d'accueil après la première fois.
if (storageGet('boussole.started') && !(window.DeviceOrientationEvent?.requestPermission)) {
  start();
}

window.addEventListener('resize', layoutPlaces);

// ---------------------------------------------------------------------------
// Réglages : liste des lieux
// ---------------------------------------------------------------------------

function showScreen(name) {
  el.screenCompass.hidden = name !== 'compass';
  el.screenSettings.hidden = name !== 'settings';
  if (name === 'settings') renderList();
  else buildPlaceEls();
}

$('btn-settings').addEventListener('click', () => showScreen('settings'));
$('btn-back').addEventListener('click', () => showScreen('compass'));
$('btn-add').addEventListener('click', () => openForm(null));

function renderList() {
  el.list.innerHTML = '';
  const mine = state.places.filter(p => !p.preset);
  const presets = state.places.filter(p => p.preset);
  const addSection = (title, items) => {
    if (!items.length) return;
    const h = document.createElement('li');
    h.className = 'section-title';
    h.textContent = title;
    el.list.appendChild(h);
    for (const p of items) el.list.appendChild(placeRow(p));
  };
  addSection('Mes lieux', mine);
  if (!mine.length) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = 'Tu n\'as pas encore de lieu à toi. Touche ＋ pour ajouter ta maison, ton travail…';
    el.list.appendChild(li);
  }
  addSection('Repères de Nantes', presets);
}

function placeRow(p) {
  const li = document.createElement('li');
  li.className = 'place-row' + (p.hidden ? ' hidden-place' : '');
  li.innerHTML = `<span class="mini-seal"></span>
    <button type="button" class="info"><b></b><small></small></button>
    <button type="button" class="eye"></button>`;
  const seal = li.querySelector('.mini-seal');
  seal.style.setProperty('--c', p.color);
  seal.textContent = p.emoji;
  li.querySelector('b').textContent = p.name;
  li.querySelector('small').textContent = state.position
    ? `à ${formatDistance(distanceM(state.position, p))}`
    : `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
  const eye = li.querySelector('.eye');
  eye.textContent = p.hidden ? '🙈' : '👁️';
  eye.setAttribute('aria-label', p.hidden ? `Afficher ${p.name}` : `Masquer ${p.name}`);
  eye.addEventListener('click', () => {
    p.hidden = !p.hidden;
    savePlaces();
    renderList();
  });
  li.querySelector('.info').addEventListener('click', () => openForm(p));
  return li;
}

// ---------------------------------------------------------------------------
// Formulaire d'ajout / modification
// ---------------------------------------------------------------------------

const form = {
  editing: null,
  emoji: EMOJIS[0],
  color: COLORS[0],
  coords: null,
};

function buildChips(container, values, kind) {
  container.innerHTML = '';
  for (const v of values) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('role', 'radio');
    if (kind === 'emoji') b.textContent = v;
    else { b.style.setProperty('--c', v); b.setAttribute('aria-label', `Couleur ${v}`); }
    b.dataset.value = v;
    b.addEventListener('click', () => {
      form[kind] = v;
      syncChips();
    });
    container.appendChild(b);
  }
}
buildChips($('f-emoji'), EMOJIS, 'emoji');
buildChips($('f-color'), COLORS, 'color');

function syncChips() {
  for (const b of $('f-emoji').children) b.setAttribute('aria-checked', b.dataset.value === form.emoji);
  for (const b of $('f-color').children) b.setAttribute('aria-checked', b.dataset.value === form.color);
}

function syncCoords(label) {
  const c = $('f-coords');
  if (form.coords) {
    c.textContent = `✔ ${label || `${form.coords.lat.toFixed(5)}, ${form.coords.lon.toFixed(5)}`}`;
    c.classList.add('ok');
  } else {
    c.textContent = 'Aucun emplacement choisi';
    c.classList.remove('ok');
  }
}

/**
 * Ouvre le formulaire. `preset` pré-remplit un nouveau lieu
 * (utilisé au premier lancement pour demander la maison).
 */
function openForm(place, preset = null) {
  form.editing = place;
  form.emoji = place?.emoji ?? preset?.emoji ?? EMOJIS[0];
  form.color = place?.color ?? preset?.color ?? COLORS[state.places.length % COLORS.length];
  form.coords = place ? { lat: place.lat, lon: place.lon } : null;
  $('form-title').textContent = place ? 'Modifier le lieu' : preset?.title ?? 'Nouveau lieu';
  $('form-intro').hidden = !preset?.intro;
  $('form-intro').textContent = preset?.intro ?? '';
  $('btn-cancel').textContent = preset?.cancel ?? 'Annuler';
  $('f-name').value = place?.name ?? preset?.name ?? '';
  $('f-address').value = '';
  $('search-results').innerHTML = '';
  $('btn-delete').hidden = !place;
  syncChips();
  syncCoords();
  el.dialog.showModal();
}

$('btn-cancel').addEventListener('click', () => el.dialog.close());

$('btn-calib').addEventListener('click', () => $('calib-dialog').showModal());
$('btn-calib-close').addEventListener('click', () => $('calib-dialog').close());

$('btn-here').addEventListener('click', () => {
  const btn = $('btn-here');
  if (!('geolocation' in navigator)) return toast('Localisation indisponible.');
  if (state.position && state.position.accuracy <= 30 && Date.now() - state.position.time < 15000) {
    form.coords = { lat: state.position.lat, lon: state.position.lon };
    syncCoords(`Position enregistrée (± ${formatDistance(state.position.accuracy)})`);
    return;
  }
  btn.disabled = true;
  btn.textContent = '📍 Repérage en cours…';
  navigator.geolocation.getCurrentPosition(pos => {
    form.coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    syncCoords(`Position enregistrée (± ${formatDistance(pos.coords.accuracy)})`);
    btn.disabled = false;
    btn.textContent = '📍 Je suis ici, enregistrer ma position';
  }, () => {
    toast('Impossible d\'obtenir ta position.');
    btn.disabled = false;
    btn.textContent = '📍 Je suis ici, enregistrer ma position';
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
});

async function searchAddress() {
  const q = $('f-address').value.trim();
  const list = $('search-results');
  if (q.length < 3) return toast('Tape au moins quelques lettres.');
  list.innerHTML = '<li class="hint small">Recherche…</li>';
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q, format: 'jsonv2', limit: '5', countrycodes: 'fr', 'accept-language': 'fr',
      viewbox: '-1.80,47.35,-1.35,47.08', // agglomération nantaise en priorité
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const results = await res.json();
    list.innerHTML = '';
    if (!results.length) {
      list.innerHTML = '<li class="hint small">Aucun résultat. Essaie avec la ville, ex. « 3 rue X, Nantes ».</li>';
      return;
    }
    for (const r of results) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = r.display_name;
      b.addEventListener('click', () => {
        form.coords = { lat: +r.lat, lon: +r.lon };
        syncCoords(r.display_name.split(',').slice(0, 3).join(','));
        list.innerHTML = '';
      });
      li.appendChild(b);
      list.appendChild(li);
    }
  } catch {
    list.innerHTML = '<li class="hint small">Recherche impossible (pas de réseau ?).</li>';
  }
}

$('btn-search').addEventListener('click', searchAddress);
$('f-address').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); searchAddress(); }
});

el.form.addEventListener('submit', e => {
  e.preventDefault();
  const name = $('f-name').value.trim();
  if (!name) return toast('Donne un nom à ce lieu.');
  if (!form.coords) return toast('Choisis un emplacement (position ou adresse).');
  const data = { name, emoji: form.emoji, color: form.color, lat: form.coords.lat, lon: form.coords.lon };
  if (form.editing) Object.assign(form.editing, data);
  else state.places.push({ ...data, id: uid(), hidden: false, preset: false });
  savePlaces();
  el.dialog.close();
  if (el.screenSettings.hidden) buildPlaceEls();
  else renderList();
  toast(form.editing ? 'Lieu modifié ✔' : 'Lieu ajouté sur la carte ✔');
});

$('btn-delete').addEventListener('click', () => {
  const p = form.editing;
  if (!p || !confirm(`Supprimer « ${p.name} » ?`)) return;
  state.places = state.places.filter(x => x !== p);
  if (state.targetId === p.id) state.targetId = null;
  savePlaces();
  el.dialog.close();
  renderList();
});

// ---------------------------------------------------------------------------
// Divers
// ---------------------------------------------------------------------------

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

buildPlaceEls();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
  });
}
