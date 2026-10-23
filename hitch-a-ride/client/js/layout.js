// client/js/layout.js — шапка, бегущая строка и подвал для всех страниц
(function () {
  const S = window.SITE || {};
  const page = document.body.getAttribute('data-page') || '';

  const links = [
    ['home',    'index.html',        '🚗 Поездки'],
    ['create',  'create-trip.html',  '➕ Создать'],
    ['search',  'search.html',       '🔍 Поиск'],
    ['chat',    'chat.html',         '💬 Чат'],
    ['profile', 'profile.html',      '👤 Профиль']
  ];

  const tgUrl = 'https://t.me/' + String(S.telegram || '').replace(/^@/, '');
  const phoneHref = 'tel:' + String(S.phone || '').replace(/[^+\d]/g, '');

  /* ── бегущая строка ── */
  const items = [
    '🚗 Проект сделал <b>' + esc(S.name) + '</b>',
    '✈️ Telegram: <a href="' + esc(tgUrl) + '" target="_blank" rel="noopener">' + esc(S.telegram) + '</a>',
    '✉️ Почта: <a href="mailto:' + esc(S.email) + '">' + esc(S.email) + '</a>',
    '📞 Телефон: <a href="' + esc(phoneHref) + '">' + esc(S.phone) + '</a>',
    '🐙 GitHub: <a href="' + esc(S.github) + '" target="_blank" rel="noopener">' + esc(String(S.github).replace('https://', '')) + '</a>',
    '🌍 Едем вместе — дешевле и веселее!'
  ];
  const group = items.map(function (i) { return '<span class="marquee-item">' + i + '</span>'; }).join('');
  // Дублируем содержимое — цикл бесшовный (анимация сдвигает на -50%)
  const track = group + group + group + group;

  const header = `
    <div class="marquee" aria-label="Контакты автора"><div class="marquee-track">${track}</div></div>
    <header class="site-header" id="site-header">
      <div class="header-inner">
        <a class="brand" href="index.html"><img src="images/favicon.svg" alt="" /><span>Попутчики</span></a>
        <button class="burger" id="burger" aria-label="Меню">☰</button>
        <nav class="nav-links" aria-label="Основное меню">
          ${links.map(function (l) {
            return '<a href="' + l[1] + '"' + (l[0] === page ? ' class="active"' : '') + '>' + l[2] + '</a>';
          }).join('')}
        </nav>
        <div class="auth-box" id="auth-box"></div>
      </div>
    </header>`;

  /* ── подвал с контактами ── */
  const footer = `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-about">
          <h3>Свяжитесь со мной 👋</h3>
          <p>Меня зовут <b>${esc(S.name)}</b> — ${esc(S.role)}. Пишите по любым вопросам: идеи, баги, сотрудничество.</p>
        </div>
        <div class="contacts">
          <a class="contact" href="${esc(tgUrl)}" target="_blank" rel="noopener"><span class="contact-icon">✈️</span><span><small>Telegram</small><b>${esc(S.telegram)}</b></span></a>
          <a class="contact" href="mailto:${esc(S.email)}"><span class="contact-icon">✉️</span><span><small>Почта</small><b>${esc(S.email)}</b></span></a>
          <a class="contact" href="${esc(phoneHref)}"><span class="contact-icon">📞</span><span><small>Телефон</small><b>${esc(S.phone)}</b></span></a>
          <a class="contact" href="${esc(S.github)}" target="_blank" rel="noopener"><span class="contact-icon">🐙</span><span><small>GitHub</small><b>${esc(String(S.github).replace('https://', ''))}</b></span></a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Сервис попутчиков · сделал ${esc(S.name)}</span>
        <span>Делите дорогу — делите расходы 🚙</span>
      </div>
    </footer>`;

  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);

  document.getElementById('burger').addEventListener('click', function () {
    document.getElementById('site-header').classList.toggle('open');
  });

  /* ── блок авторизации в шапке ── */
  window.refreshNav = async function () {
    const box = document.getElementById('auth-box');
    const user = await getCurrentUser();
    if (user) {
      box.innerHTML =
        '<a class="user-chip" href="profile.html" style="text-decoration:none;color:inherit">' + avatar(user.name, user.id) +
        '<span>' + esc(user.name) + '</span></a>' +
        '<button class="btn btn-secondary btn-small" id="logout-btn" type="button">Выйти</button>';
      document.getElementById('logout-btn').addEventListener('click', async function () {
        await Api.post('/logout');
        location.href = 'index.html';
      });
    } else {
      box.innerHTML =
        '<a class="btn btn-secondary btn-small" href="login.html">Войти</a>' +
        '<a class="btn btn-small" href="register.html">Регистрация</a>';
    }
  };
  window.refreshNav();
})();
