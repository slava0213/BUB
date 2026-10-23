// client/js/auth.js
let _mePromise = null;

function getCurrentUser(force) {
  if (!_mePromise || force) {
    _mePromise = Api.get('/me').catch(function () { return null; });
  }
  return _mePromise;
}
