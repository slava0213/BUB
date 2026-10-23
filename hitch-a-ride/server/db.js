// server/db.js — мини-«SQL» поверх JSON-файла.
const fs   = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'carpool.json');
const TMP_FILE = DB_FILE + '.tmp';

const EMPTY_DB = { users: [], trips: [], requests: [], messages: [], reviews: [] };

let _db = null;

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      _db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error('⚠️ Ошибка чтения БД, создаю новую:', e.message);
      _db = clone(EMPTY_DB);
    }
  } else {
    _db = clone(EMPTY_DB);
  }
  Object.keys(EMPTY_DB).forEach(function (key) {
    if (!Array.isArray(_db[key])) _db[key] = [];
  });
}

// Атомарная запись: сначала во временный файл, потом переименование.
function saveDb() {
  fs.writeFileSync(TMP_FILE, JSON.stringify(_db, null, 2), 'utf8');
  fs.renameSync(TMP_FILE, DB_FILE);
}

function nextId(collection) {
  let max = 0;
  collection.forEach(function (item) { if (item.id && item.id > max) max = item.id; });
  return max + 1;
}

async function initDb() {
  loadDb();
  saveDb();
  console.log('✅ БД готова:', DB_FILE);
}

function tableOf(sql) {
  let m = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  if (m) return { op: 'insert', table: m[1] };
  m = sql.match(/UPDATE\s+(\w+)/i);
  if (m) return { op: 'update', table: m[1] };
  m = sql.match(/FROM\s+(\w+)/i);
  if (m) return { op: 'select', table: m[1] };
  return null;
}

function runSql(sql, params) {
  const info = tableOf(sql);
  if (!info) throw new Error('Неизвестный SQL: ' + sql);
  const table = _db[info.table];
  if (!table) throw new Error('Таблица не найдена: ' + info.table);

  if (info.op === 'insert') {
    const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (!colsMatch) throw new Error('Не разобрать INSERT');
    const cols = colsMatch[1].split(',').map(function (c) { return c.trim(); });

    const row = {};
    cols.forEach(function (col, i) { row[col] = params[i]; });

    if (row.email) {
      const exists = table.find(function (u) {
        return String(u.email).toLowerCase() === String(row.email).toLowerCase();
      });
      if (exists) throw new Error('Email уже занят');
    }
    if (info.table === 'requests' && !row.status) row.status = 'ожидает';
    if (info.table === 'users' && row.rating === undefined) row.rating = 0;

    row.id = nextId(table);
    row.created_at = new Date().toISOString();
    table.push(row);
    saveDb();
    return { lastInsertRowid: row.id };
  }

  if (info.op === 'update') {
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    if (!setMatch) throw new Error('Не разобрать UPDATE');
    const setCols = setMatch[1].split(',').map(function (s) { return s.split('=')[0].trim(); });
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=/i);
    const whereCol = whereMatch ? whereMatch[1].trim() : 'id';
    const valueParams = params.slice(0, setCols.length);
    const whereParam  = params[setCols.length];

    let changed = 0;
    table.forEach(function (row) {
      if (String(row[whereCol]) === String(whereParam)) {
        setCols.forEach(function (col, i) { row[col] = valueParams[i]; });
        changed++;
      }
    });
    saveDb();
    return { changes: changed };
  }

  throw new Error('Операция не поддержана: ' + info.op);
}

// Возвращаем КОПИИ строк, чтобы приложение не портило хранилище при обогащении данных.
function runSelect(sql, params) {
  const info = tableOf(sql);
  if (!info) throw new Error('Неизвестный SQL');
  const table = _db[info.table];
  if (!table) throw new Error('Таблица не найдена');

  const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
  const whereCol = whereMatch ? whereMatch[1].trim() : null;

  let rows = table.slice();
  if (whereCol && params.length > 0) {
    const needle = String(params[0]).toLowerCase();
    rows = rows.filter(function (row) { return String(row[whereCol]).toLowerCase() === needle; });
  }

  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (orderMatch) {
    const col = orderMatch[1];
    const desc = (orderMatch[2] || '').toUpperCase() === 'DESC';
    rows.sort(function (a, b) {
      if (a[col] < b[col]) return desc ? 1 : -1;
      if (a[col] > b[col]) return desc ? -1 : 1;
      return 0;
    });
  }
  return clone(rows);
}

const db = {
  prepare: function (sql) {
    return {
      run: function () { return runSql(sql, Array.prototype.slice.call(arguments)); },
      get: function () {
        const rows = runSelect(sql, Array.prototype.slice.call(arguments));
        return rows.length ? rows[0] : null;
      },
      all: function () { return runSelect(sql, Array.prototype.slice.call(arguments)); }
    };
  },
  run: function (sql, params) { return runSql(sql, params || []); }
};

module.exports = { initDb: initDb, db: db };
