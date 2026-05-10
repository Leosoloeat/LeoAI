// ─────────────────────────────────────────────────────────────────────────────
// LeoAI — Google Apps Script  |  Standalone Web App
// ALWAYS returns JSON. Never returns HTML.
//
// ─── SETUP (ทำครั้งเดียว) ────────────────────────────────────────────────────
// 1. script.google.com → เปิดโปรเจค LeoAI
// 2. ลบ code เดิมทั้งหมด → Paste code นี้แทน → Save
// 3. Run → setup → Allow (grant permissions)
//    (Logs จะแสดง URL ของ Google Sheet ที่ถูกสร้าง)
// 4. Deploy → Manage deployments → Edit (ดินสอ)
//    → Version: New version → Deploy
//    → Copy Web App URL ใหม่ → ใส่ใน Railway GOOGLE_SCRIPT_URL
//
// ─── DEPLOY SETTINGS (สำคัญมาก) ─────────────────────────────────────────────
//    Execute as:      Me
//    Who has access:  Anyone   ← ต้องเป็น "Anyone" ไม่ใช่ "Anyone with account"
//
// ─── TEST URLs ───────────────────────────────────────────────────────────────
//    Ping:       GET  /exec?action=ping
//    Get memory: GET  /exec?action=getMemory&limit=10
//    Append:     POST /exec  body: {"action":"appendMemory","userId":"test","memory":"hello","source":"test"}
//
// ─── Expected JSON responses ─────────────────────────────────────────────────
//    { "ok": true, "msg": "LeoAI Sheets online" }
//    { "ok": true, "count": 3, "rows": [...] }
//    { "ok": true, "action": "appendMemory" }
//    { "ok": false, "error": "reason here" }
// ─────────────────────────────────────────────────────────────────────────────

var SHEET_NAME = 'Memory';

// ─────────────────────────────────────────────────────────────────────────────
// Sheet helper — auto-create spreadsheet + tab on first run
// ─────────────────────────────────────────────────────────────────────────────

function getSheet() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('LEOAI_SHEET_ID');
  var ss    = null;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }

  if (!ss) {
    ss    = SpreadsheetApp.create('LeoAI Memory');
    id    = ss.getId();
    props.setProperty('LEOAI_SHEET_ID', id);
    Logger.log('Created spreadsheet: ' + ss.getUrl());
  }

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['timestamp', 'userId', 'memory', 'source']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Created sheet tab: ' + SHEET_NAME);
  }

  return sheet;
}

// ─────────────────────────────────────────────────────────────────────────────
// doGet — handles GET requests
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  // Outer try/catch: GUARANTEES JSON response even if everything inside crashes
  try {
    var params = e.parameter || {};
    var action = params.action || 'ping';

    // ── ping ──────────────────────────────────────────────────────────────────
    if (action === 'ping') {
      return makeJson({ ok: true, msg: 'LeoAI Sheets online', ts: new Date().toISOString() });
    }

    // ── getMemory ─────────────────────────────────────────────────────────────
    if (action === 'getMemory') {
      var limit  = Math.min(parseInt(params.limit || '20', 10), 100);
      var sheet  = getSheet();
      var values = sheet.getDataRange().getValues();

      // Skip header row (row 0), take last N rows
      var rows = values.slice(1).slice(-limit).map(function (row) {
        return {
          timestamp: row[0] ? String(row[0]) : '',
          userId:    row[1] ? String(row[1]) : '',
          memory:    row[2] ? String(row[2]) : '',
          source:    row[3] ? String(row[3]) : '',
        };
      });

      return makeJson({ ok: true, count: rows.length, rows: rows });
    }

    return makeJson({ ok: false, error: 'Unknown action: ' + action });

  } catch (err) {
    // Always JSON, never HTML
    return makeJson({ ok: false, error: 'doGet crashed: ' + err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// doPost — handles POST requests
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    // Parse body safely
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return makeJson({ ok: false, error: 'Invalid JSON body: ' + parseErr.message });
    }

    var action = body.action || '';

    // ── appendMemory ──────────────────────────────────────────────────────────
    if (action === 'appendMemory') {
      if (!body.memory) return makeJson({ ok: false, error: 'memory field is required' });

      getSheet().appendRow([
        body.timestamp || new Date().toISOString(),
        body.userId    || 'unknown',
        body.memory,
        body.source    || 'system',
      ]);

      Logger.log('Appended: ' + body.userId + ' | ' + body.memory.slice(0, 60));
      return makeJson({ ok: true, action: 'appendMemory' });
    }

    return makeJson({ ok: false, error: 'Unknown action: ' + action });

  } catch (err) {
    return makeJson({ ok: false, error: 'doPost crashed: ' + err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON helper — the ONLY output format used in this script
// ─────────────────────────────────────────────────────────────────────────────

function makeJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────────────────────
// setup — run this ONCE manually to authorize + create spreadsheet
// ─────────────────────────────────────────────────────────────────────────────

function setup() {
  var sheet = getSheet();
  var props = PropertiesService.getScriptProperties();
  Logger.log('=== LeoAI Sheets Setup Complete ===');
  Logger.log('Spreadsheet URL: ' + sheet.getParent().getUrl());
  Logger.log('Sheet ID stored: ' + props.getProperty('LEOAI_SHEET_ID'));
  Logger.log('Tab name: ' + sheet.getName());
}
