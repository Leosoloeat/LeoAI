// ─────────────────────────────────────────────────────────────────────────────
// LeoAI — Google Apps Script (deploy as Web App)
//
// Setup:
//   1. Go to script.google.com → New project
//   2. Paste this entire file (replace default code)
//   3. Deploy → New deployment → Web App
//      Execute as: Me
//      Who has access: Anyone
//   4. Copy the Web App URL
//   5. Add to Railway Variables:
//      GOOGLE_SCRIPT_URL = <paste URL here>
//   6. Redeploy Railway
//
// Sheet columns: timestamp | userId | memory | source
// ─────────────────────────────────────────────────────────────────────────────

var SHEET_NAME = 'Memory'; // change if you want a different tab name

function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    // Create sheet + header row on first run
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['timestamp', 'userId', 'memory', 'source']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  return sheet;
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
      var sheet  = getSheet();
      var values = sheet.getDataRange().getValues();

      // Skip header row, take last N rows
      var rows = values.slice(1).slice(-limit).map(function(row) {
        return {
          timestamp: row[0],
          userId:    row[1],
          memory:    row[2],
          source:    row[3],
        };
      });

      return json({ ok: true, rows: rows });
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
