// Каталог BUB: отдельный запрос фотографии для каждой из 20 моделей.
// CarAPI отдаёт реальные фотографии из Wikimedia Commons и поддерживает JSON-атрибуцию.
(function () {
  var GROUPS = [{"title":"Эконом","text":"Популярные и неприхотливые автомобили для повседневных поездок.","cars":[["LADA Granta","Lada","Granta"],["LADA Vesta","Lada","Vesta"],["Kia Rio","Kia","Rio"],["Hyundai Solaris","Hyundai","Solaris"],["Volkswagen Polo","Volkswagen","Polo"],["Renault Logan","Renault","Logan"]]},{"title":"Комфорт","text":"Просторные седаны и лифтбеки для поездок между городами.","cars":[["Skoda Rapid","Skoda","Rapid"],["Skoda Octavia","Skoda","Octavia"],["Toyota Corolla","Toyota","Corolla"],["Kia Cerato","Kia","Cerato"],["Hyundai Elantra","Hyundai","Elantra"]]},{"title":"Бизнес","text":"Автомобили с просторным салоном для более комфортных маршрутов.","cars":[["Toyota Camry","Toyota","Camry"],["Kia K5","Kia","K5"],["Skoda Superb","Skoda","Superb"],["Mercedes-Benz E-Class","Mercedes-Benz","E-Class"]]},{"title":"Кроссоверы","text":"Больше пространства для пассажиров и багажа.","cars":[["Haval Jolion","Haval","Jolion"],["Geely Coolray","Geely","Coolray"],["Chery Tiggo 7","Chery","Tiggo 7"],["Kia Sportage","Kia","Sportage"],["Hyundai Tucson","Hyundai","Tucson"]]}];
  function imageUrl(car, json) {
    return 'https://carapi.trustcar.info/getImage?make=' + encodeURIComponent(car[1]) +
      '&model=' + encodeURIComponent(car[2]) + (json ? '&format=json' : '');
  }
  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = GROUPS.map(function (group, index) {
      return '<section class="fleet-class taxi-fleet-class"><h3>' + group.title + '</h3><p class="muted">' + group.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + index + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + index + '">' + group.cars.map(function (car, carIndex) {
          var key = 'fleet-photo-' + index + '-' + carIndex;
          return '<figure class="fleet-car taxi-fleet-car"><div class="taxi-car-photo">' +
            '<img id="' + key + '" src="' + imageUrl(car, false) + '" alt="' + car[0] +
            '" loading="lazy" referrerpolicy="no-referrer">' +
            '<span class="photo-fallback" hidden>Фотография временно недоступна</span>' +
            '</div><figcaption><span>' + car[0] + '</span><small class="photo-credit">Фото: Wikimedia Commons · <a href="' +
            imageUrl(car, true) + '" target="_blank" rel="noopener noreferrer">авторство и лицензия</a></small></figcaption></figure>';
        }).join('') + '</div><button type="button" class="round-arrow" data-dir="1" data-row="' + index + '" aria-label="Вперёд">&#8594;</button></div></section>';
    }).join('');

    el.querySelectorAll('.taxi-fleet-car').forEach(function (card) {
      var img = card.querySelector('img');
      var fallback = card.querySelector('.photo-fallback');
      var credit = card.querySelector('.photo-credit');
      img.addEventListener('load', function () { fallback.hidden = true; });
      img.addEventListener('error', function () {
        img.hidden = true;
        fallback.hidden = false;
      });
      var carName = card.querySelector('figcaption > span').textContent;
      var car;
      GROUPS.some(function (group) {
        return group.cars.some(function (item) {
          if (item[0] === carName) { car = item; return true; }
          return false;
        });
      });
      if (!car) return;
      fetch(imageUrl(car, true)).then(function (response) {
        if (!response.ok) throw new Error('Metadata unavailable');
        return response.json();
      }).then(function (data) {
        if (data && data.image_url) img.src = data.image_url;
        if (data && (data.attribution || data.author || data.license)) {
          credit.firstChild.textContent = (data.attribution || [data.author, data.license].filter(Boolean).join(' · ')) + ' · ';
        }
        if (data && data.found === false) {
          img.hidden = true;
          fallback.hidden = false;
          fallback.textContent = 'Фото этой модели не найдено в источнике';
        }
      }).catch(function () {
        // Основной прямой адрес изображения остаётся рабочим без JSON-метаданных.
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
