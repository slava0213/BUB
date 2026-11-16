// Каталог BUB. Для найденных фотографий используем конкретные файлы Commons;
// для моделей без подтверждённого файла — CarAPI (Wikimedia Commons) по марке/модели.
(function () {
  var GROUPS = [{"title":"Эконом","text":"Популярные и неприхотливые автомобили для повседневных поездок.","cars":[["LADA Granta","commons","Lada Granta сзади.jpg"],["LADA Vesta","commons","Lada Vesta.jpg"],["Kia Rio","commons","Moscow, Kia Rio white, Sept 2025 01.jpg"],["Hyundai Solaris","api","Hyundai","Solaris"],["Volkswagen Polo","api","Volkswagen","Polo"],["Renault Logan","commons","Renault Logan.JPG"]]},{"title":"Комфорт","text":"Просторные седаны и лифтбеки для поездок между городами.","cars":[["Skoda Rapid","commons","ŠKODA Rapid.jpg"],["Skoda Octavia","commons","Skoda-Octavia.jpg"],["Toyota Corolla","commons","Toyota Corolla.jpg"],["Kia Cerato","api","Kia","Cerato"],["Hyundai Elantra","commons","Hyundai Elantra.JPG"]]},{"title":"Бизнес","text":"Автомобили с просторным салоном для более комфортных маршрутов.","cars":[["Toyota Camry","commons","Toyota Camry 001.jpg"],["Kia K5","commons","Kia K5.JPG"],["Skoda Superb","commons","Škoda Superb.jpg"],["Mercedes-Benz E-Class","api","Mercedes-Benz","E-Class"]]},{"title":"Кроссоверы","text":"Больше пространства для пассажиров и багажа.","cars":[["Haval Jolion","commons","Haval Jolion 001.jpg"],["Geely Coolray","commons","Coolray Front.jpg"],["Chery Tiggo 7","commons","2024 Chery Tiggo 7 front view.png"],["Kia Sportage","api","Kia","Sportage"],["Hyundai Tucson","api","Hyundai","Tucson"]]}];
  function imageUrl(car) {
    if (car[1] === 'commons') {
      return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent('File:' + car[2]) + '?width=1000';
    }
    return 'https://carapi.trustcar.info/getImage?make=' + encodeURIComponent(car[2]) + '&model=' + encodeURIComponent(car[3]);
  }
  function sourceUrl(car) {
    return car[1] === 'commons'
      ? 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(car[2].replace(/ /g, '_'))
      : 'https://carapi.trustcar.info/';
  }
  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = GROUPS.map(function (group, index) {
      return '<section class="fleet-class taxi-fleet-class"><h3>' + group.title + '</h3><p class="muted">' + group.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + index + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + index + '">' + group.cars.map(function (car) {
          return '<figure class="fleet-car taxi-fleet-car"><div class="taxi-car-photo"><img src="' + imageUrl(car) +
            '" alt="' + car[0] + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'photo-missing\')">' +
            '</div><figcaption><span>' + car[0] + '</span><small><a href="' + sourceUrl(car) +
            '" target="_blank" rel="noopener noreferrer">' + (car[1] === 'commons' ? 'Фото и лицензия: Wikimedia Commons' : 'Источник фотографии: CarAPI / Wikimedia Commons') +
            '</a></small></figcaption></figure>';
        }).join('') + '</div><button type="button" class="round-arrow" data-dir="1" data-row="' + index + '" aria-label="Вперёд">&#8594;</button></div></section>';
    }).join('');
    el.addEventListener('click', function (event) {
      var button = event.target.closest('.round-arrow');
      if (!button) return;
      var row = document.getElementById('fleet-' + button.getAttribute('data-row'));
      if (row) row.scrollBy({ left: Number(button.getAttribute('data-dir')) * row.clientWidth * .7, behavior: 'smooth' });
    });
  };
})();
