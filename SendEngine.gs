// ============================================================
//  MailMatic — SendEngine.gs
//  https://github.com/arorarushil/mailmatic
//
//  Column layout (Row 1 = header):
//    A: Name | B: Designation | C: Company | D: Recipient | E: Merge status | F: Note
//
//  SETUP CHECKLIST — edit the CONFIG section below before first use:
//    1. Set SHEET_NAME to your tab name
//    2. Set SUBJECT to your email subject line
//    3. Set FROM_NAME to your name
//    4. Edit buildHtmlBody_() with your actual email content
//    5. Set TEST_TO in testSend() to your own email address
// ============================================================

// ── CONFIG — EDIT THESE ──────────────────────────────────────
var SHEET_NAME  = 'Sheet1';             // ← name of your sheet tab
var SUBJECT     = 'Your subject line';  // ← your email subject
var FROM_NAME   = 'Your Name';          // ← your name (shown as sender)
var DAILY_CAP   = 450;                  // ← keep at 450 (Gmail hard limit is 500/day)

// ── ADVANCED CONFIG (usually no need to change) ──────────────
var SEND_DELAY_MS       = 800;              // ms between sends
var BATCH_CEILING       = 5 * 60 * 1000;   // bail at 5 min (Apps Script limit is 6 min)
var GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// ── COLUMN INDICES (0-based, matches A=0, B=1 etc.) ──────────
var COL_NAME        = 0;  // A: Name
var COL_DESIGNATION = 1;  // B: Designation
var COL_COMPANY     = 2;  // C: Company
var COL_RECIPIENT   = 3;  // D: Recipient (email address)
var COL_STATUS      = 4;  // E: Merge status (written by script)
var COL_NOTE        = 5;  // F: Note (optional, not used by script)

// ── ENTRY POINTS ─────────────────────────────────────────────

/** Preview first 3 merged emails in logs. Sends nothing. */
function dryRun() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data  = sheet.getDataRange().getValues();
  var rows  = data.slice(1); // skip header row

  Logger.log('=== DRY RUN — first 3 rows preview ===');
  var count = 0;
  for (var i = 0; i < rows.length && count < 3; i++) {
    var name        = rows[i][COL_NAME];
    var designation = rows[i][COL_DESIGNATION];
    var company     = rows[i][COL_COMPANY];
    var recipient   = rows[i][COL_RECIPIENT];
    var status      = rows[i][COL_STATUS];

    if (!recipient || status) continue; // skip blank or already-sent rows

    Logger.log('--- Row ' + (i + 2) + ' ---');
    Logger.log('To     : ' + recipient);
    Logger.log('Subject: ' + SUBJECT);
    Logger.log('Body   :');
    Logger.log(buildHtmlBody_(name, designation, company));
    Logger.log('');
    count++;
  }
  Logger.log('=== DRY RUN COMPLETE — ' + count + ' row(s) previewed. Nothing was sent. ===');
}

/** Quick real send — first 5 rows with blank Merge status. Good for testing. */
function sendFirstN() {
  sendBatch_(5);
}

/** Send all rows with blank Merge status, respecting DAILY_CAP. Self-resumes past the 6-min Apps Script limit. */
function sendAll() {
  sendBatch_(999999);
}

// ── CORE SEND LOOP ───────────────────────────────────────────

function sendBatch_(limit) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheet  = ss.getSheetByName(SHEET_NAME);
  var data   = sheet.getDataRange().getValues();
  var rows   = data.slice(1);
  var start  = Date.now();
  var sent   = 0;
  var errors = 0;

  for (var i = 0; i < rows.length && sent < limit; i++) {
    // Time guard — bail before the 6-min Apps Script execution limit
    if (Date.now() - start > BATCH_CEILING) {
      Logger.log('⏱ Time limit reached after ' + sent + ' sends. Scheduling continuation...');
      scheduleContinuation_();
      break;
    }

    var name        = rows[i][COL_NAME];
    var designation = rows[i][COL_DESIGNATION];
    var company     = rows[i][COL_COMPANY];
    var recipient   = rows[i][COL_RECIPIENT];
    var status      = rows[i][COL_STATUS];
    var sheetRow    = i + 2; // 1-indexed + 1 for header

    if (!recipient || status) continue; // skip blank email or already processed

    // Daily cap check
    if (getDailyCount_() >= DAILY_CAP) {
      sheet.getRange(sheetRow, COL_STATUS + 1).setValue('SKIP (daily cap)');
      Logger.log('⛔ Daily cap reached at row ' + sheetRow + '. Stopping.');
      break;
    }

    // Send
    try {
      sendViaGmailApi_({
        to:      recipient,
        subject: SUBJECT,
        html:    buildHtmlBody_(name, designation, company),
        from:    FROM_NAME
      });
      sheet.getRange(sheetRow, COL_STATUS + 1).setValue('sent');
      incrementDailyCount_();
      sent++;
      Logger.log('✓ ' + sheetRow + ' → ' + recipient);
    } catch (e) {
      var msg = e.message || String(e);
      sheet.getRange(sheetRow, COL_STATUS + 1).setValue('error (' + msg.substring(0, 80) + ')');
      errors++;
      Logger.log('✗ ' + sheetRow + ' → ' + recipient + ' | ' + msg);

      // Back off on rate limit
      if (msg.indexOf('429') !== -1) {
        Logger.log('Rate limited — pausing 10s');
        Utilities.sleep(10000);
      }
    }

    SpreadsheetApp.flush();
    Utilities.sleep(SEND_DELAY_MS);
  }

  Logger.log('── Batch complete: ' + sent + ' sent, ' + errors + ' errors ──');
}

// ── EMAIL BODY — EDIT THIS ────────────────────────────────────
//
//  Replace the sample below with your actual email content.
//  Available merge variables:
//    name        → recipient's first name       (column A)
//    designation → recipient's job title        (column B)
//    company     → recipient's company name     (column C)
//
//  Example usage inside the string:
//    'Hi ' + name + ','
//    'I noticed your role as ' + designation + ' at ' + company + '...'

/**
 * @param {string} name        - Recipient first name
 * @param {string} designation - Recipient job title
 * @param {string} company     - Recipient company name
 * @returns {string} HTML email body
 */
function buildHtmlBody_(name, designation, company) {
  // Fallbacks if a cell is empty
  name        = name        || 'there';
  designation = designation || 'your role';
  company     = company     || 'your organisation';

  // ── YOUR EMAIL BODY GOES HERE ──────────────────────────────
  // Replace this sample with your own content.
  // Keep it as an HTML string. Use <br> for line breaks.
  return '<div dir="ltr">'
    + 'Hi ' + name + ',<br><br>'
    + 'I hope you\'re doing well.<br><br>'
    + '[ Write your email body here. You can use the variables: ]<br>'
    + '[ name = "' + name + '" | designation = "' + designation + '" | company = "' + company + '" ]<br><br>'
    + 'Best regards,<br>'
    + FROM_NAME
    + '</div>';
  // ── END OF EMAIL BODY ──────────────────────────────────────
}

// ── GMAIL API SEND ────────────────────────────────────────────

function sendViaGmailApi_(opts) {
  var raw  = buildRawMessage_(opts);
  var resp = UrlFetchApp.fetch(GMAIL_SEND_ENDPOINT, {
    method:      'post',
    headers:     { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    contentType: 'application/json',
    payload:     JSON.stringify({ raw: raw }),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('HTTP ' + code + ' ' + resp.getContentText().substring(0, 200));
  }
  return JSON.parse(resp.getContentText());
}

// ── MIME BUILDER ──────────────────────────────────────────────

function buildRawMessage_(opts) {
  var CRLF = '\r\n';
  var headers =
    'From: ' + encodeHeaderWord_(opts.from) + ' <me>' + CRLF +
    'To: ' + opts.to + CRLF +
    'Subject: ' + encodeHeaderWord_(opts.subject) + CRLF +
    'MIME-Version: 1.0' + CRLF +
    'Content-Type: text/html; charset=UTF-8' + CRLF +
    'Content-Transfer-Encoding: base64' + CRLF;

  var body    = Utilities.base64Encode(opts.html, Utilities.Charset.UTF_8);
  var wrapped = wrapAt76_(body);
  var mime    = headers + CRLF + wrapped;

  return Utilities.base64EncodeWebSafe(mime).replace(/=+$/, '');
}

function encodeHeaderWord_(text) {
  if (!/[^\x00-\x7F]/.test(text)) return text;
  return '=?UTF-8?B?' + Utilities.base64Encode(text, Utilities.Charset.UTF_8) + '?=';
}

function wrapAt76_(str) {
  var out = '';
  for (var i = 0; i < str.length; i += 76) {
    out += str.substring(i, i + 76) + '\r\n';
  }
  return out;
}

// ── DAILY COUNTER (rolling 24h window) ───────────────────────

var DAILY_KEY = 'DAILY_TIMESTAMPS';

function getDailyCount_() {
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty(DAILY_KEY);
  if (!raw) return 0;
  var now   = Date.now();
  var ts    = JSON.parse(raw).filter(function(t) { return now - t < 86400000; });
  props.setProperty(DAILY_KEY, JSON.stringify(ts));
  return ts.length;
}

function incrementDailyCount_() {
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty(DAILY_KEY);
  var ts    = raw ? JSON.parse(raw) : [];
  var now   = Date.now();
  ts = ts.filter(function(t) { return now - t < 86400000; });
  ts.push(now);
  props.setProperty(DAILY_KEY, JSON.stringify(ts));
}

// ── CONTINUATION TRIGGER ──────────────────────────────────────

function scheduleContinuation_() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendAll').timeBased().after(2 * 60 * 1000).create();
  Logger.log('⏰ Continuation trigger set — will resume in ~2 min.');
}

// ── PROOF TEST ────────────────────────────────────────────────
//
//  Run this once after setup to confirm Gmail API is working.
//  If quota is unchanged after 3 sends = you're on the API path (not the 100/day AS quota).
//  Change TEST_TO to your own email address before running.

function testSend() {
  var TEST_TO = 'your-email@gmail.com'; // ← CHANGE THIS to your email

  var before = MailApp.getRemainingDailyQuota();
  Logger.log('MailApp quota BEFORE : ' + before);
  Logger.log('Sending 3 test emails to: ' + TEST_TO);
  Logger.log('--------------------------------------------');

  for (var i = 1; i <= 3; i++) {
    try {
      sendViaGmailApi_({
        to:      TEST_TO,
        subject: 'MailMatic test #' + i,
        html:    '<p>Test email <b>#' + i + '</b> from MailMatic. Gmail API is working ✅</p>',
        from:    FROM_NAME
      });
      Logger.log('  #' + i + '  OK');
    } catch (e) {
      Logger.log('  #' + i + '  FAIL  ' + e.message);
    }
  }

  var after = MailApp.getRemainingDailyQuota();
  Logger.log('MailApp quota AFTER  : ' + after);
  Logger.log('--------------------------------------------');
  Logger.log('Quota consumed : ' + (before - after));
  if (before === after) {
    Logger.log('✅ PASS — quota unchanged. Gmail API path confirmed.');
  } else {
    Logger.log('⚠️  FAIL — quota dropped. Check GCP project attachment and appsscript.json scopes.');
  }
}
