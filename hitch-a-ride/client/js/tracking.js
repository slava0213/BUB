(function () {
  const params = new URLSearchParams(location.search);
  const tripId = Number(params.get('trip'));
  const $ = id => document.getElementById(id);
  let map, driverMarker, destinationMarker, routeLine, watchId = null, sendTimer = null;
  let lastPoint = null, isDriver = false, destination = null, routeRequestAt = 0;

  function alertBox(message, type) {
    const el = $('tracking-alert'); el.textContent = message; el.className = 'tracking-alert ' + (type || '');
  }
  function formatClock(date) { return date.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}); }
  function initMap() {
    map = L.map('trip-map', { zoomControl: true }).setView([55.751244, 37.618423], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  }
  function carIcon() {
    return L.divIcon({ className:'car-marker-wrap', html:'<div class="car-marker">🚗</div>', iconSize:[42,42], iconAnchor:[21,21] });
  }
  async function geocode(city) {
    const response = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(city));
    if (!response.ok) throw new Error('Не удалось определить точку назначения');
    const data = await response.json();
    if (!data.length) throw new Error('Не удалось найти город назначения на карте');
    return [Number(data[0].lat), Number(data[0].lon)];
  }
  async function drawRoute(point) {
    if (!destination || !point) return;
    if (Date.now() - routeRequestAt < 12000 && routeLine) return;
    routeRequestAt = Date.now();
    try {
      const url = 'https://router.project-osrm.org/route/v1/driving/' +
        point.lng + ',' + point.lat + ';' + destination[1] + ',' + destination[0] +
        '?overview=full&geometries=geojson&steps=false';
      const response = await fetch(url);
      const data = await response.json();
      if (!data.routes || !data.routes.length) throw new Error('Маршрут не найден');
      const r = data.routes[0], coords = r.geometry.coordinates.map(c => [c[1],c[0]]);
      if (routeLine) routeLine.setLatLngs(coords);
      else routeLine = L.polyline(coords, {color:'#315b91',weight:5,opacity:.88,lineCap:'round'}).addTo(map);
      $('eta-value').textContent = Math.max(1,Math.round(r.duration/60)) + ' мин';
      $('eta-caption').textContent = 'Примерно в ' + formatClock(new Date(Date.now()+r.duration*1000));
      $('distance-value').textContent = (r.distance/1000).toFixed(1).replace('.',',') + ' км';
    } catch (e) {
      $('eta-value').textContent = '—';
      $('eta-caption').textContent = 'Не удалось рассчитать маршрут';
      $('distance-value').textContent = '—';
    }
  }
  function showPoint(point) {
    lastPoint = point;
    const ll = [point.lat,point.lng];
    if (!driverMarker) driverMarker = L.marker(ll,{icon:carIcon()}).addTo(map).bindPopup('Текущее положение водителя');
    else driverMarker.setLatLng(ll);
    if (!destinationMarker && destination) destinationMarker = L.marker(destination).addTo(map).bindPopup('Точка прибытия');
    if (destination) map.fitBounds(L.latLngBounds([ll,destination]).pad(.18),{maxZoom:13});
    else map.setView(ll,14);
    drawRoute(point);
    const age = Math.max(0,Math.round((Date.now()-point.updatedAt)/1000));
    $('map-updated').textContent = 'GPS: ' + (age < 60 ? age + ' сек. назад' : Math.floor(age/60) + ' мин. назад');
    $('freshness-value').textContent = age < 60 ? 'Только что' : Math.floor(age/60) + ' мин. назад';
    alertBox(age > 90 ? 'Последняя геопозиция устарела. Ожидаем новое обновление от водителя.' : 'Геопозиция получена. Автомобиль отображается на карте.', age > 90 ? 'warning' : 'success');
  }
  async function refresh() {
    try {
      const data = await Api.get('/trips/' + tripId + '/location');
      isDriver = data.isDriver;
      $('from-city').textContent = data.trip.from_city;
      $('to-city').textContent = data.trip.to_city;
      if (isDriver) $('driver-controls').hidden = false;
      if (!destination) {
        try { destination = await geocode(data.trip.to_city); }
        catch(e) { $('eta-caption').textContent = 'Для маршрута не удалось определить город назначения'; }
      }
      if (data.location) showPoint(data.location);
      else if (!isDriver) alertBox('Водитель пока не включил передачу геолокации. Координаты появятся здесь, когда он начнёт поездку.', 'warning');
      else alertBox('Включите передачу GPS, чтобы пассажиры могли видеть ваше положение.', 'warning');
    } catch (e) { alertBox(e.message + (e.status === 403 ? '. Доступ появится после подтверждения заявки.' : ''), 'error'); }
  }
  async function sendPosition(position) {
    const c = position.coords;
    try {
      const data = {lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,heading:c.heading,speed:c.speed};
      await Api.post('/trips/' + tripId + '/location',data);
      const point = Object.assign(data,{updatedAt:Date.now()});
      showPoint(point);
      $('gps-status').textContent = 'GPS передаётся · точность около ' + Math.round(c.accuracy) + ' м';
      $('gps-status').className = 'gps-status active';
    } catch(e) { $('gps-status').textContent = e.message; }
  }
  function startSharing() {
    if (!navigator.geolocation) { toast('Браузер не поддерживает геолокацию','error'); return; }
    if (!window.isSecureContext) { toast('Для GPS откройте сайт через HTTPS или localhost','error'); return; }
    $('start-sharing').disabled = true;
    $('gps-status').textContent = 'Запрашиваем разрешение на GPS…';
    watchId = navigator.geolocation.watchPosition(function(pos) {
      sendPosition(pos);
      if (!sendTimer) sendTimer = setInterval(function() {
        if (lastPoint) Api.post('/trips/' + tripId + '/location',lastPoint).catch(()=>{});
      },10000);
    },function(err) {
      $('start-sharing').disabled = false;
      $('gps-status').textContent = err.code === 1 ? 'Доступ к геолокации запрещён в настройках браузера' : 'Не удалось получить GPS: ' + err.message;
    },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
    $('stop-sharing').hidden = false;
  }
  async function stopSharing() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (sendTimer) clearInterval(sendTimer);
    watchId = null; sendTimer = null;
    try { await Api.request('DELETE','/trips/' + tripId + '/location'); } catch(e) {}
    $('start-sharing').disabled = false; $('stop-sharing').hidden = true;
    $('gps-status').textContent = 'Передача остановлена'; $('gps-status').className = 'gps-status';
  }
  $('start-sharing').addEventListener('click',startSharing);
  $('stop-sharing').addEventListener('click',stopSharing);
  if (!tripId) { alertBox('Не указана поездка. Откройте отслеживание из карточки нужного маршрута.','error'); return; }
  initMap();
  refresh();
  setInterval(refresh,10000);
  window.addEventListener('beforeunload',function(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);if(sendTimer)clearInterval(sendTimer);});
})();