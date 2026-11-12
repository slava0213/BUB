// server/app.js
const express      = require('express');
const bcrypt       = require('bcryptjs');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const crypto       = require('crypto');
const path         = require('path');
const fs           = require('fs');

const { initDb, db } = require('./db');
const { sign, auth, optional } = require('./auth');
const geo = require('./geo');

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

/* ─────────── Раздача клиента ─────────── */

const candidates = [
  path.join(__dirname, '..', 'client'),
  path.join(__dirname, 'client'),
  path.resolve(process.cwd(), 'client'),
  path.resolve(process.cwd(), '..', 'client')
];

let clientPath = null;
for (const p of candidates) {
  if (fs.existsSync(path.join(p, 'index.html'))) { clientPath = p; break; }
}

if (clientPath) {
  console.log('📁 Раздача клиента из:', clientPath);
  app.use(express.static(clientPath));
} else {
  console.error('❌ Папка client не найдена!');
}

/* ─────────── Окружение ─────────── */

const IS_PRODUCTION = !!process.env.RENDER || process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure:   IS_PRODUCTION,
  maxAge:   7 * 24 * 60 * 60 * 1000
};

/* ─────────── Память (живой чат) ─────────── */

const typingUsers = {};
const onlineUsers = {};
const locations   = {};   // tripId → последняя позиция водителя (только в памяти)

/* ─────────── Помощники ─────────── */

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email,
    phone: u.phone || '', bio: u.bio || '', rating: u.rating || 0
  };
}

function round1(x) { return Math.round(x * 10) / 10; }

function isDemo(user) {
  return !!user && String(user.email || '').endsWith('@demo.local');
}

// Доступ к чату: водитель или пассажир с заявкой (ожидает / принята)
function tripAccess(req, res, next) {
  const tripId = Number(req.params.id);
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return res.status(404).json({ error: 'Поездка не найдена' });

  if (trip.driver_id !== req.user.id) {
    const ok = db.prepare('SELECT * FROM requests').all().some(function (r) {
      return r.trip_id === tripId && r.passenger_id === req.user.id && r.status !== 'отклонена';
    });
    if (!ok) return res.status(403).json({ error: 'Чат доступен водителю и пассажирам с заявкой' });
  }
  req.trip = trip;
  next();
}

/* ─────────── AUTH ─────────── */

app.post('/api/register', async function (req, res) {
  const name     = String(req.body.name || '').trim();
  const email    = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Все поля обязательны' });
  if (!/^\S+@\S+\.\S+$/.test(email))
    return res.status(400).json({ error: 'Некорректный email' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });

  const hash = await bcrypt.hash(password, 10);

  try {
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    ).run(name, email, hash);

    res.cookie('token', sign({ id: info.lastInsertRowid, name: name }), COOKIE_OPTIONS);
    res.json({ id: info.lastInsertRowid, name: name, email: email });
  } catch (e) {
    res.status(400).json({ error: 'Email уже занят' });
  }
});

app.post('/api/login', async function (req, res) {
  const email    = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

  res.cookie('token', sign({ id: user.id, name: user.name }), COOKIE_OPTIONS);
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/logout', function (req, res) {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: IS_PRODUCTION });
  res.json({ ok: true });
});

/* ─────────── PROFILE ─────────── */

app.get('/api/me', auth, function (req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(publicUser(user)); // password_hash наружу не отдаём
});

app.put('/api/me', auth, function (req, res) {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Имя не может быть пустым' });
  db.prepare('UPDATE users SET name = ?, phone = ?, bio = ? WHERE id = ?')
    .run(name, String(req.body.phone || '').trim(), String(req.body.bio || '').trim(), req.user.id);
  res.cookie('token', sign({ id: req.user.id, name: name }), COOKIE_OPTIONS);
  res.json({ ok: true });
});

/* ─────────── STATS ─────────── */

app.get('/api/stats', function (req, res) {
  const trips = db.prepare('SELECT * FROM trips').all();
  const users = db.prepare('SELECT * FROM users').all();
  const reqs  = db.prepare('SELECT * FROM requests').all();
  const cities = new Set();
  trips.forEach(function (t) {
    cities.add(String(t.from_city).toLowerCase());
    cities.add(String(t.to_city).toLowerCase());
  });
  res.json({
    trips:  trips.length,
    users:  users.length,
    cities: cities.size,
    seats:  reqs.filter(function (r) { return r.status === 'принята'; }).length
  });
});

/* ─────────── TRIPS ─────────── */

app.get('/api/trips', function (req, res) {
  const from = String(req.query.from || '').toLowerCase();
  const to   = String(req.query.to   || '').toLowerCase();
  const date = req.query.date;
  const all  = req.query.all === '1';
  const cutoff = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const users = db.prepare('SELECT * FROM users').all();
  const viewer = optional(req);
  const allReqs = viewer ? db.prepare('SELECT * FROM requests').all() : [];

  const result = db.prepare('SELECT * FROM trips').all().filter(function (t) {
    if (!all && t.date < cutoff) return false;
    if (from && String(t.from_city).toLowerCase().indexOf(from) === -1) return false;
    if (to   && String(t.to_city).toLowerCase().indexOf(to)     === -1) return false;
    if (date && t.date !== date) return false;
    return true;
  }).map(function (t) {
    const d = users.find(function (u) { return u.id === t.driver_id; });
    t.driver = d ? d.name : 'Неизвестный';
    t.driver_rating = d ? (d.rating || 0) : 0;
    t.demo = isDemo(d);
    t.status = t.status || 'planned';
    if (viewer) {
      const mine = allReqs.find(function (r) { return r.trip_id === t.id && r.passenger_id === viewer.id; });
      t.my_request = mine ? mine.status : null;
    }
    return t;
  });

  result.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
  res.json(result);
});

app.post('/api/trips', auth, async function (req, res) {
  const b = req.body;
  const from_city = String(b.from_city || '').trim();
  const to_city   = String(b.to_city || '').trim();
  const date      = String(b.date || '');
  const time      = String(b.time || '');
  const seats     = Number(b.seats);
  const price     = Number(b.price);

  if (!from_city || !to_city || !date || !time || !seats || b.price === '' || isNaN(price))
    return res.status(400).json({ error: 'Заполните обязательные поля' });
  if (from_city.toLowerCase() === to_city.toLowerCase())
    return res.status(400).json({ error: 'Пункты отправления и назначения совпадают' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: 'Некорректная дата' });
  if (seats < 1 || seats > 8)
    return res.status(400).json({ error: 'Мест должно быть от 1 до 8' });
  if (price < 0)
    return res.status(400).json({ error: 'Цена не может быть отрицательной' });

  // Координаты нужны для карты и расчёта времени прибытия
  const pts = await Promise.all([geo.geocode(from_city), geo.geocode(to_city)]);
  const a = pts[0], z = pts[1];

  const info = db.prepare(`
    INSERT INTO trips (driver_id, from_city, to_city, date, time, seats, price, description,
                       from_lat, from_lng, to_lat, to_lng, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, from_city, to_city, date, time, Math.floor(seats), price,
         String(b.description || '').trim().slice(0, 500),
         a ? a.lat : null, a ? a.lng : null, z ? z.lat : null, z ? z.lng : null, 'planned');

  res.json({ id: info.lastInsertRowid, tracking: !!(a && z) });
});

/* ─────────── REQUESTS ─────────── */

app.post('/api/trips/:id/requests', auth, function (req, res) {
  const tripId = Number(req.params.id);
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return res.status(404).json({ error: 'Поездка не найдена' });
  if (trip.driver_id === req.user.id)
    return res.status(400).json({ error: 'Нельзя оставить заявку на свою поездку' });
  if (Number(trip.seats) <= 0)
    return res.status(400).json({ error: 'Свободных мест нет' });

  const exists = db.prepare('SELECT * FROM requests').all().find(function (r) {
    return r.trip_id === tripId && r.passenger_id === req.user.id;
  });
  if (exists) return res.status(400).json({ error: 'Заявка уже отправлена' });

  const info = db.prepare(
    'INSERT INTO requests (trip_id, passenger_id, status) VALUES (?, ?, ?)'
  ).run(tripId, req.user.id, 'ожидает');

  res.json({ id: info.lastInsertRowid });
});

app.get('/api/me/requests', auth, function (req, res) {
  const my    = db.prepare('SELECT * FROM requests').all()
                  .filter(function (r) { return r.passenger_id === req.user.id; });
  const trips = db.prepare('SELECT * FROM trips').all();
  const users = db.prepare('SELECT * FROM users').all();

  my.forEach(function (r) {
    const t = trips.find(function (x) { return x.id === r.trip_id; });
    if (t) {
      r.from_city = t.from_city; r.to_city = t.to_city;
      r.date = t.date;           r.time = t.time;
      r.price = t.price;         r.driver_id = t.driver_id;
      const d = users.find(function (u) { return u.id === t.driver_id; });
      r.driver = d ? d.name : 'Неизвестный';
    }
  });
  res.json(my);
});

app.get('/api/me/incoming-requests', auth, function (req, res) {
  const trips = db.prepare('SELECT * FROM trips').all();
  const users = db.prepare('SELECT * FROM users').all();
  const myTrips = trips.filter(function (t) { return t.driver_id === req.user.id; });
  const myTripIds = myTrips.map(function (t) { return t.id; });

  const incoming = db.prepare('SELECT * FROM requests').all().filter(function (r) {
    return myTripIds.indexOf(r.trip_id) !== -1;
  });

  incoming.forEach(function (r) {
    const trip = myTrips.find(function (t) { return t.id === r.trip_id; });
    const p = users.find(function (u) { return u.id === r.passenger_id; });
    if (trip) {
      r.from_city = trip.from_city; r.to_city = trip.to_city;
      r.date = trip.date;           r.time = trip.time;
      r.seats_left = trip.seats;
    }
    r.passenger_name  = p ? p.name  : 'Неизвестный';
    r.passenger_phone = p ? (p.phone || '') : '';
    r.passenger_email = p ? p.email : '';
  });
  res.json(incoming);
});

function decide(req, res, status) {
  const requestId = Number(req.params.id);
  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });

  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(request.trip_id);
  if (!trip) return res.status(404).json({ error: 'Поездка не найдена' });
  if (trip.driver_id !== req.user.id)
    return res.status(403).json({ error: 'Это не ваша поездка' });
  if (request.status === status) return res.json({ ok: true });

  const wasAccepted = request.status === 'принята';

  if (status === 'принята') {
    if (Number(trip.seats) <= 0)
      return res.status(400).json({ error: 'Свободных мест не осталось' });
    db.prepare('UPDATE trips SET seats = ? WHERE id = ?').run(Number(trip.seats) - 1, trip.id);
  } else if (wasAccepted) {
    db.prepare('UPDATE trips SET seats = ? WHERE id = ?').run(Number(trip.seats) + 1, trip.id);
  }

  db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, requestId);
  res.json({ ok: true });
}

app.post('/api/requests/:id/accept', auth, function (req, res) { decide(req, res, 'принята'); });
app.post('/api/requests/:id/reject', auth, function (req, res) { decide(req, res, 'отклонена'); });

/* ─────────── MESSAGES ─────────── */

app.get('/api/trips/:id/messages', auth, tripAccess, function (req, res) {
  const tripId = req.trip.id;
  const users = db.prepare('SELECT * FROM users').all();

  const messages = db.prepare('SELECT * FROM messages').all()
    .filter(function (m) { return Number(m.trip_id) === tripId; });

  messages.forEach(function (m) {
    const u = users.find(function (x) { return x.id === m.author_id; });
    m.author = u ? u.name : 'Неизвестный';
  });
  messages.sort(function (a, b) { return (a.created_at || '').localeCompare(b.created_at || ''); });
  res.json(messages);
});

app.post('/api/trips/:id/messages', auth, tripAccess, function (req, res) {
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Пустое сообщение' });

  const info = db.prepare(
    'INSERT INTO messages (trip_id, author_id, text) VALUES (?, ?, ?)'
  ).run(req.trip.id, req.user.id, text.slice(0, 2000));
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/trips/:id/typing', auth, tripAccess, function (req, res) {
  const tripId = req.trip.id;
  if (!typingUsers[tripId]) typingUsers[tripId] = {};
  typingUsers[tripId][req.user.id] = Date.now();
  res.json({ ok: true });
});

app.get('/api/trips/:id/typing', auth, tripAccess, function (req, res) {
  const users = typingUsers[req.trip.id] || {};
  const now = Date.now();
  const typing = [];
  Object.keys(users).forEach(function (userId) {
    if (Number(userId) !== req.user.id && now - users[userId] < 5000) typing.push(Number(userId));
  });
  res.json({ typing: typing });
});

app.post('/api/heartbeat', auth, function (req, res) {
  onlineUsers[req.user.id] = Date.now();
  res.json({ ok: true });
});

app.get('/api/trips/:id/online', auth, tripAccess, function (req, res) {
  const trip = req.trip;
  const participantIds = new Set([trip.driver_id]);
  db.prepare('SELECT * FROM requests').all().forEach(function (r) {
    if (Number(r.trip_id) === trip.id && r.status === 'принята') participantIds.add(r.passenger_id);
  });

  const now = Date.now();
  const online = [];
  participantIds.forEach(function (id) {
    if (id !== req.user.id && onlineUsers[id] && now - onlineUsers[id] < 15000) online.push(id);
  });
  res.json({ online: online });
});

/* ─────────── ТРЕКИНГ: где водитель и когда приедет ─────────── */

const LOCATION_STALE_SEC = 90;   // после этого позиция считается устаревшей

function num(x) { const n = Number(x); return isFinite(n) ? n : null; }
function validPoint(lat, lng) {
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Доступ к трекингу: водитель или пассажир с ПРИНЯТОЙ заявкой.
function trackAccess(req, res, next) {
  const tripId = Number(req.params.id);
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return res.status(404).json({ error: 'Поездка не найдена' });

  if (trip.driver_id === req.user.id) {
    req.role = 'driver';
  } else {
    const r = db.prepare('SELECT * FROM requests').all().find(function (x) {
      return x.trip_id === tripId && x.passenger_id === req.user.id && x.status === 'принята';
    });
    if (!r) return res.status(403).json({ error: 'Положение водителя видно после того, как он примет вашу заявку' });
    req.role = 'passenger';
    req.myRequest = r;
  }
  req.trip = trip;
  next();
}

// У старых поездок координат нет — определяем при первом обращении.
async function ensureCoords(trip) {
  if (num(trip.from_lat) !== null && num(trip.to_lat) !== null) return trip;
  const pts = await Promise.all([geo.geocode(trip.from_city), geo.geocode(trip.to_city)]);
  if (pts[0] && pts[1]) {
    db.prepare('UPDATE trips SET from_lat = ?, from_lng = ?, to_lat = ?, to_lng = ? WHERE id = ?')
      .run(pts[0].lat, pts[0].lng, pts[1].lat, pts[1].lng, trip.id);
    trip.from_lat = pts[0].lat; trip.from_lng = pts[0].lng;
    trip.to_lat   = pts[1].lat; trip.to_lng   = pts[1].lng;
  }
  return trip;
}

// Время до точки: секунды, метры, абсолютный момент прибытия.
async function etaTo(loc, target, withGeometry) {
  const r = await geo.route({ lat: loc.lat, lng: loc.lng }, target, { geometry: withGeometry, ttl: 20000 });
  const near = geo.haversine({ lat: loc.lat, lng: loc.lng }, target) < 250;
  const k = loc.sim > 1 ? loc.sim : 1;                 // в демо-симуляции время ускорено
  const seconds = near ? 0 : Math.max(60, Math.round(r.duration / k));
  return {
    seconds: seconds,
    meters: near ? 0 : r.distance,
    arrival_ts: Date.now() + seconds * 1000,
    near: near,
    approx: !!r.approx,
    geometry: withGeometry ? r.geometry : undefined
  };
}

// Начать поездку (только водитель)
app.post('/api/trips/:id/start', auth, function (req, res) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Поездка не найдена' });
  if (trip.driver_id !== req.user.id) return res.status(403).json({ error: 'Это не ваша поездка' });
  if (trip.status === 'finished') return res.status(400).json({ error: 'Поездка уже завершена' });

  db.prepare('UPDATE trips SET status = ?, started_at = ? WHERE id = ?')
    .run('active', new Date().toISOString(), trip.id);
  delete locations[trip.id];
  res.json({ ok: true, status: 'active' });
});

// Завершить поездку (только водитель) — позиция удаляется
app.post('/api/trips/:id/finish', auth, function (req, res) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Поездка не найдена' });
  if (trip.driver_id !== req.user.id) return res.status(403).json({ error: 'Это не ваша поездка' });

  db.prepare('UPDATE trips SET status = ?, finished_at = ? WHERE id = ?')
    .run('finished', new Date().toISOString(), trip.id);
  delete locations[trip.id];
  res.json({ ok: true, status: 'finished' });
});

// Водитель отправляет свою позицию
app.post('/api/trips/:id/location', auth, function (req, res) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Поездка не найдена' });
  if (trip.driver_id !== req.user.id) return res.status(403).json({ error: 'Только водитель может передавать позицию' });
  if (trip.status !== 'active') return res.status(400).json({ error: 'Поездка не начата' });

  const lat = num(req.body.lat), lng = num(req.body.lng);
  if (!validPoint(lat, lng)) return res.status(400).json({ error: 'Некорректные координаты' });

  const prev = locations[trip.id];
  if (prev && Date.now() - prev.ts < 1500) return res.json({ ok: true, throttled: true });

  const speed = num(req.body.speed);                    // м/с
  const sim = Math.floor(num(req.body.sim) || 0);
  locations[trip.id] = {
    lat: lat, lng: lng,
    speed_kmh: speed !== null && speed >= 0 ? Math.round(speed * 3.6) : null,
    heading: num(req.body.heading),
    sim: sim > 1 && sim <= 600 ? sim : 0,
    ts: Date.now()
  };
  res.json({ ok: true });
});

// Пассажир задаёт точку посадки (или очищает её)
app.post('/api/trips/:id/pickup', auth, trackAccess, function (req, res) {
  if (req.role !== 'passenger') return res.status(400).json({ error: 'Точку посадки задаёт пассажир' });

  if (req.body.clear) {
    db.prepare('UPDATE requests SET pickup_lat = ?, pickup_lng = ? WHERE id = ?').run(null, null, req.myRequest.id);
    return res.json({ ok: true });
  }
  const lat = num(req.body.lat), lng = num(req.body.lng);
  if (!validPoint(lat, lng)) return res.status(400).json({ error: 'Некорректные координаты' });

  db.prepare('UPDATE requests SET pickup_lat = ?, pickup_lng = ? WHERE id = ?').run(lat, lng, req.myRequest.id);
  res.json({ ok: true });
});

// Всё для экрана карты одним запросом
app.get('/api/trips/:id/tracking', auth, trackAccess, async function (req, res) {
  try {
    const trip = await ensureCoords(req.trip);
    const drv = db.prepare('SELECT * FROM users WHERE id = ?').get(trip.driver_id);
    const status = trip.status || 'planned';

    const hasRoute = num(trip.from_lat) !== null && num(trip.to_lat) !== null;
    const from = hasRoute ? { lat: Number(trip.from_lat), lng: Number(trip.from_lng) } : null;
    const to   = hasRoute ? { lat: Number(trip.to_lat),   lng: Number(trip.to_lng) }   : null;

    // Основной маршрут — для линии на карте и планового времени (кэш на 6 часов)
    const mainRoute = hasRoute ? await geo.route(from, to, { geometry: true, ttl: 6 * 3600 * 1000 }) : null;

    const out = {
      server_ts: Date.now(),
      role: req.role,
      trip: {
        id: trip.id, from_city: trip.from_city, to_city: trip.to_city,
        date: trip.date, time: trip.time, status: status, seats: trip.seats,
        driver_id: trip.driver_id, driver: drv ? drv.name : 'Водитель'
      },
      from: from, to: to,
      route: mainRoute ? {
        geometry: mainRoute.geometry, distance: mainRoute.distance,
        duration: mainRoute.duration, approx: mainRoute.approx
      } : null,
      location: null, eta: null, progress: null,
      pickup: null, passengers: []
    };

    const loc = status === 'active' ? locations[trip.id] : null;
    if (loc) {
      const age = Math.round((Date.now() - loc.ts) / 1000);
      out.location = {
        lat: loc.lat, lng: loc.lng, speed_kmh: loc.speed_kmh, heading: loc.heading,
        age_sec: age, stale: age > LOCATION_STALE_SEC, sim: loc.sim || 0
      };
    }

    const jobs = [];
    if (loc && to) {
      jobs.push(etaTo(loc, to, false).then(function (e) {
        out.eta = { destination: e };
        if (mainRoute && mainRoute.distance > 0) {
          out.progress = Math.max(0, Math.min(1, 1 - e.meters / mainRoute.distance));
        }
      }));
    }

    // Пассажир: своя точка посадки и время до неё
    if (req.role === 'passenger' && num(req.myRequest.pickup_lat) !== null) {
      const pk = { lat: Number(req.myRequest.pickup_lat), lng: Number(req.myRequest.pickup_lng) };
      out.pickup = pk;
      if (loc) {
        jobs.push(etaTo(loc, pk, true).then(function (e) {
          out.eta = out.eta || {};
          out.eta.pickup = e;
        }));
      }
    }

    // Водитель: точки посадки всех принятых пассажиров
    if (req.role === 'driver') {
      const users = db.prepare('SELECT * FROM users').all();
      db.prepare('SELECT * FROM requests').all().forEach(function (r) {
        if (r.trip_id !== trip.id || r.status !== 'принята') return;
        const u = users.find(function (x) { return x.id === r.passenger_id; });
        const item = { request_id: r.id, name: u ? u.name : 'Пассажир', pickup: null, eta: null };
        if (num(r.pickup_lat) !== null) {
          item.pickup = { lat: Number(r.pickup_lat), lng: Number(r.pickup_lng) };
          if (loc) jobs.push(etaTo(loc, item.pickup, false).then(function (e) { item.eta = e; }));
        }
        out.passengers.push(item);
      });
    }

    await Promise.all(jobs);
    res.json(out);
  } catch (e) {
    console.error('Ошибка трекинга:', e);
    res.status(500).json({ error: 'Не удалось получить данные о поездке' });
  }
});

/* ─────────── REVIEWS ─────────── */

// Отзывы, которые оставил я
app.get('/api/me/reviews', auth, function (req, res) {
  const users = db.prepare('SELECT * FROM users').all();
  const mine = db.prepare('SELECT * FROM reviews').all()
    .filter(function (r) { return r.author_id === req.user.id; });
  mine.forEach(function (r) {
    const d = users.find(function (u) { return u.id === r.driver_id; });
    r.driver = d ? d.name : 'Неизвестный';
  });
  res.json(mine);
});

// Отзывы о конкретном водителе
app.get('/api/users/:id/reviews', function (req, res) {
  const userId = Number(req.params.id);
  const users = db.prepare('SELECT * FROM users').all();
  const mine = db.prepare('SELECT * FROM reviews').all()
    .filter(function (r) { return Number(r.driver_id) === userId; });
  mine.forEach(function (r) {
    const a = users.find(function (u) { return u.id === r.author_id; });
    r.author = a ? a.name : 'Неизвестный';
  });
  res.json(mine);
});

app.post('/api/reviews', auth, function (req, res) {
  const driver_id = Number(req.body.driver_id);
  const rating    = Number(req.body.rating);
  const text      = String(req.body.text || '').trim().slice(0, 1000);

  if (!driver_id || !rating)
    return res.status(400).json({ error: 'Укажите водителя и оценку' });
  if (rating < 1 || rating > 5 || Math.floor(rating) !== rating)
    return res.status(400).json({ error: 'Оценка от 1 до 5' });
  if (driver_id === req.user.id)
    return res.status(400).json({ error: 'Нельзя оставить отзыв себе' });

  // Отзыв можно оставить только водителю, который принял вашу заявку
  const trips = db.prepare('SELECT * FROM trips').all();
  const rode = db.prepare('SELECT * FROM requests').all().some(function (r) {
    if (r.passenger_id !== req.user.id || r.status !== 'принята') return false;
    const t = trips.find(function (x) { return x.id === r.trip_id; });
    return t && t.driver_id === driver_id;
  });
  if (!rode) return res.status(403).json({ error: 'Отзыв можно оставить после принятой заявки' });

  const dup = db.prepare('SELECT * FROM reviews').all().find(function (r) {
    return r.driver_id === driver_id && r.author_id === req.user.id;
  });
  if (dup) return res.status(400).json({ error: 'Вы уже оставили отзыв этому водителю' });

  const info = db.prepare(
    'INSERT INTO reviews (driver_id, author_id, rating, text) VALUES (?, ?, ?, ?)'
  ).run(driver_id, req.user.id, rating, text);

  const revs = db.prepare('SELECT * FROM reviews').all()
    .filter(function (r) { return r.driver_id === driver_id; });
  const avg = round1(revs.reduce(function (s, r) { return s + r.rating; }, 0) / revs.length);
  db.prepare('UPDATE users SET rating = ? WHERE id = ?').run(avg, driver_id);

  res.json({ id: info.lastInsertRowid, average: avg });
});

/* ─────────── Демо-данные (чтобы сайт не был пустым) ─────────── */

function dayOffset(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

async function seedDemo() {
  if (process.env.SEED_DEMO === '0') return;
  if (db.prepare('SELECT * FROM users').all().length > 0) return;

  const hash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  const drivers = [
    { name: 'Алексей', email: 'alexey@demo.local', rating: 4.8, bio: 'Езжу Москва — Питер каждые выходные.' },
    { name: 'Марина',  email: 'marina@demo.local', rating: 4.9, bio: 'Аккуратное вождение, без курения, люблю музыку.' },
    { name: 'Дмитрий', email: 'dmitry@demo.local', rating: 4.6, bio: 'Универсал, много места для багажа.' },
    { name: 'Ольга',   email: 'olga@demo.local',   rating: 5.0, bio: 'Стаж 12 лет, без аварий.' }
  ];
  const ids = drivers.map(function (d) {
    return db.prepare(
      'INSERT INTO users (name, email, password_hash, phone, bio, rating) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(d.name, d.email, hash, '', d.bio, d.rating).lastInsertRowid;
  });

  const trips = [
    [0, 'Москва', 'Санкт-Петербург', 1, '08:00', 3, 1500, 'Выезд от м. Речной вокзал. Остановка на кофе.'],
    [1, 'Москва', 'Казань', 2, '06:30', 2, 1800, 'Едем без пробок по М-12, можно с небольшим багажом.'],
    [2, 'Екатеринбург', 'Челябинск', 1, '17:00', 4, 700, 'После работы, комфортный минивэн.'],
    [3, 'Краснодар', 'Сочи', 3, '09:15', 3, 900, 'Едем вдоль моря, остановимся у Джубги.'],
    [1, 'Новосибирск', 'Томск', 4, '10:00', 3, 600, 'Можно с животными, предупредите заранее.'],
    [0, 'Санкт-Петербург', 'Москва', 3, '19:30', 2, 1500, 'Возвращаюсь в воскресенье вечером.'],
    [2, 'Нижний Новгород', 'Москва', 5, '07:45', 3, 1000, 'Выезд рано утром, прибытие к обеду.'],
    [3, 'Казань', 'Уфа', 6, '12:00', 3, 1100, 'Едем днём, музыка по согласованию.']
  ];
  for (const t of trips) {
    const a = await geo.geocode(t[1]), z = await geo.geocode(t[2]);
    db.prepare(`
      INSERT INTO trips (driver_id, from_city, to_city, date, time, seats, price, description,
                         from_lat, from_lng, to_lat, to_lng, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ids[t[0]], t[1], t[2], dayOffset(t[3]), t[4], t[5], t[6], t[7],
           a ? a.lat : null, a ? a.lng : null, z ? z.lat : null, z ? z.lng : null, 'planned');
  }
  console.log('🌱 Добавлены демо-данные (отключить: SEED_DEMO=0)');
}

/* ─────────── START ─────────── */

const PORT = process.env.PORT || 3000;

initDb()
  .then(seedDemo)
  .then(function () {
    app.listen(PORT, function () { console.log('🚀 Сервер запущен: http://localhost:' + PORT); });
  })
  .catch(function (err) { console.error('❌ Ошибка запуска:', err); process.exit(1); });
