// client/js/chat.js — живой чат: автообновление, «печатает...», онлайн-статус
let CURRENT_TRIP_ID = null;
let CURRENT_USER = null;
let TYPING_SEND_TIMER = null;
let LAST_MESSAGE_KEY = '';
let TRIPS_CACHE = [];

async function initChat() {
  CURRENT_USER = await getCurrentUser();
  if (!CURRENT_USER) { location.href = 'login.html'; return; }

  await renderChatList();

  const urlTrip = new URLSearchParams(location.search).get('trip');
  if (urlTrip) openChat(Number(urlTrip));

  sendHeartbeat();
  setInterval(sendHeartbeat, 10000);

  setInterval(function () {
    if (CURRENT_TRIP_ID && !document.hidden) {
      loadMessages(CURRENT_TRIP_ID);
      checkTyping(CURRENT_TRIP_ID);
      checkOnline(CURRENT_TRIP_ID);
    }
  }, 2500);

  document.getElementById('chat-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !CURRENT_TRIP_ID) return;
    try {
      await Api.post('/trips/' + CURRENT_TRIP_ID + '/messages', { text: text });
      input.value = '';
      await loadMessages(CURRENT_TRIP_ID);
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('chat-input').addEventListener('input', function () {
    if (!CURRENT_TRIP_ID || TYPING_SEND_TIMER) return;
    Api.post('/trips/' + CURRENT_TRIP_ID + '/typing').catch(function () {});
    TYPING_SEND_TIMER = setTimeout(function () { TYPING_SEND_TIMER = null; }, 3000);
  });
}

async function sendHeartbeat() { try { await Api.post('/heartbeat'); } catch (e) {} }

async function renderChatList() {
  const container = document.getElementById('chat-list-items');
  try {
    const res = await Promise.all([
      Api.get('/trips?all=1'),
      Api.get('/me/requests').catch(function () { return []; })
    ]);
    TRIPS_CACHE = res[0];
    const requested = new Set(res[1].filter(function (r) { return r.status !== 'отклонена'; })
                                    .map(function (r) { return r.trip_id; }));

    const mine = TRIPS_CACHE.filter(function (t) { return t.driver_id === CURRENT_USER.id || requested.has(t.id); });

    if (!mine.length) {
      container.innerHTML = emptyBlock('💬', 'Чатов пока нет. Подайте заявку на поездку — и здесь появится переписка.', 'search.html', 'Найти поездку');
      return;
    }
    container.innerHTML = mine.map(function (t) {
      const isDriver = t.driver_id === CURRENT_USER.id;
      return '<div class="chat-item" data-trip="' + t.id + '" onclick="openChat(' + t.id + ')">' +
        '<div class="chat-item-title">' + esc(t.from_city) + ' → ' + esc(t.to_city) + '</div>' +
        '<div class="chat-item-sub">' + fmtDate(t.date) + ' · ' + (isDriver ? '🚗 Вы водитель' : '✋ Вы пассажир') + '</div></div>';
    }).join('');
  } catch (e) {
    container.innerHTML = emptyBlock('⚠️', 'Ошибка: ' + esc(e.message));
  }
}

async function openChat(tripId) {
  CURRENT_TRIP_ID = tripId;
  LAST_MESSAGE_KEY = '';

  document.querySelectorAll('.chat-item').forEach(function (el) {
    el.classList.toggle('active', Number(el.getAttribute('data-trip')) === tripId);
  });
  document.getElementById('chat-form').style.display = 'block';

  const trip = TRIPS_CACHE.find(function (t) { return t.id === tripId; });
  if (trip) {
    document.getElementById('chat-header').innerHTML =
      '<h3>' + esc(trip.from_city) + ' → ' + esc(trip.to_city) + '</h3>' +
      '<small>Водитель: ' + esc(trip.driver) + ' · ' + fmtDate(trip.date) + ' в ' + esc(trip.time) + '</small>' +
      '<div id="online-status" class="online-status"></div>';
  }
  await loadMessages(tripId);
  await checkOnline(tripId);
}

async function loadMessages(tripId) {
  const box = document.getElementById('chat-box');
  try {
    const messages = await Api.get('/trips/' + tripId + '/messages');
    if (tripId !== CURRENT_TRIP_ID) return;

    const key = messages.length + ':' + (messages.length ? messages[messages.length - 1].id : 0);
    if (key === LAST_MESSAGE_KEY) return;
    LAST_MESSAGE_KEY = key;

    if (!messages.length) {
      box.innerHTML = emptyBlock('👋', 'Сообщений пока нет. Напишите первым!');
      return;
    }

    let html = '', lastDate = '';
    messages.forEach(function (m) {
      const d = parseServerDate(m.created_at);
      const label = formatDate(d);
      if (label !== lastDate) { html += '<div class="chat-date-separator">' + label + '</div>'; lastDate = label; }

      const isMe = m.author_id === CURRENT_USER.id;
      const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      html += '<div class="msg ' + (isMe ? 'me' : 'other') + '">' +
        (!isMe ? '<div class="msg-author">' + esc(m.author) + '</div>' : '') +
        '<div class="msg-text">' + esc(m.text) + '</div>' +
        '<div class="msg-time">' + time + '</div></div>';
    });
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  } catch (e) {
    box.innerHTML = emptyBlock('🔒', esc(e.message));
  }
}

async function checkTyping(tripId) {
  try {
    const data = await Api.get('/trips/' + tripId + '/typing');
    const box = document.getElementById('chat-box');
    const indicator = document.getElementById('typing-indicator');
    if (data.typing && data.typing.length) {
      if (!indicator) {
        const div = document.createElement('div');
        div.id = 'typing-indicator';
        div.className = 'typing-indicator';
        div.innerHTML = '<span></span><span></span><span></span> печатает...';
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
      }
    } else if (indicator) indicator.remove();
  } catch (e) {}
}

async function checkOnline(tripId) {
  try {
    const data = await Api.get('/trips/' + tripId + '/online');
    const el = document.getElementById('online-status');
    if (!el) return;
    el.innerHTML = (data.online && data.online.length)
      ? '<span class="dot online"></span> собеседник онлайн'
      : '<span class="dot offline"></span> никого нет онлайн';
  } catch (e) {}
}

function parseServerDate(s) {
  if (!s) return new Date();
  return new Date(s.charAt(s.length - 1) === 'Z' ? s : s + 'Z');
}

function formatDate(date) {
  const day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  const now = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (day(date) === day(now)) return 'Сегодня';
  if (day(date) === day(y)) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

initChat();
