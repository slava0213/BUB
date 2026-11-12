// client/js/cars.js — рисованные машины и блок «Автомобили водителей»
(function () {
  // тип кузова → контур, окна, колёса
  var BODY = {
    sedan: { body: 'M8 40q-2-10 8-14l22-6 14-12q6-5 14-5h22q10 0 16 7l12 11 18 4q8 3 8 14v8q0 4-4 4H12q-4 0-4-4z',
             win: 'M52 20l10-9h26v14H46zM96 11h8q6 0 10 6l8 8H96z', w1: 36, w2: 118 },
    hatch: { body: 'M8 42q-2-12 8-16l18-5 14-13q5-4 12-4h30q8 0 13 6l10 12 8 2q8 3 8 14v6q0 4-4 4H12q-4 0-4-4z',
             win: 'M52 20l9-8h30v14H46zM95 12h6q5 0 8 5l5 9H95z', w1: 36, w2: 116 },
    suv:   { body: 'M8 40q-2-14 8-17l12-3 12-12q4-5 12-5h56q10 0 14 7l8 10 14 4q8 3 8 14v10q0 4-4 4H12q-4 0-4-4z',
             win: 'M52 18l8-8h30v14H46zM94 10h12q6 0 9 5l6 9H94z', w1: 38, w2: 122 },
    van:   { body: 'M6 46V28q0-10 10-12l22-4q8-1 14-9h68q10 0 12 10l10 32q0 4-4 4H10q-4 0-4-4z',
             win: 'M44 20q6-6 14-6h22v14H40zM88 14h26l6 14H88z', w1: 34, w2: 120 }
  };

  window.carSVG = function (type, color) {
    var b = BODY[type] || BODY.sedan;
    return '<svg viewBox="0 0 160 70" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' +
      '<ellipse cx="80" cy="62" rx="68" ry="4" fill="#000" opacity=".12"/>' +
      '<path d="' + b.body + '" fill="' + color + '" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>' +
      '<path d="' + b.win + '" fill="#dfeaf3" stroke="rgba(0,0,0,.3)" stroke-width="1.2"/>' +
      '<circle cx="' + b.w1 + '" cy="50" r="10" fill="#2b2b2b"/><circle cx="' + b.w1 + '" cy="50" r="4.5" fill="#c4c9cf"/>' +
      '<circle cx="' + b.w2 + '" cy="50" r="10" fill="#2b2b2b"/><circle cx="' + b.w2 + '" cy="50" r="4.5" fill="#c4c9cf"/>' +
    '</svg>';
  };

  var CLASSES = [
    { title: 'Экономный класс', text: 'Небольшие автомобили (B-сегмент): самый выгодный вариант для коротких поездок между городами.',
      cars: [['Chevrolet Aveo','hatch','#9aa3ad'], ['Hyundai Solaris','sedan','#7a8896'], ['Kia Rio','sedan','#c0392b'], ['Lada Granta','sedan','#e9e9ec'], ['Renault Logan','sedan','#34495e']] },
    { title: 'Комфортный класс', text: 'Автомобили C-сегмента: больше места для ног и багажа, спокойная езда на дальние расстояния.',
      cars: [['Skoda Octavia','hatch','#2f4858'], ['Mazda 3','sedan','#a93226'], ['Ford Focus','hatch','#8e99a4'], ['Toyota Corolla','sedan','#d5d8dc'], ['VW Jetta','sedan','#4a5560']] },
    { title: 'Бизнес класс', text: 'Автомобили D-сегмента: просторный салон и плавный ход для тех, кто едет далеко.',
      cars: [['Toyota Camry','sedan','#1f2a36'], ['Skoda Superb','sedan','#7f8c8d'], ['Kia Optima','sedan','#b03a2e'], ['Mazda 6','sedan','#566573'], ['Ford Mondeo','sedan','#e5e7e9']] },
    { title: 'Минивэны и кроссоверы', text: 'Для компаний и поездок с багажом: от четырёх до семи мест.',
      cars: [['Dodge Caravan','van','#8a9199'], ['Opel Zafira','van','#2e4053'], ['VW Multivan','van','#c9ccd1'], ['Kia Sportage','suv','#6c7a89'], ['Hyundai Creta','suv','#a04000']] }
  ];

  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = CLASSES.map(function (c, i) {
      return '<div class="fleet-class">' +
        '<h3>' + c.title + '</h3><p class="muted">' + c.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + i + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + i + '">' + c.cars.map(function (car) {
          return '<figure class="fleet-car">' + window.carSVG(car[1], car[2]) + '<figcaption>' + car[0] + '</figcaption></figure>';
        }).join('') + '</div>' +
        '<button type="button" class="round-arrow" data-dir="1" data-row="' + i + '" aria-label="Вперёд">&#8594;</button></div>' +
      '</div>';
    }).join('');

    el.addEventListener('click', function (e) {
      var b = e.target.closest('.round-arrow'); if (!b) return;
      var row = document.getElementById('fleet-' + b.getAttribute('data-row'));
      row.scrollBy({ left: Number(b.getAttribute('data-dir')) * row.clientWidth * 0.7, behavior: 'smooth' });
    });
  };
})();
