// Автопарк BUB: прямые файлы Wikimedia Commons для моделей и поиск конкретного фото,
// если для модели не закреплён отдельный файл. Заглушки не используются.
(function () {
  var GROUPS = [{"title":"Эконом","text":"Популярные и неприхотливые автомобили для повседневных поездок.","cars":[["LADA Granta","Lada Granta1.jpg"],["LADA Vesta","2015 Lada Vesta GFL120 grey front.jpg"],["Kia Rio","Moscow, Kia Rio white, Sept 2025 01.jpg"],["Hyundai Solaris","2021 Hyundai Solaris white front.jpg"],["Volkswagen Polo","VW-Polo.jpg"],["Renault Logan","Renault Logan.jpg"]]},{"title":"Комфорт","text":"Просторные седаны и лифтбеки для поездок между городами.","cars":[["Skoda Rapid","ŠKODA Rapid.jpg"],["Skoda Octavia","Skoda-Octavia.jpg"],["Toyota Corolla","Toyota Corolla.jpg"],["Kia Cerato","Kia Cerato (II, Facelift) – f 10012026.jpg"],["Hyundai Elantra",null]]},{"title":"Бизнес","text":"Автомобили с просторным салоном для более комфортных маршрутов.","cars":[["Toyota Camry","2021 Toyota Camry GR Sport front.jpg"],["Kia K5","Kia K5.JPG"],["Skoda Superb","SkodaSuperb.jpg"],["Mercedes-Benz E-Class","Mercedes Benz E Class.jpg"]]},{"title":"Кроссоверы","text":"Больше пространства для пассажиров и багажа.","cars":[["Haval Jolion","Haval Jolion 001.jpg"],["Geely Coolray","Coolray Front.jpg"],["Chery Tiggo 7","2024 Chery Tiggo 7 front view.png"],["Kia Sportage","KIA-Sportage.jpg"],["Hyundai Tucson","Hyundai-Tucson.jpg"]]}];
  function directFileUrl(filename) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(filename) + '?width=1000';
  }
  function commonsSearchUrl(query) {
    return 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
      encodeURIComponent('filetype:bitmap ' + query + ' car') +
      '&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json&origin=*';
  }
  function bestImageUrl(data, make, model) {
    var pages = data && data.query && data.query.pages ? Object.keys(data.query.pages).map(function (id) { return data.query.pages[id]; }) : [];
    var terms = (make + ' ' + model).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
    var candidates = pages.filter(function (page) {
      var title = (page.title || '').toLowerCase();
      return terms.every(function (term) { return title.indexOf(term) !== -1; }) &&
        page.imageinfo && page.imageinfo[0] && page.imageinfo[0].thumburl;
    });
    return candidates.length ? candidates[0].imageinfo[0].thumburl : null;
  }
  function loadCarImage(img, car) {
    if (car[1]) {
      img.src = directFileUrl(car[1]);
      return;
    }
    fetch(commonsSearchUrl(car[2] + ' ' + car[3]))
      .then(function (r) { if (!r.ok) throw new Error('Commons search failed'); return r.json(); })
      .then(function (data) {
        var url = bestImageUrl(data, car[2], car[3]);
        if (url) img.src = url;
      })
      .catch(function (error) { console.warn('Не удалось найти фото ' + car[0], error); });
  }
  window.renderFleet = function (el) {
    if (!el) return;
    el.innerHTML = GROUPS.map(function (group, index) {
      return '<section class="fleet-class taxi-fleet-class"><h3>' + group.title + '</h3><p class="muted">' + group.text + '</p>' +
        '<div class="fleet-row"><button type="button" class="round-arrow" data-dir="-1" data-row="' + index + '" aria-label="Назад">&#8592;</button>' +
        '<div class="fleet-cars" id="fleet-' + index + '">' + group.cars.map(function (car) {
          return '<figure class="fleet-car taxi-fleet-car"><div class="taxi-car-photo"><img alt="' + car[0] +
            '" loading="lazy" referrerpolicy="no-referrer"></div><figcaption><span>' + car[0] +
            '</span><small><a href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=' +
            encodeURIComponent(car[0]) + '" target="_blank" rel="noopener noreferrer">Фото: Wikimedia Commons</a></small></figcaption></figure>';
        }).join('') + '</div><button type="button" class="round-arrow" data-dir="1" data-row="' + index + '" aria-label="Вперёд">&#8594;</button></div></section>';
    }).join('');
    el.querySelectorAll('.taxi-fleet-car img').forEach(function (img) {
      var title = img.alt;
      var car;
      GROUPS.some(function (group) {
        return group.cars.some(function (item) {
          if (item[0] === title) { car = item; return true; }
          return false;
        });
      });
      if (car) loadCarImage(img, car);
    });
    el.addEventListener('click', function (event) {
      var button = event.target.closest('.round-arrow');
      if (!button) return;
      var row = document.getElementById('fleet-' + button.getAttribute('data-row'));
      if (row) row.scrollBy({ left: Number(button.getAttribute('data-dir')) * row.clientWidth * .7, behavior: 'smooth' });
    });
  };
})();
