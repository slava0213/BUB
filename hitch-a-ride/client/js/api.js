// client/js/api.js — API-клиент и общие помощники
const API = '/api';

const Api = {
  async request(method, path, body) {
    const opts = { method: method, credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(API + path, opts);
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const err = new Error(data.error || ('Ошибка ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get:  function (path)       { return Api.request('GET',  path); },
  post: function (path, body) { return Api.request('POST', path, body); },
  put:  function (path, body) { return Api.request('PUT',  path, body); }
};

/* Защита от XSS: экранируем всё, что пришло от пользователей */
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return esc(d);
  return dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
}

function fmtPrice(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }

const AVATAR_COLORS = ['#6c3df4', '#ff4f8b', '#12c2a5', '#ff7a45', '#38b6ff', '#c9308a'];
function colorFor(id) { return AVATAR_COLORS[Math.abs(Number(id) || 0) % AVATAR_COLORS.length]; }

function avatar(name, id, big) {
  const letter = esc((name || '?').trim().charAt(0).toUpperCase());
  return '<span class="avatar' + (big ? ' lg' : '') + '" style="background:' + colorFor(id) + '">' + letter + '</span>';
}

function stars(rating) {
  const r = Math.round(rating || 0);
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function toast(msg, type) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(function () { el.remove(); }, 3500);
}
