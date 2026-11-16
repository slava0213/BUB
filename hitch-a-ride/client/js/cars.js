// client/js/cars.js — реальные фотографии автомобилей и блок автопарка
(function () {
  var CLASSES = [
    { title: 'Экономный класс', text: 'Компактные и экономичные автомобили для доступных поездок между городами.',
      cars: [
        ['Hyundai Solaris','https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=720&q=85'],
        ['Kia Rio','https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=720&q=85'],
        ['Volkswagen Polo','https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=720&q=85'],
        ['Renault Logan','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=720&q=85']
      ] },
    { title: 'Комфортный класс', text: 'Просторный салон и удобная посадка для поездок на средние и дальние расстояния.',
      cars: [
        ['Skoda Octavia','https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=720&q=85'],
        ['Mazda 3','https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=720&q=85'],
        ['Toyota Corolla','https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=720&q=85'],
        ['Ford Focus','https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=720&q=85']
      ] },
    { title: 'Бизнес-класс', text: 'Более высокий уровень комфорта и плавности хода для длительных маршрутов.',
      cars: [
        ['Toyota Camry','https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=720&q=85'],
        ['Skoda Superb','https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=720&q=85'],
        ['Kia K5','https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&w=720&q=85']
      ] },
    { title: 'Кроссоверы и минивэны', text: 'Больше места для пассажиров и багажа — удобно для семей и компаний.',
      cars: [
        ['Kia Sportage','https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=720&q=85'],
        ['Hyundai Tucson','https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=720&q=85'],
        ['Volkswagen Multivan','https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=720&q=85']
      ] }
  ];
  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = CLASSES.map(function (group, i) {
      return '<div class="fleet-class"><h3>' + group.title + '</h3><p class="muted">' + group.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + i + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + i + '">' + group.cars.map(function (car) {
          return '<figure class="fleet-car"><img src="' + car[1] + '" alt="Автомобиль ' + car[0] + '" loading="lazy"><figcaption>' + car[0] + '</figcaption></figure>';
        }).join('') + '</div><button type="button" class="round-arrow" data-dir="1" data-row="' + i + '" aria-label="Вперёд">&#8594;</button></div></div>';
    }).join('');
    el.addEventListener('click', function (event) {
      var button = event.target.closest('.round-arrow');
      if (!button) return;
      var row = document.getElementById('fleet-' + button.getAttribute('data-row'));
      if (row) row.scrollBy({ left: Number(button.getAttribute('data-dir')) * row.clientWidth * .7, behavior: 'smooth' });
    });
  };
})();
