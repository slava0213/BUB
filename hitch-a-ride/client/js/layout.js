// client/js/layout.js — шапка, бегущая строка и подвал для всех страниц
(function () {
  const S = window.SITE || {};
  const page = document.body.getAttribute('data-page') || '';

  // Пять страниц по требованиям: поездки, создать поездку, поиск, чат, профиль
  const ICONS = {
    home:    '<path d="M3 15l2-6a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 6v4h-3v-2H6v2H3z"/><circle cx="7.5" cy="14" r="1"/><circle cx="16.5" cy="14" r="1"/>',
    create:  '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    search:  '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    chat:    '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>'
  };
  const links = [
    ['home',    'index.html',        'Поездки'],
    ['create',  'create-trip.html',  'Создать поездку'],
    ['search',  'search.html',       'Поиск'],
    ['chat',    'chat.html',         'Чат'],
    ['profile', 'profile.html',      'Профиль']
  ];
  // страницы, где показываем левую колонку
  const WITH_SIDEBAR = ['home', 'create', 'search', 'profile'];

  const tgUrl = 'https://t.me/' + String(S.telegram || '').replace(/^@/, '');
  const phoneHref = 'tel:' + String(S.phone || '').replace(/[^+\d]/g, '');

  /* ── бегущая строка ── */
  const items = [
    'Проект сделал <b>' + esc(S.name) + '</b>',
    'Telegram: <a href="' + esc(tgUrl) + '" target="_blank" rel="noopener">' + esc(S.telegram) + '</a>',
    'Почта: <a href="mailto:' + esc(S.email) + '">' + esc(S.email) + '</a>',
    'Телефон: <a href="' + esc(phoneHref) + '">' + esc(S.phone) + '</a>',
    'GitHub: <a href="' + esc(S.github) + '" target="_blank" rel="noopener">' + esc(String(S.github).replace('https://', '')) + '</a>',
    'Едем вместе — дешевле и веселее!'
  ];
  const group = items.map(function (i) { return '<span class="marquee-item">' + i + '</span>'; }).join('');
  // Дублируем содержимое — цикл бесшовный (анимация сдвигает на -50%)
  const track = group + group + group + group;

  const header = `
    <div class="marquee" aria-label="Контакты автора"><div class="marquee-track">${track}</div></div>
    <header class="site-header" id="site-header">
      <div class="top-strip">
        <a class="brand" href="index.html"><img src="images/favicon.svg" alt="" /><span>Попутчики<small>сервис поиска попутчиков</small></span></a>
        <div class="auth-box" id="auth-box"></div>
      </div>
      <div class="banner-img" role="img" aria-label="Город и такси"></div>
      <nav class="round-nav" aria-label="Основное меню">
        ${links.map(function (l) {
          return '<a href="' + l[1] + '"' + (l[0] === page ? ' class="active" aria-current="page"' : '') + '>' +
            '<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[l[0]] + '</svg></span>' +
            '<span class="lbl">' + l[2] + '</span></a>';
        }).join('')}
      </nav>
    </header>`;

  /* ── подвал с контактами ── */
  const footer = `
    <footer class="site-footer">
      <nav class="footer-nav" aria-label="Нижнее меню">
        ${links.map(function (l) { return '<a href="' + l[1] + '"' + (l[0] === page ? ' class="active"' : '') + '>' + l[2] + '</a>'; }).join('')}
      </nav>
      <div class="footer-inner">
        <div class="footer-about">
          <h3>Свяжитесь со мной </h3>
          <p>Меня зовут <b>${esc(S.name)}</b> — ${esc(S.role)}. Пишите по любым вопросам: идеи, баги, сотрудничество.</p>
        </div>
        <div class="contacts">
          <a class="contact" href="${esc(tgUrl)}" target="_blank" rel="noopener"><span class="contact-icon"></span><span><small>Telegram</small><b>${esc(S.telegram)}</b></span></a>
          <a class="contact" href="mailto:${esc(S.email)}"><span class="contact-icon"></span><span><small>Почта</small><b>${esc(S.email)}</b></span></a>
          <a class="contact" href="${esc(phoneHref)}"><span class="contact-icon"></span><span><small>Телефон</small><b>${esc(S.phone)}</b></span></a>
          <a class="contact" href="${esc(S.github)}" target="_blank" rel="noopener"><span class="contact-icon"></span><span><small>GitHub</small><b>${esc(String(S.github).replace('https://', ''))}</b></span></a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Сервис попутчиков · сделал ${esc(S.name)}</span>
        <span>Делите дорогу — делите расходы </span>
      </div>
    </footer>`;

  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);

  /* ── левая колонка: быстрый поиск и популярные направления ── */
  const main = document.querySelector('main');
  if (main && WITH_SIDEBAR.indexOf(page) !== -1) {
    const routes = [
      ['Москва', 'Санкт-Петербург'], ['Москва', 'Казань'], ['Краснодар', 'Сочи'],
      ['Екатеринбург', 'Челябинск'], ['Новосибирск', 'Томск'], ['Самара', 'Уфа']
    ];
    const aside = document.createElement('aside');
    aside.className = 'side';
    aside.innerHTML = `
      <section class="side-card" aria-labelledby="side-q">
        <h2 id="side-q">Найти попутчика</h2>
        <div class="side-inner">
          <p class="side-hint">Укажите маршрут и дату — покажем подходящие поездки водителей.</p>
          <form action="search.html" method="get" class="side-form">
            <label for="sq-from">Откуда</label><input id="sq-from" name="from" placeholder="Москва" />
            <label for="sq-to">Куда</label><input id="sq-to" name="to" placeholder="Казань" />
            <label for="sq-date">Дата</label><input id="sq-date" name="date" type="date" />
            <button type="submit" class="btn btn-block">Найти поездку</button>
            <a class="btn btn-secondary btn-block" href="create-trip.html">Предложить свою</a>
          </form>
        </div>
      </section>
      <section class="side-card" aria-labelledby="side-r">
        <h2 id="side-r">Популярные направления</h2>
        <div class="side-inner">
          <svg class="side-map" viewBox="0 0 220 150" aria-hidden="true">
            <path d="M18 70l24-30 40-12 38 6 44-14 30 22-6 36-30 28-44 8-36-14-30 6z" fill="#fff" stroke="#c9a100" stroke-width="2"/>
            <path d="M42 40l40 40-24 34zM82 28l30 26-30 26zM120 34l36 14-20 38zM156 20l30 22-30 6zM60 114l52-14 30 28zM186 42l8 40-38 4z" fill="#ffe36b" stroke="#c9a100" stroke-width="1"/>
            <path d="M70 62Q110 40 150 66M70 62Q96 96 138 100" fill="none" stroke="#2b2b2b" stroke-width="2" stroke-dasharray="5 4"/>
            <circle cx="70" cy="62" r="5" fill="#2b2b2b"/><circle cx="150" cy="66" r="5" fill="#2b2b2b"/><circle cx="138" cy="100" r="5" fill="#2b2b2b"/>
          </svg>
          <ul class="side-routes">
            ${routes.map(function (r) {
              return '<li><a href="search.html?from=' + encodeURIComponent(r[0]) + '&to=' + encodeURIComponent(r[1]) + '">' + r[0] + ' <span>→</span> ' + r[1] + '</a></li>';
            }).join('')}
          </ul>
        </div>
      </section>
      <section class="side-card side-note">
        <h2>Как это устроено</h2>
        <div class="side-inner">
          <ol class="side-steps">
            <li>Найдите поездку или создайте свою</li>
            <li>Отправьте заявку водителю</li>
            <li>Обсудите детали в чате</li>
            <li>Следите за водителем на карте</li>
            <li>Оставьте отзыв после поездки</li>
          </ol>
        </div>
      </section>`;

    if (page === 'search') aside.querySelector('.side-card').remove();

    const shell = document.createElement('div');
    shell.className = 'shell';
    const content = document.createElement('div');
    content.className = 'content';
    while (main.firstChild) content.appendChild(main.firstChild);
    shell.appendChild(aside);
    shell.appendChild(content);
    main.appendChild(shell);

    const sd = document.getElementById('sq-date');
    if (sd) {
    sd.min = new Date().toISOString().slice(0, 10);
    // на странице поиска подставляем уже выбранный маршрут
    const q = new URLSearchParams(location.search);
    document.getElementById('sq-from').value = q.get('from') || '';
    document.getElementById('sq-to').value = q.get('to') || '';
    sd.value = q.get('date') || '';
    }
  } else if (main) {
    main.classList.add('wide');
  }

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
