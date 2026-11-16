// Каталог автопарка: реальные фотографии по марке и модели.
// CarAPI получает фотографии из Wikimedia Commons и отдаёт атрибуцию/лицензию.
(function () {
  function imageUrl(make, model) {
    return 'https://carapi.trustcar.info/getImage?make=' + encodeURIComponent(make) +
      '&model=' + encodeURIComponent(model);
  }

  var CLASSES = [
    { title: 'Эконом', text: 'Популярные и неприхотливые автомобили для повседневных поездок.',
      cars: [
        ['LADA Granta', 'Lada', 'Granta'],
        ['LADA Vesta', 'Lada', 'Vesta'],
        ['Kia Rio', 'Kia', 'Rio'],
        ['Hyundai Solaris', 'Hyundai', 'Solaris'],
        ['Volkswagen Polo', 'Volkswagen', 'Polo'],
        ['Renault Logan', 'Renault', 'Logan']
      ] },
    { title: 'Комфорт', text: 'Просторные седаны и лифтбеки для поездок между городами.',
      cars: [
        ['Skoda Rapid', 'Skoda', 'Rapid'],
        ['Skoda Octavia', 'Skoda', 'Octavia'],
        ['Toyota Corolla', 'Toyota', 'Corolla'],
        ['Kia Cerato', 'Kia', 'Cerato'],
        ['Hyundai Elantra', 'Hyundai', 'Elantra']
      ] },
    { title: 'Бизнес', text: 'Автомобили с просторным салоном для более комфортных маршрутов.',
      cars: [
        ['Toyota Camry', 'Toyota', 'Camry'],
        ['Kia K5', 'Kia', 'K5'],
        ['Skoda Superb', 'Skoda', 'Superb'],
        ['Mercedes-Benz E-Class', 'Mercedes-Benz', 'E-Class']
      ] },
    { title: 'Кроссоверы', text: 'Больше пространства для пассажиров и багажа.',
      cars: [
        ['Haval Jolion', 'Haval', 'Jolion'],
        ['Geely Coolray', 'Geely', 'Coolray'],
        ['Chery Tiggo 7', 'Chery', 'Tiggo 7'],
        ['Kia Sportage', 'Kia', 'Sportage'],
        ['Hyundai Tucson', 'Hyundai', 'Tucson']
      ] }
  ];

  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = CLASSES.map(function (group, i) {
      return '<section class="fleet-class taxi-fleet-class"><h3>' + group.title + '</h3><p class="muted">' + group.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + i + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + i + '">' + group.cars.map(function (car) {
          var src = imageUrl(car[1], car[2]);
          return '<figure class="fleet-car taxi-fleet-car"><div class="taxi-car-photo"><img src="' + src +
            '" alt="' + car[0] + '" loading="lazy" referrerpolicy="no-referrer"><span class="photo-fallback" aria-hidden="true">Фото загружается…</span></div><figcaption><span>' +
            car[0] + '</span><small>Фото: Wikimedia Commons · открытая лицензия</small></figcaption></figure>';
        }).join('') + '</div><button type="button" class="round-arrow" data-dir="1" data-row="' + i + '" aria-label="Вперёд">&#8594;</button></div></section>';
    }).join('');

    // Подгружаем прямой CDN-адрес и точную атрибуцию, если API вернул метаданные.
    el.querySelectorAll('.taxi-fleet-car').forEach(function (card, index) {
      var group = CLASSES.find(function (g) {
        return g.cars.some(function (c) { return c[0] === card.querySelector('figcaption span').textContent; });
      });
      if (!group) return;
      var car = group.cars.find(function (c) { return c[0] === card.querySelector('figcaption span').textContent; });
      if (!car) return;
      var img = card.querySelector('img');
      var fallback = card.querySelector('.photo-fallback');
      var credit = card.querySelector('figcaption small');
      img.addEventListener('load', function () { fallback.style.display = 'none'; });
      img.addEventListener('error', function () {
        img.style.display = 'none';
        fallback.textContent = 'Фотография временно недоступна';
        fallback.classList.add('is-visible');
      });
      fetch(imageUrl(car[1], car[2]) + '&format=json')
        .then(function (response) {
          if (!response.ok) throw new Error('No photo metadata');
          return response.json();
        })
        .then(function (data) {
          if (data && data.found && data.image_url) {
            img.src = data.image_url;
            credit.textContent = data.attribution || [data.author, data.license].filter(Boolean).join(' · ') || 'Wikimedia Commons';
          } else {
            img.style.display = 'none';
            fallback.textContent = 'Фото этой модели пока не найдено';
            fallback.classList.add('is-visible');
            credit.textContent = 'Источник: Wikimedia Commons';
          }
        })
        .catch(function () {
          // Основной src уже указывает на endpoint с изображением; оставляем его.
        });
    });

    el.addEventListener('click', function (event) {
      var button = event.target.closest('.round-arrow');
      if (!button) return;
      var row = document.getElementById('fleet-' + button.getAttribute('data-row'));
      if (row) row.scrollBy({ left: Number(button.getAttribute('data-dir')) * row.clientWidth * .7, behavior: 'smooth' });
    });
  };
})();
