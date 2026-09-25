# Telegram receipt bot

Users send receipts to a Telegram bot. The backend handles each message like this:

| Message | What happens | Reply |
| ------- | ------------ | ----- |
| **Text** | Claude reads it and adds a row to the `Receipts` tab of a Google Sheet (date, merchant, category, items, subtotal, tax, discount, total, currency, payment method, notes, and the original text). | A preview of the fields it read |
| **Photo / file** | Saved as-is to a Google Drive folder, and logged as a row in the `Files` tab. | File name, size, caption, and a Drive link |

Code: `backend/src/py/app/domain/telegram/`. Telegram calls
`POST /api/telegram/webhook`. The endpoint replies right away and does the work
in the background, so Telegram doesn't retry.

## Cost

- Telegram Bot API, Google Sheets API and Google Drive API are free. Files use
  your Google account's 15 GB of storage.
- The Claude API is paid per use, and only text messages call it. A typical
  receipt costs about $0.01 on the default `claude-opus-5`. To pay less, set
  `TELEGRAM_AI_MODEL=claude-haiku-4-5` (about $0.002 per receipt).

## Setup

### 1. Create the bot

1. In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`,
   and follow the prompts.
2. Copy the token it gives you. This is `TELEGRAM_BOT_TOKEN`.

### 2. Get a Claude API key

Create a key at [platform.claude.com](https://platform.claude.com) and add
some credit. This is `ANTHROPIC_API_KEY`.

### 3. Google OAuth client (one time, free, no billing needed)

The bot saves files as **your own Google account**. A service account has no
Drive storage, so it can't own uploaded files.

1. At [console.cloud.google.com](https://console.cloud.google.com), create a
   project.
2. **APIs & Services → Library**: enable the **Google Sheets API** and the
   **Google Drive API**.
3. **Google Auth Platform → Audience**:
   1. Choose **External**.
   2. Add yourself as a test user.
   3. Click **Publish app** so the status is **In production**. While the
      status is "Testing", refresh tokens expire after 7 days and the bot stops
      working. You don't need Google's verification for your own use. You'll
      just see an "unverified app" warning when you log in.
4. **Clients → Create client**, type **Desktop app**. Copy the client ID and
   secret. These are `GOOGLE_API_CLIENT_ID` and `GOOGLE_API_CLIENT_SECRET`.

### 4. Log in once and create the Sheet + folder

Run this on your own computer, because it opens a browser:

```bash
cd backend
export GOOGLE_API_CLIENT_ID=...  GOOGLE_API_CLIENT_SECRET=...
uv run app telegram google-auth
```

It does three things:

- creates a spreadsheet with `Receipts` and `Files` tabs and header rows
- creates a Drive folder
- prints `GOOGLE_API_REFRESH_TOKEN`, `GOOGLE_SHEET_ID` and
  `GOOGLE_DRIVE_FOLDER_ID`

The bot uses the narrow `drive.file` scope, so it can only see files it
created itself. For that reason, let this command create the Sheet and folder
rather than pointing it at existing ones.

### 5. Configure the server

Set these on the Render service. They're already listed in `render.yml`.

| Variable | Value |
| -------- | ----- |
| `TELEGRAM_BOT_TOKEN` | from step 1 |
| `TELEGRAM_WEBHOOK_SECRET` | any random string (Render generates one) |
| `TELEGRAM_ALLOWED_CHAT_IDS` | comma-separated chat IDs allowed to use the bot |
| `TELEGRAM_AI_MODEL` | optional, default `claude-opus-5` |
| `ANTHROPIC_API_KEY` | from step 2 |
| `GOOGLE_API_CLIENT_ID`, `GOOGLE_API_CLIENT_SECRET` | from step 3 |
| `GOOGLE_API_REFRESH_TOKEN`, `GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_FOLDER_ID` | from step 4 |

To find your chat ID, deploy first and then send `/start` to the bot. It
replies with your chat ID. Add that to `TELEGRAM_ALLOWED_CHAT_IDS`. Other
people are refused until their chat ID is added.

### 6. Point Telegram at the server

Use the same token and secret as the server:

```bash
cd backend
export TELEGRAM_BOT_TOKEN=...  TELEGRAM_WEBHOOK_SECRET=...
uv run app telegram set-webhook --base-url https://pos-backend.onrender.com
```

Send the bot a receipt to test it.

## Notes

- Telegram bots can only download files up to **20 MB**.
- Free Render instances sleep when idle, so the first message after a quiet
  period may take up to a minute to get a reply. Telegram keeps retrying until
  the server wakes up.
- If Claude can't read a message, the row is still saved with the original
  text, so nothing is lost.
