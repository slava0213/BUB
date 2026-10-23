// client/js/tracking.js — отслеживание водителя в реальном времени
//
// Водитель: включает трансляцию геопозиции (navigator.geolocation) → сервер.
// Пассажир: раз в несколько секунд спрашивает у сервера, где водитель,
//           и (если разрешит определить своё местоположение) видит расстояние и время.
//
// Важно: геолокация в браузере работает только по HTTPS (или на localhost).
const Tracking = (function () {
  const POLL_MS       = 4000;    // как часто пассажир опрашивает сервер
  const SEND_MS       = 5000;    // как часто водитель отправляет позицию
  const ARRIVE_METERS = 150;     // ближе этого — считаем, что водитель на месте
  const AVG_SPEED_KMH = 40;      // средняя скорость для грубой оценки времени
  const ROAD_FACTOR   = 1.3;     // дорога длиннее прямой линии

  let tripId = null, isDriver = false;
  let pollTimer = null;
  let driverWatch = null, lastSent = 0, lastSentAt = null;
  let myWatch = null, myPos = null;
  let lastData = null;
  let arrivedNotified = false;

  /* ── Помощники ── */

  // Расстояние между двумя точками (формула гаверсинусов), метры
  function distanceM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function fmtDist(m) {
    return m < 1000 ? Math.round(m / 10) * 10 + ' м' : (m / 1000).toFixed(1) + ' км';
  }

  function fmtEta(m) {
    const min = Math.round((m / 1000) * ROAD_FACTOR / AVG_SPEED_KMH * 60);
    if (min < 1) return 'меньше минуты';
    if (min < 60) return '≈ ' + min + ' мин';
    return '≈ ' + Math.floor(min / 60) + ' ч ' + (min % 60) + ' мин';
  }

  function mapLink(lat, lng) {
    return 'https://yandex.ru/maps/?pt=' + lng + ',' + lat + '&z=16&l=map';
  }

  function geoError(err) {
    if (err && err.code === 1) return 'Доступ к геопозиции запрещён. Разрешите его в настройках браузера.';
    if (err && err.code === 2) return 'Не удалось определить местоположение.';
    if (err && err.code === 3) return 'Геопозиция не определилась вовремя.';
    return 'Геолокация недоступна на этом устройстве.';
  }

  function panel() { return document.getElementById('track-panel'); }

  /* ── Водитель ── */

  function startSharing() {
    if (!navigator.geolocation) { toast('Браузер не поддерживает геолокацию', 'error'); return; }
    if (driverWatch !== null) return;

    const id = tripId;
    driverWatch = navigator.geolocation.watchPosition(
      function (pos) {
        const now = Date.now();
        if (now - lastSent < SEND_MS) return;
        lastSent = now;
        Api.post('/trips/' + id + '/location', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }).then(function () { lastSentAt = new Date(); render(); })
          .catch(function (e) { toast(e.message, 'error'); });
      },
      function (err) {
        toast(geoError(err), 'error');
        stopSharing(true);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
    toast('Трансляция включена — пассажиры видят, где вы', 'ok');
    render();
  }

  function stopSharing(silent) {
    if (driverWatch !== null) {
      navigator.geolocation.clearWatch(driverWatch);
      driverWatch = null;
      lastSent = 0; lastSentAt = null;
      if (tripId) Api.post('/trips/' + tripId + '/location/stop').catch(function () {});
      if (!silent) toast('Трансляция остановлена', 'ok');
    }
    render();
  }

  async function markArrived() {
    try {
      await Api.post('/trips/' + tripId + '/arrived');
      toast('Пассажиры получили уведомление в чате', 'ok');
      if (typeof loadMessages === 'function') loadMessages(tripId);
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ── Пассажир ── */

  function locateMe() {
    if (!navigator.geolocation) { toast('Браузер не поддерживает геолокацию', 'error'); return; }
    if (myWatch !== null) return;
    myWatch = navigator.geolocation.watchPosition(
      function (pos) { myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; render(); },
      function (err) { toast(geoError(err), 'error'); myWatch = null; },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  async function poll() {
    if (!tripId || isDriver || document.hidden) return;
    try {
      lastData = await Api.get('/trips/' + tripId + '/location');
      render();
    } catch (e) {
      const el = panel();
      if (el) el.innerHTML = '<div class="track-title">📍 Где водитель</div><div class="track-muted">' + esc(e.message) + '</div>';
    }
  }

  /* ── Отрисовка ── */

  function renderDriver(el) {
    const sharing = driverWatch !== null;
    let html = '<div class="track-title">📍 Трансляция для пассажиров</div>';

    if (sharing) {
      html += '<div class="track-line"><span class="dot online"></span> Пассажиры видят вашу позицию</div>' +
        '<div class="track-muted">' + (lastSentAt
          ? 'Последняя отправка: ' + lastSentAt.toLocaleTimeString('ru-RU')
          : 'Определяем местоположение…') + '</div>' +
        '<div class="track-actions">' +
          '<button class="btn btn-small" id="trk-arrived" type="button">🚗 Я на месте</button>' +
          '<button class="btn btn-secondary btn-small" id="trk-stop" type="button">⏹ Остановить</button>' +
        '</div>';
    } else {
      html += '<div class="track-muted">Включите, когда выедете за пассажирами — они увидят, сколько осталось до встречи.</div>' +
        '<div class="track-actions"><button class="btn btn-small" id="trk-start" type="button">📍 Начать трансляцию</button></div>';
    }
    el.className = 'track-panel';
    el.innerHTML = html;

    const bind = function (id, fn) { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
    bind('trk-start', startSharing);
    bind('trk-stop', function () { stopSharing(false); });
    bind('trk-arrived', markArrived);
  }

  function renderPassenger(el) {
    const d = lastData;
    let html = '<div class="track-title">📍 Где водитель</div>';
    let arrived = false;

    if (!d) {
      html += '<div class="track-muted">Загрузка…</div>';
    } else if (d.arrived) {
      arrived = true;
      html += '<div class="track-big">🎉 Водитель на месте!</div>';
    } else if (!d.active) {
      html += '<div class="track-muted">Водитель пока не включил трансляцию. Как только выедет — здесь появится расстояние до него.</div>';
    } else {
      const driver = { lat: d.lat, lng: d.lng };
      if (myPos) {
        const m = distanceM(driver, myPos);
        if (m <= ARRIVE_METERS) {
          arrived = true;
          html += '<div class="track-big">🎉 Водитель рядом!</div>';
        } else {
          html += '<div class="track-big">' + fmtDist(m) + '</div>' +
                  '<div class="track-line">Примерно ' + fmtEta(m) + ' до вас</div>';
        }
      } else {
        html += '<div class="track-line"><span class="dot online"></span> Водитель в пути</div>' +
                '<div class="track-muted">Чтобы увидеть расстояние и время, определите своё местоположение.</div>';
      }
      html += '<div class="track-muted">Обновлено ' + d.age_sec + ' сек назад</div>' +
        '<div class="track-actions">' +
          (myPos ? '' : '<button class="btn btn-small" id="trk-locate" type="button">📍 Определить, где я</button>') +
          '<a class="btn btn-secondary btn-small" target="_blank" rel="noopener" href="' + mapLink(d.lat, d.lng) + '">🗺 Открыть на карте</a>' +
        '</div>';
    }

    el.className = 'track-panel' + (arrived ? ' arrived' : '');
    el.innerHTML = html;

    const b = document.getElementById('trk-locate');
    if (b) b.addEventListener('click', locateMe);

    if (arrived && !arrivedNotified) {
      arrivedNotified = true;
      toast('🚗 Водитель приехал!', 'ok');
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('Попутчики', { body: 'Водитель приехал!' });
      }
    }
  }

  function render() {
    const el = panel();
    if (!el || !tripId) return;
    el.style.display = 'block';
    if (isDriver) renderDriver(el); else renderPassenger(el);
  }

  /* ── Публичный интерфейс ── */

  function open(id, driver) {
    if (tripId === id) return;   // тот же чат — ничего не сбрасываем
    close();
    tripId = id;
    isDriver = !!driver;
    lastData = null;
    arrivedNotified = false;

    if (!isDriver && window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    render();
    if (!isDriver) {
      poll();
      pollTimer = setInterval(poll, POLL_MS);
    }
  }

  function close() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (driverWatch !== null) stopSharing(true);
    if (myWatch !== null) { navigator.geolocation.clearWatch(myWatch); myWatch = null; }
    myPos = null;
    const el = panel();
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    tripId = null;
  }

  window.addEventListener('beforeunload', function () {
    // Если водитель закрыл страницу — пытаемся сообщить серверу, что трансляция закончилась
    if (driverWatch !== null && tripId && navigator.sendBeacon) {
      navigator.sendBeacon('/api/trips/' + tripId + '/location/stop');
    }
  });

  return { open: open, close: close };
})();
