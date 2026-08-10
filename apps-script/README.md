# Wiring the app to the live inventory sheet

This makes the React app read live stock from the "Alitaflow Daily Sales" sheet
and deduct stock when a sale is made, by appending a row to the sheet's
"Form Responses" tab — the same thing that happens when the linked Google
Form is submitted. It never writes to the formula-driven Sold/Remaining
columns directly.

## 1. Open the Apps Script editor

In the spreadsheet: **Extensions → Apps Script**.

## 2. Paste the code

Delete whatever is in `Code.gs` and paste in the contents of
[`Code.gs`](./Code.gs) from this folder.

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, then **Authorize access** and approve the permissions
   (it needs edit access to this spreadsheet).
5. Copy the **Web app URL** it gives you — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

## 4. Give the app that URL

Paste the URL into `src/config.js` as `INVENTORY_API_URL`.

## Redeploying after edits

If you ever change `Code.gs`, you must create a **new deployment** (or
"Manage deployments" → edit → new version) for changes to take effect on
the existing URL.
