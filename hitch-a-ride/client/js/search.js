// client/js/search.js
let FOUND = [];
let ME = null;

function sortTrips(list, mode) {
  const a = list.slice();
  if (mode === 'price')  a.sort(function (x, y) { return x.price - y.price; });
  if (mode === 'rating') a.sort(function (x, y) { return (y.driver_rating || 0) - (x.driver_rating || 0); });
  return a; // по умолчанию сервер уже отсортировал по дате
}

function drawResults() {
  const container = document.getElementById('search-results');
  const sorted = sortTrips(FOUND, document.getElementById('sort').value);
  document.getElementById('count').textContent = 'Найдено: ' + FOUND.length;
  container.innerHTML = sorted.length
    ? sorted.map(function (t) { return renderTripCard(t, ME); }).join('')
    : emptyBlock('🔎', 'По вашему запросу ничего не найдено. Попробуйте другой город или дату.', 'create-trip.html', 'Предложить свою поездку');
}

async function runSearch() {
  const params = new URLSearchParams();
  const from = document.getElementById('s-from').value.trim();
  const to   = document.getElementById('s-to').value.trim();
  const date = document.getElementById('s-date').value;
  if (from) params.set('from', from);
  if (to)   params.set('to', to);
  if (date) params.set('date', date);

  history.replaceState(null, '', params.toString() ? '?' + params.toString() : location.pathname);

  const container = document.getElementById('search-results');
  container.innerHTML = emptyBlock('⏳', 'Ищем попутчиков...');
  try {
    const res = await Promise.all([Api.get('/trips?' + params.toString()), getCurrentUser()]);
    FOUND = res[0]; ME = res[1];
    drawResults();
  } catch (e) {
    container.innerHTML = emptyBlock('⚠️', 'Ошибка: ' + esc(e.message));
  }
}

document.getElementById('search-form').addEventListener('submit', function (e) { e.preventDefault(); runSearch(); });
document.getElementById('sort').addEventListener('change', drawResults);

// Параметры из адресной строки (быстрый поиск с главной, чипы маршрутов)
const q = new URLSearchParams(location.search);
document.getElementById('s-from').value = q.get('from') || '';
document.getElementById('s-to').value   = q.get('to') || '';
document.getElementById('s-date').value = q.get('date') || '';
runSearch();
