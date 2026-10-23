// client/js/trips.js — карточки поездок (главная + поиск)

const CITY_ICONS = [
  ['москв', '🏛️'], ['петербург', '🌉'], ['спб', '🌉'], ['казан', '🕌'], ['екатеринбург', '🏔️'],
  ['новосибирск', '🌲'], ['сочи', '🏖️'], ['краснодар', '🌻'], ['нижн', '⛪'], ['уф', '🎶'],
  ['челябинск', '🏭'], ['томск', '🎓']
];
function cityIcon(name) {
  const n = String(name || '').toLowerCase();
  for (let i = 0; i < CITY_ICONS.length; i++) if (n.indexOf(CITY_ICONS[i][0]) !== -1) return CITY_ICONS[i][1];
  return '📍';
}

const ACCENTS = ['#6c3df4', '#ff4f8b', '#12c2a5', '#ff7a45', '#38b6ff'];

function emptyBlock(icon, text, btnHref, btnText) {
  return '<div class="empty"><span class="big">' + icon + '</span>' + text +
    (btnHref ? '<br><a class="btn" href="' + btnHref + '">' + btnText + '</a>' : '') + '</div>';
}

function renderTripCard(t, me) {
  const isMine = me && t.driver_id === me.id;
  const accent = ACCENTS[Math.abs(Number(t.id) || 0) % ACCENTS.length];
  const seats = Number(t.seats);
  const seatsTag = seats > 0
    ? '<span class="tag ' + (seats <= 1 ? 'warn' : 'good') + '">💺 Мест: ' + seats + '</span>'
    : '<span class="tag bad">💺 Мест нет</span>';

  let actions;
  if (isMine) {
    actions = '<span class="tag demo">🚗 Ваша поездка</span><a class="btn btn-secondary btn-small" href="chat.html?trip=' + t.id + '">💬 Чат</a>';
  } else if (me) {
    actions =
      (seats > 0 ? '<button class="btn btn-small" onclick="sendRequest(' + t.id + ', this)">✋ Подать заявку</button>' : '') +
      '<a class="btn btn-secondary btn-small" href="chat.html?trip=' + t.id + '">💬 Написать</a>';
  } else {
    actions = '<a class="btn btn-small" href="login.html">Войти, чтобы поехать</a>';
  }

  return '<article class="trip-card" style="--accent:' + accent + '">' +
    '<div class="trip-top">' +
      '<div class="trip-route">' +
        '<span class="city">' + cityIcon(t.from_city) + ' ' + esc(t.from_city) + '</span>' +
        '<span class="line"></span>' +
        '<span class="city">' + cityIcon(t.to_city) + ' ' + esc(t.to_city) + '</span>' +
      '</div>' +
      '<div class="trip-price">' + fmtPrice(t.price) + '</div>' +
    '</div>' +
    '<div class="trip-meta">' +
      '<span class="tag">📅 ' + fmtDate(t.date) + '</span>' +
      '<span class="tag">🕒 ' + esc(t.time) + '</span>' +
      seatsTag +
      (t.demo ? '<span class="tag demo">демо</span>' : '') +
    '</div>' +
    (t.description ? '<p class="trip-desc">📝 ' + esc(t.description) + '</p>' : '') +
    '<div class="trip-bottom">' +
      '<div class="driver">' + avatar(t.driver, t.driver_id) +
        '<span>' + esc(t.driver) + '<small>' + (t.driver_rating ? '⭐ ' + Number(t.driver_rating).toFixed(1) : 'Новый водитель') + '</small></span></div>' +
      actions +
    '</div>' +
  '</article>';
}

async function loadTrips() {
  const container = document.getElementById('trips-list');
  if (!container) return;
  try {
    const results = await Promise.all([Api.get('/trips'), getCurrentUser()]);
    const trips = results[0], me = results[1];
    if (!trips.length) {
      container.innerHTML = emptyBlock('🛣️', 'Пока нет ни одной поездки.', 'create-trip.html', 'Создать первую');
      return;
    }
    container.innerHTML = trips.map(function (t) { return renderTripCard(t, me); }).join('');
  } catch (e) {
    container.innerHTML = emptyBlock('⚠️', 'Ошибка: ' + esc(e.message));
  }
}

async function sendRequest(tripId, btn) {
  try {
    if (btn) btn.disabled = true;
    await Api.post('/trips/' + tripId + '/requests');
    toast('Заявка отправлена! Водитель увидит её в профиле.', 'ok');
    if (btn) { btn.textContent = '✔ Заявка отправлена'; }
  } catch (e) {
    if (btn) btn.disabled = false;
    toast(e.message, 'error');
  }
}

async function loadStats() {
  try {
    const s = await Api.get('/stats');
    const set = function (id, v) { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-trips', s.trips);
    set('stat-users', s.users);
    set('stat-cities', s.cities);
    set('stat-seats', s.seats);
  } catch (e) { console.warn('Статистика недоступна:', e); }
}
