// 碰器嚴選系統 — Google Apps Script 後端
// 部署方式：擴充功能 → Apps Script → 貼上此程式碼 → 部署為網頁應用程式
// 執行身份：我（你的 Google 帳號）；存取者：所有人

const SHEET_NAME = 'DB';
const CELL = 'A1';

function doGet(e) {
  try {
    const data = loadState();
    return ok({ data });
  } catch(err) {
    return fail(err.message);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'save') {
      saveState(body.data);
      return ok({ saved: true });
    }

    return fail('未知 action');
  } catch(err) {
    return fail(err.message);
  }
}

function loadState() {
  const sheet = getSheet();
  const val = sheet.getRange(CELL).getValue();
  return val ? JSON.parse(val) : null;
}

function saveState(data) {
  const sheet = getSheet();
  sheet.getRange(CELL).setValue(JSON.stringify(data));
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
