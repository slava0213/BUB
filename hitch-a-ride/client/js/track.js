// client/js/track.js — карта: где водитель и когда он приедет
(function () {
  const TRIP_ID = Number(new URLSearchParams(location.search).get('trip'));
  const POLL_MS = 5000;
  const SEND_MS = 4000;
  const $ = function (id) { return document.getElementById(id); };

  let ME = null, DATA = null, clockOffset = 0;
  let map = null, layers = {}, fitted = false, pickMode = false;
  let watchId = null, lastSent = 0, wakeLock = null;
  let sim = null;                   // состояние симуляции движения

  /* ───── форматирование ───── */

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return 'меньше минуты';
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h === 0) return m + ' мин';
    if (m === 60) return (h + 1) + ' ч';
    return h + ' ч' + (m ? ' ' + m + ' мин' : '');
  }
  function fmtKm(m) { return m < 1000 ? Math.round(m) + ' м' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' км'; }
  function fmtClock(ts) { return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
  function nowSrv() { return Date.now() + clockOffset; }

  // Плановое прибытие: время отправления + длительность (в часовом поясе поездки)
  function plannedArrival(date, time, sec) {
    const p = String(date).split('-').map(Number), t = String(time).split(':').map(Number);
    if (p.length < 3 || t.length < 2) return null;
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2], t[0], t[1] + Math.round(sec / 60)));
    const days = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(p[0], p[1] - 1, p[2])) / 86400000);
    const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
    return hh + ':' + mm + (days > 0 ? ' (+' + days + ' дн.)' : '');
  }

  function distM(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /* ───── карта ───── */

  function pin(cls, html) {
    return L.divIcon({ className: '', html: '<div class="map-pin ' + cls + '">' + (html || '') + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  function initMap() {
    if (typeof L === 'undefined') {
      showBanner('Не удалось загрузить карту (нет доступа к библиотеке Leaflet). Время прибытия ниже всё равно доступно.', 'warn');
      $('map').classList.add('map-off');
      return false;
    }
    map = L.map('map', { zoomControl: true }).setView([55.75, 37.62], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© участники <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    map.on('click', function (e) {
      if (!pickMode) return;
      pickMode = false; $('map').classList.remove('picking');
      savePickup(e.latlng.lat, e.latlng.lng);
    });
    map.on('dragstart', function () { $('follow').checked = false; });
    return true;
  }

  function setLayer(name, layer) {
    if (layers[name]) map.removeLayer(layers[name]);
    layers[name] = layer;
    if (layer) layer.addTo(map);
  }

  function drawMap(d) {
    if (!map) return;

    if (d.route && d.route.geometry && !layers.route) {
      setLayer('route', L.polyline(d.route.geometry, { color: '#2b2b2b', weight: 4, opacity: .75 }));
    }
    if (d.from && !layers.from) setLayer('from', L.marker([d.from.lat, d.from.lng], { icon: pin('pin-end', 'A'), title: d.trip.from_city }));
    if (d.to && !layers.to)     setLayer('to',   L.marker([d.to.lat, d.to.lng],     { icon: pin('pin-end', 'B'), title: d.trip.to_city }));

    if (d.location) {
      const ll = [d.location.lat, d.location.lng];
      if (layers.car) layers.car.setLatLng(ll);
      else setLayer('car', L.marker(ll, { icon: pin('pin-car' + (d.location.stale ? ' stale' : ''), ''), zIndexOffset: 1000, title: 'Водитель' }));
      layers.car._icon && layers.car._icon.firstChild.classList.toggle('stale', !!d.location.stale);
      if ($('follow').checked) map.panTo(ll, { animate: true });
    } else if (layers.car) { setLayer('car', null); layers.car = null; }

    // моя точка посадки + линия от водителя
    if (d.pickup) setLayer('pickup', L.marker([d.pickup.lat, d.pickup.lng], { icon: pin('pin-pickup', 'Я'), title: 'Моя точка посадки' }));
    else if (layers.pickup) { setLayer('pickup', null); layers.pickup = null; }

    const pg = d.eta && d.eta.pickup && d.eta.pickup.geometry;
    if (pg && pg.length > 1) setLayer('toPickup', L.polyline(pg, { color: '#b45309', weight: 3, dashArray: '6 8' }));
    else if (layers.toPickup) { setLayer('toPickup', null); layers.toPickup = null; }

    // для водителя — точки посадки пассажиров
    if (layers.pax) map.removeLayer(layers.pax);
    layers.pax = null;
    if (d.role === 'driver' && d.passengers.some(function (p) { return p.pickup; })) {
      const g = L.layerGroup();
      d.passengers.forEach(function (p) {
        if (p.pickup) L.marker([p.pickup.lat, p.pickup.lng], { icon: pin('pin-pickup', esc((p.name || '?').charAt(0).toUpperCase())), title: p.name }).addTo(g);
      });
      g.addTo(map); layers.pax = g;
    }

    if (!fitted) { fitAll(); fitted = true; }
  }

  function fitAll() {
    if (!map) return;
    const pts = [];
    if (DATA && DATA.from) pts.push([DATA.from.lat, DATA.from.lng]);
    if (DATA && DATA.to) pts.push([DATA.to.lat, DATA.to.lng]);
    if (DATA && DATA.location) pts.push([DATA.location.lat, DATA.location.lng]);
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
  }

  /* ───── панель ───── */

  function showBanner(text, cls) {
    const b = $('t-banner');
    b.className = 'banner ' + (cls || '');
    b.textContent = text;
    b.style.display = text ? 'block' : 'none';
  }

  function kv(rows) {
    $('kv').innerHTML = rows.filter(Boolean).map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('');
  }

  function render() {
    const d = DATA; if (!d) return;
    const t = d.trip, loc = d.location;

    $('t-title').textContent = t.from_city + ' → ' + t.to_city;
    $('t-sub').textContent = 'Водитель: ' + t.driver + ' · ' + fmtDate(t.date) + ' в ' + t.time;

    const chip = $('status-chip');
    const rows = [];

    if (t.status === 'finished') {
      chip.className = 'status-chip done'; chip.textContent = 'Поездка завершена';
      $('eta-main').textContent = 'Водитель прибыл';
      $('eta-sub').textContent = 'Спасибо, что едете вместе. Не забудьте оставить отзыв в профиле.';
      $('progress').style.display = 'none';
      kv([]);
    } else if (t.status === 'active') {
      chip.className = 'status-chip live'; chip.innerHTML = '<span class="dot online"></span> В пути';

      if (!loc) {
        $('eta-main').textContent = 'Ждём сигнал';
        $('eta-sub').textContent = d.role === 'driver'
          ? 'Разрешите доступ к геопозиции в браузере или запустите симуляцию.'
          : 'Водитель начал поездку, но его геопозиция ещё не получена.';
        $('progress').style.display = 'none';
        kv([]);
      } else {
        const e = d.eta && d.eta.destination;
        if (e) {
          const remain = Math.max(0, (e.arrival_ts - nowSrv()) / 1000);
          $('eta-main').textContent = e.near ? 'Водитель на месте' : 'Прибудет в ' + fmtClock(e.arrival_ts + 0);
          $('eta-sub').textContent = e.near ? 'Пункт назначения: ' + t.to_city : 'Через ' + fmtDur(remain) + ' · до ' + t.to_city;
          rows.push(['Осталось проехать', esc(fmtKm(e.meters))]);
        }
        if (d.progress !== null) {
          $('progress').style.display = 'block';
          $('progress-bar').style.width = Math.round(d.progress * 100) + '%';
          rows.push(['Пройдено', Math.round(d.progress * 100) + '%']);
        }
        if (loc.speed_kmh !== null && !loc.sim) rows.push(['Скорость', loc.speed_kmh + ' км/ч']);
        if (loc.sim) rows.push(['Режим', '<span class="tag demo">симуляция ×' + loc.sim + '</span>']);
        rows.push(['Обновлено', loc.age_sec < 5 ? 'только что' : loc.age_sec + ' с назад']);
        if (e && e.approx) rows.push(['Точность', 'ориентировочная (прямая линия)']);
        kv(rows);
      }
    } else {
      chip.className = 'status-chip plan'; chip.textContent = 'Ещё не выехал';
      const dur = d.route ? d.route.duration : null;
      $('eta-main').textContent = 'Выезд ' + t.time;
      $('eta-sub').textContent = dur
        ? 'По плану в пути ≈ ' + fmtDur(dur) + ', прибытие ≈ ' + plannedArrival(t.date, t.time, dur)
        : 'Маршрут не определён';
      $('progress').style.display = 'none';
      kv(d.route ? [['Расстояние', esc(fmtKm(d.route.distance))], d.route.approx ? ['Точность', 'ориентировочная'] : null] : []);
    }

    // предупреждения
    if (!d.route && !d.from) showBanner('Не удалось определить координаты городов, карта недоступна. Проверьте названия в поездке.', 'warn');
    else if (loc && loc.stale) showBanner('Сигнал водителя потерян ' + Math.round(loc.age_sec / 60) + ' мин назад. Показано последнее известное положение.', 'warn');
    else if (d.route && d.route.approx) showBanner('Сервис маршрутов временно недоступен, время рассчитано по прямой с запасом.', 'info');
    else showBanner('');

    renderPickup(d);
    renderDriver(d);
  }

  function renderPickup(d) {
    const card = $('pickup-card');
    if (d.role !== 'passenger' || d.trip.status === 'finished') { card.style.display = 'none'; return; }
    card.style.display = 'block';

    $('pick-clear').style.display = d.pickup ? '' : 'none';
    $('pickup-info').textContent = d.pickup
      ? 'Точка отмечена на карте (значок «Я»). Водитель её тоже видит.'
      : 'Отметьте, где вас забрать, — покажем, через сколько водитель подъедет именно к вам.';

    const e = d.eta && d.eta.pickup;
    $('pickup-eta').innerHTML = e
      ? (e.near
          ? '<b>Водитель рядом с вашей точкой</b>'
          : 'До вас: <b>' + esc(fmtDur(Math.max(0, (e.arrival_ts - nowSrv()) / 1000))) + '</b> · ' + esc(fmtKm(e.meters)) +
            '<br><span class="muted">Подъедет около ' + esc(fmtClock(e.arrival_ts)) + '</span>')
      : '';
  }

  function renderDriver(d) {
    const card = $('driver-card');
    if (d.role !== 'driver') { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const st = d.trip.status;

    $('start-btn').style.display  = st === 'planned' ? '' : 'none';
    $('finish-btn').style.display = st === 'active' ? '' : 'none';
    $('sim-box').style.display    = st === 'active' && d.route && d.route.geometry && d.route.geometry.length > 1 ? 'block' : 'none';
    $('sim-btn').textContent      = sim ? 'Остановить' : 'Запустить';
    $('driver-hint').textContent  =
      st === 'planned'  ? 'Нажмите «Начать поездку», когда выедете. Пассажиры с принятой заявкой увидят вас на карте.' :
      st === 'active'   ? 'Поездка идёт. Держите вкладку открытой: геопозиция передаётся, пока страница активна.' :
                          'Поездка завершена, геопозиция больше не передаётся.';

    const pax = d.passengers || [];
    $('passengers').innerHTML = pax.length
      ? '<h3 class="sub-h">Пассажиры</h3>' + pax.map(function (p) {
          let line = p.pickup ? 'точка посадки отмечена' : 'точка посадки не указана';
          if (p.eta) line = p.eta.near ? 'вы рядом с точкой посадки' : 'до точки: ' + fmtDur(Math.max(0, (p.eta.arrival_ts - nowSrv()) / 1000)) + ' · ' + fmtKm(p.eta.meters);
          return '<div class="mini-card"><b>' + esc(p.name) + '</b><br><span class="muted">' + esc(line) + '</span></div>';
        }).join('')
      : '';
  }

  /* ───── загрузка данных ───── */

  async function poll() {
    if (document.hidden && !sim) return;
    try {
      const t0 = Date.now();
      const d = await Api.get('/trips/' + TRIP_ID + '/tracking');
      clockOffset = d.server_ts - (t0 + Date.now()) / 2;
      DATA = d;
      drawMap(d);
      render();
      syncGeolocation();
    } catch (e) {
      if (e.status === 401) { location.href = 'login.html'; return; }
      $('t-sub').textContent = '';
      $('eta-main').textContent = 'Недоступно';
      $('eta-sub').textContent = e.message;
      $('status-chip').className = 'status-chip plan'; $('status-chip').textContent = 'Нет доступа';
      showBanner(e.message, 'warn');
    }
  }

  // секундный тик: «через N мин» убывает плавно между опросами
  setInterval(function () { if (DATA) { render(); } }, 1000);

  /* ───── точка посадки ───── */

  async function savePickup(lat, lng) {
    try {
      await Api.post('/trips/' + TRIP_ID + '/pickup', { lat: lat, lng: lng });
      toast('Точка посадки сохранена', 'ok');
      poll();
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ───── передача геопозиции водителем ───── */

  async function sendPosition(lat, lng, speed, heading, simMult) {
    const now = Date.now();
    if (now - lastSent < SEND_MS - 500) return;
    lastSent = now;
    try {
      await Api.post('/trips/' + TRIP_ID + '/location', {
        lat: lat, lng: lng, speed: speed, heading: heading, sim: simMult || 0
      });
      $('gps-state').textContent = simMult ? 'Передаётся симуляция движения.' : 'Геопозиция передаётся пассажирам.';
    } catch (e) { $('gps-state').textContent = 'Не удалось отправить позицию: ' + e.message; }
  }

  function syncGeolocation() {
    const need = DATA && DATA.role === 'driver' && DATA.trip.status === 'active' && !sim;
    if (need && watchId === null) {
      if (!navigator.geolocation) { $('gps-state').textContent = 'Браузер не поддерживает геолокацию. Используйте симуляцию.'; return; }
      watchId = navigator.geolocation.watchPosition(function (pos) {
        sendPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.heading, 0);
      }, function (err) {
        $('gps-state').textContent = err.code === 1
          ? 'Доступ к геопозиции запрещён. Разрешите его в настройках браузера или используйте симуляцию.'
          : 'Не удаётся определить геопозицию: ' + err.message;
      }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
      $('gps-state').textContent = 'Определяем геопозицию…';
    }
    if (!need && watchId !== null) {
      navigator.geolocation.clearWatch(watchId); watchId = null;
      if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
    }
  }

  /* ───── симуляция движения (для демонстрации) ───── */

  function toggleSim() {
    if (sim) { clearInterval(sim.timer); sim = null; renderDriver(DATA); syncGeolocation(); return; }
    const geom = DATA.route && DATA.route.geometry;
    if (!geom || geom.length < 2) { toast('Нет маршрута для симуляции', 'error'); return; }

    const mult = Number($('sim-speed').value) || 60;
    const cum = [0];
    for (let i = 1; i < geom.length; i++) cum.push(cum[i - 1] + distM(geom[i - 1], geom[i]));
    const total = cum[cum.length - 1];
    const start = DATA.location ? Math.min(total, Math.max(0, DATA.progress || 0) * total) : 0;
    sim = { pos: start, total: total, cum: cum, geom: geom, mult: mult, timer: null };

    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    const STEP = 2000, SPEED = 80 / 3.6;           // 80 км/ч в «реальном» масштабе

    function tick() {
      sim.pos = Math.min(sim.total, sim.pos + SPEED * (STEP / 1000) * sim.mult);
      let i = 1; while (i < sim.cum.length - 1 && sim.cum[i] < sim.pos) i++;
      const seg = sim.cum[i] - sim.cum[i - 1] || 1, f = Math.min(1, (sim.pos - sim.cum[i - 1]) / seg);
      const a = sim.geom[i - 1], b = sim.geom[i];
      lastSent = 0;
      sendPosition(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, SPEED, null, sim.mult).then(poll);
      if (sim.pos >= sim.total) { clearInterval(sim.timer); sim = null; toast('Симуляция завершена: вы на месте', 'ok'); }
    }
    tick();
    sim.timer = setInterval(tick, STEP);
    renderDriver(DATA);
  }

  /* ───── кнопки ───── */

  function bind() {
    $('fit-btn').addEventListener('click', function () { $('follow').checked = false; fitAll(); });
    $('follow').addEventListener('change', function () {
      if (this.checked && DATA && DATA.location && map) map.panTo([DATA.location.lat, DATA.location.lng]);
    });

    $('pick-map').addEventListener('click', function () {
      if (!map) return toast('Карта недоступна', 'error');
      pickMode = true; $('map').classList.add('picking');
      toast('Нажмите на карте место посадки', 'ok');
      $('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('pick-gps').addEventListener('click', function () {
      if (!navigator.geolocation) return toast('Браузер не поддерживает геолокацию', 'error');
      navigator.geolocation.getCurrentPosition(
        function (p) { savePickup(p.coords.latitude, p.coords.longitude); },
        function () { toast('Не удалось определить ваше положение', 'error'); },
        { enableHighAccuracy: true, timeout: 12000 });
    });
    $('pick-clear').addEventListener('click', async function () {
      try { await Api.post('/trips/' + TRIP_ID + '/pickup', { clear: true }); poll(); } catch (e) { toast(e.message, 'error'); }
    });

    $('start-btn').addEventListener('click', async function () {
      try { await Api.post('/trips/' + TRIP_ID + '/start'); toast('Поездка началась', 'ok'); await poll(); }
      catch (e) { toast(e.message, 'error'); }
    });
    $('finish-btn').addEventListener('click', async function () {
      if (!confirm('Завершить поездку? Передача геопозиции остановится.')) return;
      try {
        if (sim) toggleSim();
        await Api.post('/trips/' + TRIP_ID + '/finish'); toast('Поездка завершена', 'ok'); await poll();
      } catch (e) { toast(e.message, 'error'); }
    });
    $('sim-btn').addEventListener('click', toggleSim);
  }

  /* ───── старт ───── */

  (async function init() {
    if (!TRIP_ID) { $('t-sub').textContent = 'Не указана поездка'; return; }
    ME = await getCurrentUser();
    if (!ME) { location.href = 'login.html'; return; }
    initMap();
    bind();
    await poll();
    setInterval(poll, POLL_MS);
  })();
})();
