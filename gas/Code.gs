// 碰器嚴選系統 — Google Apps Script 後端 (v2 多分頁版)
// 部署方式：擴充功能 → Apps Script → 貼上此程式碼 → 部署為網頁應用程式
// 執行身份：我（你的 Google 帳號）；存取者：所有人

// 各 collection 對應的分頁名稱（每個 array of objects with id 一個分頁）
const COLL_SHEETS = [
  'orders', 'finances', 'stocks', 'products', 'customers',
  'quotes', 'channels', 'tasks', 'logs', 'monthMethods', 'productCosts'
];
// 非陣列的 state 鍵值（goals, weekPlan）統一放這個 meta 分頁
const META_SHEET = '_meta';
const META_KEYS = ['goals', 'weekPlan'];

// ─── Web App entry points ───
function doGet(e) {
  try {
    return ok({ data: loadAll() });
  } catch (err) {
    return fail(err.message + ' | ' + (err.stack || ''));
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'save') {
      saveAll(body.data || {});
      return ok({ saved: true });
    }
    if (body.action === 'saveOne' && body.coll && Array.isArray(body.items)) {
      writeSheet(SpreadsheetApp.getActiveSpreadsheet(), body.coll, body.items);
      return ok({ saved: true, coll: body.coll, count: body.items.length });
    }
    return fail('未知 action');
  } catch (err) {
    return fail(err.message + ' | ' + (err.stack || ''));
  }
}

// ─── Load: 所有分頁 → 單一 state JSON ───
function loadAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const state = {};
  COLL_SHEETS.forEach(name => {
    state[name] = readSheet(ss, name);
  });
  Object.assign(state, readMeta(ss));
  return state;
}

// ─── Save: state JSON → 所有分頁 ───
function saveAll(state) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  COLL_SHEETS.forEach(name => {
    if (Array.isArray(state[name])) {
      writeSheet(ss, name, state[name]);
    }
  });
  const meta = {};
  META_KEYS.forEach(k => { if (k in state) meta[k] = state[k]; });
  writeMeta(ss, meta);
}

// ─── Sheet helpers ───
function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function readSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const rng = sheet.getDataRange().getValues();
  if (rng.length < 2) return [];
  const headers = rng[0];
  return rng.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (!h) return;
      const v = parseCell(row[i]);
      if (v !== undefined) obj[h] = v;
    });
    return obj;
  }).filter(obj => obj.id);
}

function writeSheet(ss, name, items) {
  const sheet = getOrCreateSheet(ss, name);
  sheet.clearContents();
  if (!items || items.length === 0) return;
  // 自動收集所有 keys，'id' 永遠在第一欄
  const keySet = new Set();
  items.forEach(it => Object.keys(it).forEach(k => keySet.add(k)));
  const headers = ['id', ...Array.from(keySet).filter(k => k !== 'id')];
  const rows = items.map(it => headers.map(h => stringifyCell(it[h])));
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function readMeta(ss) {
  const sheet = ss.getSheetByName(META_SHEET);
  if (!sheet) return {};
  const rng = sheet.getDataRange().getValues();
  const meta = {};
  rng.forEach(row => {
    if (!row[0]) return;
    const v = parseCell(row[1]);
    if (v !== undefined) meta[row[0]] = v;
  });
  return meta;
}

function writeMeta(ss, meta) {
  const sheet = getOrCreateSheet(ss, META_SHEET);
  sheet.clearContents();
  const rows = Object.keys(meta).map(k => [k, stringifyCell(meta[k])]);
  if (rows.length === 0) return;
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
}

// 嘗試 parse JSON（陣列 / 物件 / boolean / null）；Date 轉短日期；其餘維持原值
function parseCell(v) {
  if (v === '' || v == null) return undefined;
  if (v instanceof Date) {
    // Sheets 把 'YYYY-MM-DD' 自動視為 Date，讀回來轉回字串短日期格式
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (typeof v !== 'string') return v;
  const t = v.trim();
  // 如果是 ISO 完整時間戳，截短成 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(t)) return t.slice(0, 10);
  if (t.startsWith('[') || t.startsWith('{') || t === 'true' || t === 'false' || t === 'null') {
    try { return JSON.parse(t); } catch (e) { /* fall through */ }
  }
  return v;
}

function stringifyCell(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

// ─── Response helpers ───
function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ ok: true }, data)))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── 一次性遷移：從舊 GAS URL 抓資料寫進此 sheet 各分頁 ───
// 部署完之後，在 Apps Script 編輯器手動執行一次 migrateFromOldUrl()
const OLD_GAS_URL = 'https://script.google.com/macros/s/AKfycbx5uFoCCU9X5czLKzXHOm3WRXuyCozGg2xfIuuLQ06xSxcz-Bq-QgNpIpjXrD9FbFjOlQ/exec';

function migrateFromOldUrl() {
  const r = UrlFetchApp.fetch(OLD_GAS_URL, { muteHttpExceptions: true });
  const json = JSON.parse(r.getContentText());
  if (!json.ok || !json.data) throw new Error('舊 GAS 無資料：' + r.getContentText().slice(0, 200));
  saveAll(json.data);
  Logger.log('遷移完成：' + Object.keys(json.data).map(k => k + '(' + (Array.isArray(json.data[k]) ? json.data[k].length : 'meta') + ')').join(', '));
}
