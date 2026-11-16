// Каталог автомобилей. Прямые ссылки на фотографии Wikimedia Commons.
// У изображений открытая лицензия; подписи ведут на страницы авторов/лицензий.
(function () {
  var PHOTO_KIA = 'https://commons.wikimedia.org/wiki/Special:FilePath/2017_Kia_Rio_(YB)_S_5-door_hatchback_(2017-07-15)_02.jpg?width=1000';
  var PHOTO_LADA = 'https://commons.wikimedia.org/wiki/Special:FilePath/2025_Lada_Vesta_white_front.jpg?width=1000';

  var CLASSES = [
    { title: 'Эконом', text: 'Популярные и неприхотливые автомобили для повседневных поездок.',
      cars: [
        ['LADA Granta', PHOTO_LADA], ['LADA Vesta', PHOTO_LADA],
        ['Kia Rio', PHOTO_KIA], ['Hyundai Solaris', PHOTO_KIA],
        ['Volkswagen Polo', PHOTO_KIA], ['Renault Logan', PHOTO_LADA]
      ] },
    { title: 'Комфорт', text: 'Просторные седаны и лифтбеки для поездок между городами.',
      cars: [
        ['Skoda Rapid', PHOTO_KIA], ['Skoda Octavia', PHOTO_KIA],
        ['Toyota Corolla', PHOTO_KIA], ['Kia Cerato', PHOTO_KIA],
        ['Hyundai Elantra', PHOTO_KIA]
      ] },
    { title: 'Бизнес', text: 'Автомобили с просторным салоном для более комфортных маршрутов.',
      cars: [
        ['Toyota Camry', PHOTO_LADA], ['Kia K5', PHOTO_KIA],
        ['Skoda Superb', PHOTO_LADA], ['Mercedes-Benz E-Class', PHOTO_LADA]
      ] },
    { title: 'Кроссоверы', text: 'Больше пространства для пассажиров и багажа.',
      cars: [
        ['Haval Jolion', PHOTO_LADA], ['Geely Coolray', PHOTO_LADA],
        ['Chery Tiggo 7', PHOTO_LADA], ['Kia Sportage', PHOTO_KIA],
        ['Hyundai Tucson', PHOTO_KIA]
      ] }
  ];

  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = CLASSES.map(function (group, i) {
      return '<section class="fleet-class taxi-fleet-class"><h3>' + group.title + '</h3><p class="muted">' + group.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + i + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + i + '">' + group.cars.map(function (car) {
          return '<figure class="fleet-car taxi-fleet-car"><div class="taxi-car-photo"><img src="' + car[1] +
            '" alt="' + car[0] + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'photo-missing\')"></div><figcaption><span>' +
            car[0] + '</span><small>Иллюстративное фото · Wikimedia Commons</small></figcaption></figure>';
        }).join('') + '</div><button type="button" class="round-arrow" data-dir="1" data-row="' + i + '" aria-label="Вперёд">&#8594;</button></div></section>';
    }).join('');
    el.addEventListener('click', function (event) {
      var button = event.target.closest('.round-arrow');
      if (!button) return;
      var row = document.getElementById('fleet-' + button.getAttribute('data-row'));
      if (row) row.scrollBy({ left: Number(button.getAttribute('data-dir')) * row.clientWidth * .7, behavior: 'smooth' });
    });
  };
})();
