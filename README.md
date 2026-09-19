# MailMatic

Send **500 personalised emails/day** from Google Sheets — free, open source, no third-party subscriptions.

MailMatic routes mail through the **Gmail REST API** (not Apps Script's built-in `MailApp`), so you get Gmail's real send limit (~500/day on free accounts, ~2000/day on Workspace) instead of the 100/day Apps Script cap.

---

## Features

- **500 emails/day** via Gmail API
- **Mail merge** — Name, Designation, Company, and any column you add
- **Auto-resume** — writes status per row; restarts skip already-sent rows
- **Self-scheduling** — continues past Apps Script's 6-minute execution limit
- **Dry run** — preview merged output before sending anything
- **No external server** — runs entirely inside your own Google Cloud project

---

## Sheet format

Your active sheet must have these columns in order (Row 1 = header):

| A: Name | B: Designation | C: Company | D: Recipient | E: Merge status | F: Note |
|---------|---------------|------------|--------------|-----------------|---------|
| Alex Smith | Product Manager | Acme Corp | alex@acme.com | | |

- **Name** — recipient first name (used in salutation)
- **Designation** — their job title (available as a merge tag if you want to personalise further)
- **Company** — company name (used in body if needed)
- **Recipient** — email address to send to
- **Merge status** — written by the script: `sent`, `error (message)`, `SKIP (daily cap)`
- **Note** — optional, not used by script

---

## Setup

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** → name it anything (e.g. `mail-merge-tool`)
3. Note the **Project number** (12-digit, shown on the project dashboard)
4. In the left sidebar → **APIs & Services → Library** → search **Gmail API** → Enable it
5. Go to **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `MailMatic` (or your name)
   - User support email: your Gmail address
   - Developer contact: your Gmail address
   - Save and continue through all steps (no need to add scopes here)

### Step 2 — Attach the Cloud project to Apps Script

1. Open your Google Sheet → **Extensions → Apps Script**
2. In Apps Script: **Project Settings** (gear icon) → scroll to **Google Cloud Platform (GCP) Project**
3. Click **Change project** → enter your 12-digit project number → click **Set project**

### Step 3 — Add the files

In Apps Script editor:

1. Click the **+** next to Files → choose **Script** if adding a new file, or replace the contents of `Code.gs`
2. Replace `appsscript.json` contents (click the gear icon → tick "Show `appsscript.json` manifest file")
3. Paste both files from this repo:
   - `appsscript.json` → replace the entire manifest (Apps Script will auto-update the timezone to match your account)
   - `SendEngine.gs` → paste into `Code.gs` (or a new script file)

### Step 4 — Configure the script

At the top of `SendEngine.gs`, set your own values:

```javascript
var SHEET_NAME    = 'Sheet1';       // tab name in your spreadsheet
var SUBJECT       = 'Your subject line here';
var FROM_NAME     = 'Your Name';
var DAILY_CAP     = 450;            // keep below 500 for safety
```

Update `buildHtmlBody_(name, designation, company)` with your actual email body HTML.

### Step 5 — Test

1. In Apps Script: select `dryRun` from the function dropdown → **Run**
2. Open **Execution log** — you should see the first 3 emails rendered with merge tags filled in and a confirmation that nothing was sent
3. When satisfied, select `sendAll` → **Run**
4. Google will ask for OAuth permissions on first run — approve them
5. Check the **Merge status** column in your sheet for progress

---

## Functions

| Function | What it does |
|----------|-------------|
| `dryRun()` | Renders first 3 merged emails in logs. Sends nothing. |
| `sendFirstN()` | Sends to the first 5 rows (for a quick real test). |
| `sendAll()` | Sends to all rows with blank Merge status, respecting DAILY_CAP. Self-resumes past the 6-min limit. |

---

## How the 500/day cap works

Apps Script's `MailApp` and `GmailApp` share a quota of ~100 emails/day on free accounts. MailMatic calls the **Gmail REST API** via `UrlFetchApp`, which uses Gmail's actual send quota (~500/day free, ~2000/day Workspace). The two pools are independent — you can confirm this with the `testSend()` function, which checks that `MailApp.getRemainingDailyQuota()` doesn't decrease after API sends.

---

## OAuth scopes used

```json
"https://www.googleapis.com/auth/gmail.send"
"https://www.googleapis.com/auth/script.external_request"
"https://www.googleapis.com/auth/userinfo.email"
"https://www.googleapis.com/auth/spreadsheets.currentonly"
"https://www.googleapis.com/auth/script.scriptapp"
"https://www.googleapis.com/auth/script.container.ui"
```

`gmail.send` is a **Sensitive** scope (not Restricted), so Google's verification review is free and typically takes 4–6 weeks. No CASA security audit required.

---

## License

MIT — use, fork, and modify freely.

---

## Contact

Rushil Arora · [rxshxl100@gmail.com](mailto:rxshxl100@gmail.com) (for bugs, questions, or OAuth verification enquiries)
