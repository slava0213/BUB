// server/geo.js — координаты городов, маршруты и расчёт времени в пути.
//
//  • Координаты: встроенный справочник крупных городов → иначе Nominatim (OpenStreetMap).
//  • Маршрут и время: публичный OSRM. Если он недоступен — оценка по прямой
//    (расстояние × 1.3 при средней скорости 70 км/ч), такие данные помечаются approx: true.
//  • Все ответы кэшируются, чтобы не нагружать внешние сервисы.

const CITIES = {
  'москва': [55.7558, 37.6173],
  'санкт-петербург': [59.9343, 30.3351],
  'питер': [59.9343, 30.3351],
  'спб': [59.9343, 30.3351],
  'казань': [55.7961, 49.1064],
  'екатеринбург': [56.8389, 60.6057],
  'новосибирск': [55.0084, 82.9357],
  'нижний новгород': [56.2965, 43.9361],
  'челябинск': [55.1644, 61.4368],
  'самара': [53.1959, 50.1002],
  'омск': [54.9885, 73.3242],
  'ростов-на-дону': [47.2357, 39.7015],
  'уфа': [54.7388, 55.9721],
  'красноярск': [56.0153, 92.8932],
  'воронеж': [51.6720, 39.1843],
  'пермь': [58.0105, 56.2502],
  'волгоград': [48.7080, 44.5133],
  'краснодар': [45.0355, 38.9753],
  'сочи': [43.5855, 39.7231],
  'саратов': [51.5336, 46.0343],
  'тюмень': [57.1522, 65.5272],
  'тольятти': [53.5303, 49.3461],
  'ижевск': [56.8527, 53.2115],
  'барнаул': [53.3548, 83.7698],
  'ульяновск': [54.3282, 48.3866],
  'иркутск': [52.2978, 104.2964],
  'хабаровск': [48.4827, 135.0838],
  'ярославль': [57.6261, 39.8845],
  'владивосток': [43.1155, 131.8855],
  'махачкала': [42.9849, 47.5047],
  'томск': [56.4977, 84.9744],
  'оренбург': [51.7727, 55.0988],
  'кемерово': [55.3904, 86.0468],
  'новокузнецк': [53.7557, 87.1099],
  'рязань': [54.6269, 39.6916],
  'тула': [54.1961, 37.6182],
  'липецк': [52.6031, 39.5708],
  'калининград': [54.7104, 20.4522],
  'курск': [51.7304, 36.1926],
  'тверь': [56.8587, 35.9176],
  'ставрополь': [45.0428, 41.9734],
  'иваново': [57.0004, 40.9739],
  'владимир': [56.1290, 40.4070],
  'белгород': [50.5997, 36.5983],
  'калуга': [54.5138, 36.2612],
  'смоленск': [54.7826, 32.0453],
  'вологда': [59.2205, 39.8915],
  'мурманск': [68.9585, 33.0827],
  'архангельск': [64.5401, 40.5433],
  'псков': [57.8136, 28.3496],
  'великий новгород': [58.5215, 31.2755],
  'анапа': [44.8947, 37.3167],
  'симферополь': [44.9521, 34.1024],
  'севастополь': [44.6166, 33.5254],
  'ялта': [44.4952, 34.1663],
  'минск': [53.9006, 27.5590],
  'киров': [58.6036, 49.6680],
  'чебоксары': [56.1439, 47.2489],
  'пенза': [53.1951, 45.0183],
  'набережные челны': [55.7436, 52.3958],
  'сургут': [61.2540, 73.3962],
  'якутск': [62.0355, 129.6755],
  'петрозаводск': [61.7849, 34.3469],
  'сыктывкар': [61.6688, 50.8364],
  'брянск': [53.2434, 34.3642],
  'орёл': [52.9703, 36.0635],
  'орел': [52.9703, 36.0635]
};

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*(г\.?|город)\s+/i, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const UA = 'hitch-a-ride/2.1 (student carpool project)';

async function fetchJson(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms || 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ───── Геокодинг ───── */

const geoCache = new Map(); // нормализованное имя → {lat,lng} | null (ненайдено, ненадолго)

async function geocode(name) {
  const key = normalize(name);
  if (!key) return null;

  if (CITIES[key]) return { lat: CITIES[key][0], lng: CITIES[key][1] };

  const hit = geoCache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;

  let value = null;
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ru&q=' +
      encodeURIComponent(String(name).trim());
    const arr = await fetchJson(url, 6000);
    if (Array.isArray(arr) && arr.length) {
      const lat = Number(arr[0].lat), lng = Number(arr[0].lon);
      if (isFinite(lat) && isFinite(lng)) value = { lat: lat, lng: lng };
    }
  } catch (e) {
    console.warn('⚠️ Геокодинг «' + name + '» не удался:', e.message);
    // сеть недоступна — запоминаем ненадолго, чтобы не долбить сервис
    geoCache.set(key, { value: null, until: Date.now() + 60 * 1000 });
    return null;
  }
  geoCache.set(key, { value: value, until: Date.now() + (value ? 30 * 24 * 3600 * 1000 : 10 * 60 * 1000) });
  return value;
}

/* ───── Расстояния ───── */

function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* ───── Маршруты ───── */

const routeCache = new Map(); // ключ → { value, until }

function pkey(p) { return p.lat.toFixed(4) + ',' + p.lng.toFixed(4); }

// Грубая оценка, если OSRM недоступен
function approxRoute(from, to) {
  const meters = haversine(from, to) * 1.3;
  return {
    distance: Math.round(meters),
    duration: Math.round(meters / (70 / 3.6)),
    geometry: [[from.lat, from.lng], [to.lat, to.lng]],
    approx: true
  };
}

/**
 * Маршрут по дорогам from → to.
 * opts.geometry — вернуть ли линию (для карты); opts.ttl — время жизни кэша, мс.
 */
async function route(from, to, opts) {
  opts = opts || {};
  const withGeom = !!opts.geometry;
  const ttl = opts.ttl || 20000;
  const key = (withGeom ? 'g|' : 'n|') + pkey(from) + '>' + pkey(to);

  const hit = routeCache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;

  let value;
  try {
    const url = 'https://router.project-osrm.org/route/v1/driving/' +
      from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat +
      '?overview=' + (withGeom ? 'simplified' : 'false') + '&geometries=geojson';
    const data = await fetchJson(url, 7000);
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error('OSRM: ' + data.code);
    const r = data.routes[0];
    value = {
      distance: Math.round(r.distance),
      duration: Math.round(r.duration),
      geometry: withGeom && r.geometry
        ? r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; })
        : null,
      approx: false
    };
  } catch (e) {
    console.warn('⚠️ OSRM недоступен, использую оценку по прямой:', e.message);
    value = approxRoute(from, to);
    // при сбое кэшируем коротко, чтобы быстро вернуться к точным данным
    routeCache.set(key, { value: value, until: Date.now() + 15000 });
    trimCache();
    return value;
  }
  routeCache.set(key, { value: value, until: Date.now() + ttl });
  trimCache();
  return value;
}

function trimCache() {
  if (routeCache.size < 500) return;
  const now = Date.now();
  routeCache.forEach(function (v, k) { if (v.until < now) routeCache.delete(k); });
  if (routeCache.size >= 500) routeCache.clear();
}

module.exports = { geocode, route, haversine, normalize, CITIES };
