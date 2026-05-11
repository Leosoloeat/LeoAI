// ─────────────────────────────────────────────────────────────────────────────
// LeoAI — Google Apps Script  |  Standalone Web App  |  Version 4
// ALL actions use POST — avoids redirect/auth issues with GET + query params.
//
// ─── SETUP (ทำครั้งเดียว) ────────────────────────────────────────────────────
// 1. script.google.com → เปิดโปรเจค LeoAI
// 2. ลบ code เดิมทั้งหมด → Paste code นี้แทน → Save (Ctrl+S)
// 3. Run → setup → Allow permissions
// 4. Deploy → Manage deployments → Edit (ดินสอ)
//    → Version: New version → Deploy
//    → Copy Web App URL → ใส่ใน Railway: GOOGLE_SHEETS_WEBHOOK
//
// ─── DEPLOY SETTINGS (สำคัญมาก) ─────────────────────────────────────────────
//    Execute as:      Me
//    Who has access:  Anyone   ← ต้องเป็น "Anyone" เท่านั้น
//
// ─── ALL ACTIONS — POST /exec  body: { action, ... } ─────────────────────────
//    ping                → {}
//    appendMemory        → { userId, memory, source?, timestamp? }
//    getMemory           → { limit? }              — returns all rows
//    getMemoryByUser     → { userId, limit? }      — returns rows for userId
//    searchMemory        → { userId, query, limit? }
//    forgetMemory        → { userId, key }         — deletes [key] rows for userId
//    saveKnowledge       → { userId, project, type, title, content, tags, score, timestamp? }
//    getKnowledge        → { project?, limit? }    — returns knowledge rows
//    searchKnowledge     → { query, limit? }       — keyword search in knowledge
// ─────────────────────────────────────────────────────────────────────────────

var MEMORY_SHEET    = 'Memory';
var KNOWLEDGE_SHEET = 'Knowledge';

// ─────────────────────────────────────────────────────────────────────────────
// Spreadsheet helper — auto-create on first run
// ─────────────────────────────────────────────────────────────────────────────

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('LEOAI_SHEET_ID');
  var ss    = null;

  // Fix: clean stored value — extract pure ID from any format
  if (id) {
    // Format 1: full URL  https://docs.google.com/spreadsheets/d/ID/edit...
    if (id.indexOf('docs.google.com') !== -1) {
      var m1 = id.match(/\/d\/([a-zA-Z0-9_-]+)/);
      id = m1 ? m1[1] : null;
    }
    // Format 2: ID/edit?gid=0#gid=0  (just strip everything after first /)
    else if (id.indexOf('/') !== -1) {
      id = id.split('/')[0];
    }
    // Format 3: ID?gid=0  (strip query string)
    else if (id.indexOf('?') !== -1) {
      id = id.split('?')[0];
    }
    if (id) props.setProperty('LEOAI_SHEET_ID', id); // save clean ID
  }

  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('LeoAI OS Data');
    id = ss.getId();
    props.setProperty('LEOAI_SHEET_ID', id);
    Logger.log('Created spreadsheet: ' + ss.getUrl());
  }

  return ss;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get (or create) the Memory sheet tab
// ─────────────────────────────────────────────────────────────────────────────

function getMemorySheet() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(MEMORY_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(MEMORY_SHEET);
    sheet.appendRow(['timestamp', 'userId', 'memory', 'source']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Created Memory tab');
  }

  return sheet;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get (or create) the Knowledge sheet tab
// ─────────────────────────────────────────────────────────────────────────────

function getKnowledgeSheet() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(KNOWLEDGE_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(KNOWLEDGE_SHEET);
    sheet.appendRow(['timestamp', 'userId', 'project', 'type', 'title', 'content', 'tags', 'score']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Make content column wider
    sheet.setColumnWidth(6, 400);
    Logger.log('Created Knowledge tab');
  }

  return sheet;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row converters
// ─────────────────────────────────────────────────────────────────────────────

function memoryRowToObj(row) {
  return {
    timestamp: row[0] ? String(row[0]) : '',
    userId:    row[1] ? String(row[1]) : '',
    memory:    row[2] ? String(row[2]) : '',
    source:    row[3] ? String(row[3]) : '',
  };
}

function knowledgeRowToObj(row) {
  return {
    timestamp: row[0] ? String(row[0]) : '',
    userId:    row[1] ? String(row[1]) : '',
    project:   row[2] ? String(row[2]) : '',
    type:      row[3] ? String(row[3]) : '',
    title:     row[4] ? String(row[4]) : '',
    content:   row[5] ? String(row[5]) : '',
    tags:      row[6] ? String(row[6]) : '',
    score:     row[7] ? String(row[7]) : '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// doGet — browser ping test only
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  return makeJson({ ok: true, msg: 'LeoAI OS Sheets online (use POST for all actions)', ts: new Date().toISOString() });
}

// ─────────────────────────────────────────────────────────────────────────────
// doPost — ALL actions handled here
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return makeJson({ ok: false, error: 'Invalid JSON body: ' + parseErr.message });
    }

    var action = body.action || '';

    // ── ping ──────────────────────────────────────────────────────────────────
    if (action === 'ping') {
      return makeJson({ ok: true, msg: 'LeoAI OS Sheets online', ts: new Date().toISOString() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MEMORY ACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    // ── appendMemory ──────────────────────────────────────────────────────────
    if (action === 'appendMemory') {
      if (!body.memory) return makeJson({ ok: false, error: 'memory field required' });

      getMemorySheet().appendRow([
        body.timestamp || new Date().toISOString(),
        body.userId    || 'unknown',
        String(body.memory).slice(0, 1000),
        body.source    || 'system',
      ]);

      Logger.log('appendMemory: ' + body.userId + ' | ' + String(body.memory).slice(0, 80));
      return makeJson({ ok: true, action: 'appendMemory' });
    }

    // ── getMemory — all rows, newest last ─────────────────────────────────────
    if (action === 'getMemory') {
      var limit = Math.min(parseInt(body.limit || '20', 10), 500);
      var rows  = getMemorySheet().getDataRange().getValues().slice(1).slice(-limit).map(memoryRowToObj);
      return makeJson({ ok: true, count: rows.length, rows: rows });
    }

    // ── getMemoryByUser — filtered by userId ──────────────────────────────────
    if (action === 'getMemoryByUser') {
      var uid    = body.userId || '';
      var limit2 = Math.min(parseInt(body.limit || '20', 10), 200);
      if (!uid) return makeJson({ ok: false, error: 'userId field required' });

      var all   = getMemorySheet().getDataRange().getValues().slice(1);
      var found = [];
      for (var i = 0; i < all.length; i++) {
        if (String(all[i][1]) === uid) found.push(memoryRowToObj(all[i]));
      }
      found = found.slice(-limit2);
      return makeJson({ ok: true, count: found.length, rows: found });
    }

    // ── searchMemory ──────────────────────────────────────────────────────────
    if (action === 'searchMemory') {
      var uid3   = body.userId || '';
      var query  = String(body.query || '').toLowerCase();
      var limit3 = Math.min(parseInt(body.limit || '10', 10), 100);
      if (!uid3)  return makeJson({ ok: false, error: 'userId field required' });
      if (!query) return makeJson({ ok: false, error: 'query field required' });

      var all3  = getMemorySheet().getDataRange().getValues().slice(1);
      var hits  = [];
      for (var j = 0; j < all3.length; j++) {
        if (String(all3[j][1]) === uid3 && String(all3[j][2]).toLowerCase().indexOf(query) !== -1) {
          hits.push(memoryRowToObj(all3[j]));
        }
      }
      hits = hits.slice(-limit3);
      return makeJson({ ok: true, count: hits.length, rows: hits });
    }

    // ── forgetMemory — delete rows by userId + [key] prefix ──────────────────
    if (action === 'forgetMemory') {
      if (!body.userId) return makeJson({ ok: false, error: 'userId field required' });
      if (!body.key)    return makeJson({ ok: false, error: 'key field required' });

      var sheet   = getMemorySheet();
      var data    = sheet.getDataRange().getValues();
      var deleted = 0;
      var prefix  = '[' + body.key + ']';

      for (var k = data.length - 1; k >= 1; k--) {
        if (String(data[k][1]) === body.userId &&
            String(data[k][2]).indexOf(prefix) === 0) {
          sheet.deleteRow(k + 1);
          deleted++;
        }
      }

      Logger.log('forgetMemory: userId=' + body.userId + ' key=' + body.key + ' deleted=' + deleted);
      return makeJson({ ok: true, action: 'forgetMemory', deleted: deleted });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KNOWLEDGE ACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    // ── saveKnowledge ─────────────────────────────────────────────────────────
    if (action === 'saveKnowledge') {
      if (!body.title)   return makeJson({ ok: false, error: 'title field required' });
      if (!body.content) return makeJson({ ok: false, error: 'content field required' });

      getKnowledgeSheet().appendRow([
        body.timestamp || new Date().toISOString(),
        body.userId    || 'system',
        body.project   || 'general',
        body.type      || 'knowledge',
        String(body.title).slice(0, 200),
        String(body.content).slice(0, 2000),
        body.tags      || '',
        body.score     || '0',
      ]);

      Logger.log('saveKnowledge: type=' + body.type + ' score=' + body.score + ' | ' + String(body.title).slice(0, 60));
      return makeJson({ ok: true, action: 'saveKnowledge' });
    }

    // ── getKnowledge — recent entries, optionally filtered by project ─────────
    if (action === 'getKnowledge') {
      var kLimit   = Math.min(parseInt(body.limit || '10', 10), 100);
      var kProject = body.project || null;

      var kAll = getKnowledgeSheet().getDataRange().getValues().slice(1);

      if (kProject) {
        kAll = kAll.filter(function(row) { return String(row[2]) === kProject; });
      }

      var kRows = kAll.slice(-kLimit).map(knowledgeRowToObj);
      return makeJson({ ok: true, count: kRows.length, rows: kRows });
    }

    // ── searchKnowledge — keyword search across title + content + tags ────────
    if (action === 'searchKnowledge') {
      var skQuery = String(body.query || '').toLowerCase();
      var skLimit = Math.min(parseInt(body.limit || '5', 10), 50);

      if (!skQuery) return makeJson({ ok: false, error: 'query field required' });

      var skAll  = getKnowledgeSheet().getDataRange().getValues().slice(1);
      var skHits = [];

      for (var m = 0; m < skAll.length; m++) {
        var title   = String(skAll[m][4] || '').toLowerCase();
        var content = String(skAll[m][5] || '').toLowerCase();
        var tags    = String(skAll[m][6] || '').toLowerCase();

        if (title.indexOf(skQuery) !== -1 ||
            content.indexOf(skQuery) !== -1 ||
            tags.indexOf(skQuery) !== -1) {
          skHits.push(knowledgeRowToObj(skAll[m]));
        }
      }

      skHits = skHits.slice(-skLimit);
      return makeJson({ ok: true, count: skHits.length, rows: skHits });
    }

    return makeJson({ ok: false, error: 'Unknown action: ' + action });

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return makeJson({ ok: false, error: 'doPost crashed: ' + err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON helper
// ─────────────────────────────────────────────────────────────────────────────

function makeJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────────────────────
// setup — run ONCE manually after pasting this code
// ─────────────────────────────────────────────────────────────────────────────

function setup() {
  var memSheet = getMemorySheet();
  var kSheet   = getKnowledgeSheet();
  var props    = PropertiesService.getScriptProperties();

  Logger.log('=== LeoAI OS Sheets Setup Complete ===');
  Logger.log('Spreadsheet: ' + memSheet.getParent().getUrl());
  Logger.log('Sheet ID: ' + props.getProperty('LEOAI_SHEET_ID'));
  Logger.log('Memory tab: ' + memSheet.getName() + ' (rows: ' + (memSheet.getLastRow() - 1) + ')');
  Logger.log('Knowledge tab: ' + kSheet.getName() + ' (rows: ' + (kSheet.getLastRow() - 1) + ')');
  Logger.log('');
  Logger.log('POST actions available:');
  Logger.log('  Memory: ping, appendMemory, getMemory, getMemoryByUser, searchMemory, forgetMemory');
  Logger.log('  Knowledge: saveKnowledge, getKnowledge, searchKnowledge');
  Logger.log('');
  Logger.log('Deploy settings: Execute as Me + Anyone');
}
