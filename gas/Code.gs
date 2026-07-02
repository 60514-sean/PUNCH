// 碰器嚴選系統 — Google Apps Script 後端 (v2 多分頁版)
// 部署方式：擴充功能 → Apps Script → 貼上此程式碼 → 部署為網頁應用程式
// 執行身份：我（你的 Google 帳號）；存取者：所有人

// 各 collection 對應的分頁名稱（每個 array of objects with id 一個分頁）
const COLL_SHEETS = [
  'orders', 'finances', 'stocks', 'products', 'customers',
  'quotes', 'channels', 'tasks', 'logs', 'monthMethods', 'productCosts',
  'channelStock', 'channelSales', 'channelRestocks'
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
  // 防復發：凡是「整欄都是數字（或空）」的欄位，鎖定純數字格式，
  // 避免 Sheets 把 0,1,2… 自動誤判成日期，造成讀回來變 Date。
  headers.forEach((h, i) => {
    const vals = items.map(it => it[h]);
    const hasNum = vals.some(v => typeof v === 'number');
    const allNumOrEmpty = vals.every(v => v == null || v === '' || typeof v === 'number');
    if (hasNum && allNumOrEmpty) {
      sheet.getRange(2, i + 1, rows.length, 1).setNumberFormat('0.######');
    }
  });
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

// ─── 一次性修復：把被誤判為「日期」的數字欄還原成數字 ───
// 症狀：庫存/底線顯示成 1900-01-02、1899-12-24T16:00:00.000Z 之類的日期。
// 原因：該欄被當成日期。Sheets 內部以序列號存數字（1899-12-30 為第 0 天），
//       一旦格子是日期格式，數字 3 就顯示成 1900-01-02、0 顯示成 1899-12-30 前後。
// 修法：讀回原始值 → 反推序列號還原成數字 → 寫回 + 鎖定數字格式。
// 用法：在 Apps Script 編輯器選此函式按「執行」一次，之後前端重新整理即可。
const SHEETS_EPOCH = Date.UTC(1899, 11, 30); // Sheets 序列號第 0 天

function cellToNumber(v) {
  if (v === '' || v == null) return null;          // 留空，不動
  if (typeof v === 'number') return v;             // 已是數字
  let d = (v instanceof Date) ? v : null;
  if (!d && typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); // 日期或 ISO 時間戳開頭
    if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    else { const n = Number(v); return isNaN(n) ? null : n; }
  }
  if (d) {
    const serial = Math.round((d.getTime() - SHEETS_EPOCH) / 86400000);
    return serial < 0 ? 0 : serial;               // 緊鄰 epoch 的（庫存 0）夾成 0
  }
  return null;
}

function fixStockNumbers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const NUM_COLS = { stocks: ['qty', 'min', 'price'] };
  const report = [];
  Object.keys(NUM_COLS).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    NUM_COLS[name].forEach(key => {
      const col = headers.indexOf(key) + 1;
      if (col <= 0) return;
      const rng = sheet.getRange(2, col, sheet.getLastRow() - 1, 1);
      const vals = rng.getValues();
      let changed = 0;
      const out = vals.map(([v]) => {
        const n = cellToNumber(v);
        if (n !== null && n !== v) changed++;
        return [n === null ? '' : n];
      });
      rng.setNumberFormat('0.######');
      rng.setValues(out);
      report.push(name + '.' + key + '(' + changed + ')');
    });
  });
  SpreadsheetApp.flush();
  Logger.log('已修復：' + report.join(', '));
}

function migrateFromOldUrl() {
  const r = UrlFetchApp.fetch(OLD_GAS_URL, { muteHttpExceptions: true });
  const json = JSON.parse(r.getContentText());
  if (!json.ok || !json.data) throw new Error('舊 GAS 無資料：' + r.getContentText().slice(0, 200));
  saveAll(json.data);
  Logger.log('遷移完成：' + Object.keys(json.data).map(k => k + '(' + (Array.isArray(json.data[k]) ? json.data[k].length : 'meta') + ')').join(', '));
}
