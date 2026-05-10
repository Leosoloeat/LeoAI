// ─────────────────────────────────────────────────────────────────────────────
// LeoAI — Google Apps Script (Standalone Web App)
//
// Setup (ทำครั้งเดียว):
//   1. script.google.com → เปิดโปรเจคนี้
//   2. ลบ code เดิมทั้งหมด → paste code นี้แทน
//   3. กด Save (disk icon)
//   4. Run → เลือก function "setup" → กด Run
//      (ครั้งแรกจะขอ authorize → กด Allow)
//   5. Deploy → Manage deployments → Edit (ดินสอ) → Version: New version → Deploy
//   6. Copy Web App URL ใหม่ → ใส่ใน Railway GOOGLE_SCRIPT_URL
//
// Sheet columns: timestamp | userId | memory | source
// ─────────────────────────────────────────────────────────────────────────────

var SPREADSHEET_NAME = 'LeoAI Memory';
var SHEET_NAME       = 'Memory';

// ── Get or create the spreadsheet ────────────────────────────────────────────
function getSheet() {
  var props   = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('LEOAI_SHEET_ID');
  var ss      = null;

  if (sheetId) {
    try { ss = SpreadsheetApp.openById(sheetId); } catch (e) { ss = null; }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    props.setProperty('LEOAI_SHEET_ID', ss.getId());
    Logger.log('Created new spreadsheet: ' + ss.getUrl());
  }

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['timestamp', 'userId', 'memory', 'source']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

// ── Run this ONCE manually to authorize + create spreadsheet ─────────────────
function setup() {
  var sheet = getSheet();
  var props = PropertiesService.getScriptProperties();
  Logger.log('Sheet ready: ' + sheet.getParent().getUrl());
  Logger.log('Sheet ID saved: ' + props.getProperty('LEOAI_SHEET_ID'));
}

// ── POST /exec — append a memory row ─────────────────────────────────────────
function doPost(e) {
  try {
    var data   = JSON.parse(e.postData.contents);
    var action = data.action;

    if (action === 'append') {
      getSheet().appendRow([
        data.timestamp || new Date().toISOString(),
        data.userId    || 'unknown',
        data.memory    || '',
        data.source    || 'system',
      ]);
      return json({ ok: true });
    }

    return json({ ok: false, reason: 'Unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, reason: err.message });
  }
}

// ── GET /exec?action=load&limit=20 — fetch recent rows ───────────────────────
function doGet(e) {
  try {
    var action = (e.parameter || {}).action;
    var limit  = parseInt((e.parameter || {}).limit || '20', 10);

    if (action === 'load') {
      var values = getSheet().getDataRange().getValues();
      var rows   = values.slice(1).slice(-limit).map(function(row) {
        return {
          timestamp: row[0],
          userId:    row[1],
          memory:    row[2],
          source:    row[3],
        };
      });
      return json({ ok: true, rows: rows });
    }

    // Health check
    if (action === 'ping') {
      return json({ ok: true, msg: 'LeoAI Sheets online' });
    }

    return json({ ok: false, reason: 'Unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, reason: err.message });
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
