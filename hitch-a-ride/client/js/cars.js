// client/js/cars.js — фотографии реальных моделей из Wikimedia Commons через CarAPI
// CarAPI отдаёт фотографии Wikimedia Commons, кеширует их и предоставляет нейтральный
// placeholder, если для конкретной модели фотография не найдена.
(function () {
  function photo(make, model) {
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
          return '<figure class="fleet-car taxi-fleet-car"><div class="taxi-car-photo"><img src="' + photo(car[1], car[2]) +
            '" alt="' + car[0] + '" loading="lazy" referrerpolicy="no-referrer"></div><figcaption><span>' +
            car[0] + '</span><small>Пример автомобиля</small></figcaption></figure>';
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
