const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Если JWT_SECRET не задан — генерируем случайный (сессии сбросятся при перезапуске).
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  JWT_SECRET не задан. Использую временный ключ — после перезапуска все выйдут из аккаунтов.');
}

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Токен недействителен' });
  }
}

module.exports = { sign, auth };
