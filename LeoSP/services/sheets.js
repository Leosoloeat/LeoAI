'use strict';

// Google Sheets integration — reads customer, appointment, and promotion data.
// Requires GOOGLE_SHEETS_ID in .env and a service account JSON key.
// Set GOOGLE_SERVICE_ACCOUNT_JSON to the path of the key file, or
// set GOOGLE_SERVICE_ACCOUNT_KEY to the JSON content directly (Railway).

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;

function getAuth() {
  const keyContent = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyContent) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  const key = JSON.parse(keyContent);
  return new google.auth.JWT({
    email: key.client_email,
    key:   key.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

/** Get all rows from a named sheet range. */
async function getRange(range) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return res.data.values || [];
}

/** Append a row to a named sheet. */
async function appendRow(sheet, values) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheet}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

/** Active promotions only (is_active=TRUE, end_date >= today). */
async function getActivePromotions() {
  const rows = await getRange('Promotions!A:H');
  if (!rows.length) return [];
  const today = new Date().toISOString().split('T')[0];
  return rows.slice(1).filter(r => r[6] === 'TRUE' && r[5] >= today);
}

/** Save a new customer lead. */
async function saveCustomer({ lineUserId, name, phone, interest, budget, branch, notes }) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  await appendRow('Customers', [timestamp, lineUserId, name, phone, interest, budget, 'new', branch, notes]);
}

/** Save a new appointment. */
async function saveAppointment({ id, name, phone, service, date, time, branch, notes }) {
  await appendRow('Appointments', [id, name, phone, service, date, time, branch, 'FALSE', notes]);
}

module.exports = { getActivePromotions, saveCustomer, saveAppointment, getRange };
