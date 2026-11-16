// Автопарк BUB: прямые ссылки на конкретные фотографии Wikimedia Commons.
// Каждая карточка использует отдельный файл своей модели. Ссылка на источник открывает страницу файла.
(function () {
  var GROUPS = [{"title":"Эконом","text":"Популярные и неприхотливые автомобили для повседневных поездок.","cars":[{"title":"LADA Granta","file":"2024 Lada Granta sedan white front.jpg"},{"title":"LADA Vesta","file":"LADA Vesta.jpg"},{"title":"Kia Rio","file":"Kia Rio.JPG"},{"title":"Hyundai Solaris","file":"2021 Hyundai Solaris white front.jpg"},{"title":"Volkswagen Polo","file":"Volkswagen Polo Sedan.JPG"},{"title":"Renault Logan","file":"Renault Logan.jpg"}]},{"title":"Комфорт","text":"Просторные седаны и лифтбеки для поездок между городами.","cars":[{"title":"Skoda Rapid","file":"ŠKODA Rapid.jpg"},{"title":"Skoda Octavia","file":"Skoda-Octavia.jpg"},{"title":"Toyota Corolla","file":"Toyota Corolla.jpg"},{"title":"Kia Cerato","file":"00 KIA CERATO 1.jpg"},{"title":"Hyundai Elantra","file":"Hyundai Elantra VII 001.jpg"}]},{"title":"Бизнес","text":"Автомобили с просторным салоном для более комфортных маршрутов.","cars":[{"title":"Toyota Camry","file":"ToyotaCamry.png"},{"title":"Kia K5","file":"Kia K5.JPG"},{"title":"Skoda Superb","file":"SkodaSuperb.jpg"},{"title":"Mercedes-Benz E-Class","file":"Mercedes Benz E Class.jpg"}]},{"title":"Кроссоверы","text":"Больше пространства для пассажиров и багажа.","cars":[{"title":"Haval Jolion","file":"2020 Great Wall Haval Jolion (front).jpg"},{"title":"Geely Coolray","file":"Coolray Front.jpg"},{"title":"Chery Tiggo 7","file":"2024 Chery Tiggo 7 front view.png"},{"title":"Kia Sportage","file":"KIA-Sportage.jpg"},{"title":"Hyundai Tucson","file":"Hyundai-Tucson(1).jpg"}]}];
  function fileUrl(name) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name) + '?width=1000';
  }
  function sourceUrl(name) {
    return 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(name.replace(/ /g, '_'));
  }
  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = GROUPS.map(function (group, index) {
      return '<section class="fleet-class taxi-fleet-class"><h3>' + group.title + '</h3><p class="muted">' + group.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + index + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + index + '">' + group.cars.map(function (car) {
          var src = fileUrl(car.file);
          return '<figure class="fleet-car taxi-fleet-car"><div class="taxi-car-photo">' +
            '<img src="' + src + '" alt="' + car.title + '" loading="lazy" referrerpolicy="no-referrer" ' +
            'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'photo-missing\')">' +
            '</div><figcaption><span>' + car.title + '</span><small><a href="' + sourceUrl(car.file) +
            '" target="_blank" rel="noopener noreferrer">Фото: Wikimedia Commons</a></small></figcaption></figure>';
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
