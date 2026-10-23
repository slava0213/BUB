// client/js/profile.js
let CURRENT_USER = null;

function statusBadge(status) {
  const cls = status === 'принята' ? 'good' : status === 'отклонена' ? 'bad' : 'warn';
  return '<span class="tag ' + cls + '">' + esc(status) + '</span>';
}

async function loadProfile() {
  CURRENT_USER = await getCurrentUser();
  if (!CURRENT_USER) { location.href = 'login.html'; return false; }

  document.getElementById('p-avatar').innerHTML = avatar(CURRENT_USER.name, CURRENT_USER.id, true);
  document.getElementById('p-title').textContent = CURRENT_USER.name;
  document.getElementById('p-rating').innerHTML = CURRENT_USER.rating
    ? '<span class="stars-line">' + stars(CURRENT_USER.rating) + '</span> ' + Number(CURRENT_USER.rating).toFixed(1)
    : 'Рейтинг появится после первых отзывов';

  document.getElementById('p-name').value  = CURRENT_USER.name  || '';
  document.getElementById('p-email').value = CURRENT_USER.email || '';
  document.getElementById('p-phone').value = CURRENT_USER.phone || '';
  document.getElementById('p-bio').value   = CURRENT_USER.bio   || '';

  document.getElementById('profile-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errBox = document.getElementById('profile-error');
    errBox.style.display = 'none';
    try {
      await Api.put('/me', {
        name:  document.getElementById('p-name').value.trim(),
        phone: document.getElementById('p-phone').value.trim(),
        bio:   document.getElementById('p-bio').value.trim()
      });
      toast('Профиль сохранён', 'ok');
      const me = await getCurrentUser(true);
      CURRENT_USER = me;
      document.getElementById('p-title').textContent = me.name;
      document.getElementById('p-avatar').innerHTML = avatar(me.name, me.id, true);
      window.refreshNav();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  });
  return true;
}

async function loadMyTrips() {
  const box = document.getElementById('my-trips');
  try {
    const trips = (await Api.get('/trips?all=1')).filter(function (t) { return t.driver_id === CURRENT_USER.id; });
    if (!trips.length) {
      box.innerHTML = emptyBlock('🚗', 'Вы ещё не создавали поездок.', 'create-trip.html', 'Создать поездку');
      return;
    }
    box.innerHTML = '<div class="stack">' + trips.map(function (t) {
      return '<div class="mini-card"><h4>' + cityIcon(t.from_city) + ' ' + esc(t.from_city) + ' → ' + cityIcon(t.to_city) + ' ' + esc(t.to_city) + '</h4>' +
        '<p>📅 ' + fmtDate(t.date) + ' в ' + esc(t.time) + ' · 💺 ' + t.seats + ' · 💰 ' + fmtPrice(t.price) + '</p>' +
        '<div class="mini-actions"><a class="btn btn-secondary btn-small" href="chat.html?trip=' + t.id + '">💬 Чат</a></div></div>';
    }).join('') + '</div>';
  } catch (e) { box.innerHTML = emptyBlock('⚠️', esc(e.message)); }
}

async function loadIncomingRequests() {
  const box = document.getElementById('incoming-requests');
  try {
    const reqs = await Api.get('/me/incoming-requests');
    if (!reqs.length) {
      box.innerHTML = emptyBlock('📭', 'Пока никто не оставил заявок на ваши поездки.');
      return;
    }
    box.innerHTML = '<div class="stack">' + reqs.map(function (r) {
      const decide = r.status === 'ожидает'
        ? '<button class="btn btn-small" onclick="decide(' + r.id + ',\'accept\')">✅ Принять</button>' +
          '<button class="btn btn-secondary btn-small" onclick="decide(' + r.id + ',\'reject\')">❌ Отклонить</button>'
        : (r.status === 'принята'
            ? '<button class="btn btn-secondary btn-small" onclick="decide(' + r.id + ',\'reject\')">Отменить участие</button>' : '');
      return '<div class="mini-card"><h4>' + esc(r.from_city) + ' → ' + esc(r.to_city) + '</h4>' +
        '<p>📅 ' + fmtDate(r.date) + ' в ' + esc(r.time) + '</p>' +
        '<p>👤 ' + esc(r.passenger_name) + ' · ' + esc(r.passenger_phone || r.passenger_email || '—') + '</p>' +
        '<p>' + statusBadge(r.status) + '</p>' +
        '<div class="mini-actions">' + decide +
        '<a class="btn btn-secondary btn-small" href="chat.html?trip=' + r.trip_id + '">💬 Написать</a></div></div>';
    }).join('') + '</div>';
  } catch (e) { box.innerHTML = emptyBlock('⚠️', esc(e.message)); }
}

async function decide(id, action) {
  try {
    await Api.post('/requests/' + id + '/' + action);
    toast(action === 'accept' ? 'Заявка принята' : 'Заявка отклонена', 'ok');
    loadIncomingRequests();
    loadMyTrips();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadMyRequests() {
  const box = document.getElementById('my-requests');
  try {
    const res = await Promise.all([Api.get('/me/requests'), Api.get('/me/reviews').catch(function () { return []; })]);
    const reqs = res[0], reviews = res[1];
    if (!reqs.length) {
      box.innerHTML = emptyBlock('✋', 'У вас пока нет заявок.', 'search.html', 'Найти поездку');
      return;
    }
    box.innerHTML = '<div class="stack">' + reqs.map(function (r) {
      const reviewed = reviews.some(function (rv) { return rv.driver_id === r.driver_id; });
      let review = '';
      if (r.status === 'принята' && !reviewed) {
        review = '<button class="btn btn-small" data-id="' + r.driver_id + '" data-name="' + esc(r.driver) + '" onclick="openReviewModal(this.dataset.id, this.dataset.name)">⭐ Оставить отзыв</button>';
      } else if (reviewed) {
        review = '<span class="tag good">⭐ Отзыв оставлен</span>';
      }
      return '<div class="mini-card"><h4>' + esc(r.from_city) + ' → ' + esc(r.to_city) + '</h4>' +
        '<p>📅 ' + fmtDate(r.date) + ' в ' + esc(r.time) + ' · 💰 ' + fmtPrice(r.price || 0) + '</p>' +
        '<p>🚗 ' + esc(r.driver) + '</p><p>' + statusBadge(r.status) + '</p>' +
        '<div class="mini-actions"><a class="btn btn-secondary btn-small" href="chat.html?trip=' + r.trip_id + '">💬 Написать</a>' + review + '</div></div>';
    }).join('') + '</div>';
  } catch (e) { box.innerHTML = emptyBlock('⚠️', esc(e.message)); }
}

async function loadReviews() {
  const box = document.getElementById('reviews-list');
  try {
    const reviews = await Api.get('/users/' + CURRENT_USER.id + '/reviews');
    if (!reviews.length) {
      box.innerHTML = emptyBlock('⭐', 'Отзывов о вас пока нет. Они появятся после совместных поездок.');
      return;
    }
    box.innerHTML = '<div class="stack">' + reviews.map(function (r) {
      return '<div class="mini-card"><p><span class="stars-line">' + stars(r.rating) + '</span> от <b>' + esc(r.author) + '</b></p>' +
        (r.text ? '<p>' + esc(r.text) + '</p>' : '') + '</div>';
    }).join('') + '</div>';
  } catch (e) { box.innerHTML = emptyBlock('⚠️', esc(e.message)); }
}

/* ── Отзыв ── */
let currentRating = 0, currentDriverId = null;

function openReviewModal(driverId, driverName) {
  currentDriverId = Number(driverId);
  currentRating = 0;
  document.getElementById('review-driver-name').textContent = driverName || '—';
  document.getElementById('review-text').value = '';
  document.getElementById('review-error').style.display = 'none';
  updateStars();
  document.getElementById('review-modal').style.display = 'flex';
}
function closeReviewModal() { document.getElementById('review-modal').style.display = 'none'; }
function setRating(n) { currentRating = n; updateStars(); }
function updateStars() {
  document.querySelectorAll('#review-stars span').forEach(function (s, i) {
    s.textContent = i < currentRating ? '★' : '☆';
    s.classList.toggle('active', i < currentRating);
  });
}

async function submitReview() {
  const errBox = document.getElementById('review-error');
  errBox.style.display = 'none';
  if (currentRating < 1) {
    errBox.textContent = 'Поставьте оценку (1–5 звёзд)';
    errBox.style.display = 'block';
    return;
  }
  try {
    await Api.post('/reviews', {
      driver_id: currentDriverId, rating: currentRating,
      text: document.getElementById('review-text').value.trim()
    });
    closeReviewModal();
    loadMyRequests();
    toast('Спасибо за отзыв!', 'ok');
  } catch (e) {
    errBox.textContent = e.message;
    errBox.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  if (await loadProfile()) {
    loadMyTrips(); loadIncomingRequests(); loadMyRequests(); loadReviews();
  }
});
