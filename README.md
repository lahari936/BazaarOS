# Bazaar OS

**Your business. Your language. Your intelligence.**

Bazaar OS is a voice-first business operating system for Indian street vendors, vegetable and fruit sellers, and small kirana shops. A vendor says what happened in Telugu, Hindi or English, and Bazaar OS updates stock, the sales ledger, the customer khata and the profit report. Code-mixed speech works too.

Built for the Great Indian AI Internship Challenge by Gnani AI.

## How a voice command works

```
mic (browser, 16 kHz WAV)
  -> POST /api/voice/process (Express)
       -> Gnani Prisma v2.5 STT  (https://api.vachana.ai/stt/v3, server side only)
       -> intent engine (deterministic rules, Telugu / Hindi / English lexicon)
       -> validateCommand(): units, stock, amounts, customer, missing fields
  <- confirmation card (nothing saved yet) + reply text
  -> POST /api/voice/synthesize -> Gnani Timbre v2.5 TTS -> WAV played in browser
  -> user taps Confirm (optionally edits fields)
  -> POST /api/voice/confirm -> ledger.service executes (idempotent) -> MongoDB
  <- spoken result, e.g. "టమాటాలు 20 కిలోలు స్టాక్‌లో చేర్చాను. ఇప్పుడు 32 కిలోలు ఉన్నాయి."
```

The AI layer never writes to the database. It proposes a command. Deterministic backend code validates it, and the vendor confirms it before anything is saved.

## Gnani AI models used

| Model | Use | Where |
|---|---|---|
| **Prisma v2.5** (speech to text) | Transcribes vendor speech. `language_code` is `te-IN`, `hi-IN` or `en-IN`. `format=transcribe` turns spoken numbers into digits ("ఇరవై" becomes "20"). | `server/src/services/prisma.service.js` |
| **Timbre v2.5** (text to speech) | Speaks confirmations and reports. Voices: Lavanya (Telugu), Nalini (Hindi), Kaveri (English). Output is WAV. | `server/src/services/timbre.service.js` |
| Evon v3.3 | **Not used.** No hosted inference endpoint was available to me. Intent extraction is a replaceable rules provider (`intent.service.js`): an LLM provider would return the same `{intent, data}` shape and go through the same `validateCommand()`. | n/a |

The API key lives only on the server (`GNANI_API_KEY`). The browser never calls Gnani directly.

## Supported intents

`PURCHASE`, `SALE`, `EXPENSE`, `CUSTOMER_CREDIT`, `CUSTOMER_PAYMENT`, `INVENTORY_QUERY`, `PROFIT_QUERY`, `DAILY_REPORT`, `UNKNOWN`

Rules the engine follows:
- It never invents a quantity or price. If one is missing, it asks for it in the vendor's language ("మొత్తం ఎంత రూపాయలు?").
- A single unlabeled number fills whichever half is missing, never both.
- "₹30 per kg" is multiplied deterministically by the quantity.
- Grams are converted to kg, and pieces to dozens. Mismatched units are rejected.
- A sale cannot exceed stock. A payment cannot exceed what the customer owes.
- Money a customer owes ("రవి 200 అప్పుగా తీసుకున్నాడు") is recorded. Money the vendor owes others ("నేను అప్పు తీసుకున్నాను") is refused with an explanation, because supplier debt is not tracked yet.
- "10 kg tomatoes 200" with no verb gets the question "Did you buy or sell?".

## Accounting

- **Weighted-average cost.** On each purchase the new average is `(stock × avg + cost) / (stock + qty)`, computed atomically inside MongoDB.
- **COGS** is captured on each sale as `quantity × average cost at the time of sale`.
- **Gross profit = sales revenue − COGS. Net profit = gross profit − operating expenses.** Purchases are not subtracted, because unsold stock stays an asset (shown as inventory value at cost).
- **A credit sale** counts as revenue but not as cash. It raises the customer's receivable. Credit without goods is recorded as a receivable only, not as revenue.
- **Cash received** = cash, UPI and card sales plus customer repayments.

## Reliability

- **Idempotency.** A voice confirm atomically moves the log from `AWAITING_CONFIRMATION` to `CONFIRMING`, and each transaction has a unique `(businessId, idempotencyKey)`. Repeated taps return the original entry. Manual forms send an `Idempotency-Key` header for the same protection.
- **Transactions.** Writes run inside MongoDB transactions on a replica set (Atlas). On a standalone mongod, the ledger runs compensating undos if a later step fails.
- **Errors handled:** no mic permission, no mic, insecure context, silent or too-short recordings, the 30 s Prisma limit, Gnani timeouts, 429s (one retry), network errors, empty transcripts, unknown products, missing fields, insufficient stock, overpayment and duplicate requests. Failed voice commands are kept in the voice history with the error, and the last recording can be retried.
- **Tenant isolation.** Every query is filtered by the signed-in owner's `businessId`.
- **Security:** helmet, CORS allow-list, rate limits (auth 30 per 15 min, voice 30 per min), zod validation on every input, bcrypt-hashed passwords, JWT.

## Run locally

Requirements: Node 20 or later, and MongoDB (local or Atlas).

```bash
# 1. config: copy and fill in (GNANI_API_KEY, MONGO_URI, JWT_SECRET)
cp server/.env.example server/.env

# 2. API
cd server && npm install && npm run seed && npm run dev

# 3. web (new terminal)
cd client && npm install && npm run dev   # http://localhost:5173
```

**Demo shop:** Sri Lakshmi Vegetables (Telugu). Sign in with `demo@bazaaros.test` / `lakshmi-demo-2026`. Running `npm run seed` resets only this demo account. Its history is synthetic and marked `source=SEED`. Today's data starts empty so the live demo shows clean numbers.

**Tests:** `cd server && npm test` runs the intent-engine tests (15 cases: the four demo sentences, missing price, oversell, unit conversion, Hindi credit, payment guard, vendor-debt refusal, expenses, queries, code-mixed speech and buy/sell ambiguity).

## Demo script (Telugu)

1. "ఈరోజు 20 కిలోల టమాటాలు 400 రూపాయలకు కొన్నాను": Purchase, Tomatoes, 20 kg, ₹400, ₹20/kg. Confirm, and stock rises by 20 kg while the average cost updates.
2. "5 కిలోల టమాటాలు 150 రూపాయలకు అమ్మాను": Sale. Confirm, and stock drops by 5 kg. Revenue is ₹150 and COGS is 5 × average cost.
3. "రవి 200 రూపాయలు అప్పుగా తీసుకున్నాడు": Customer credit. Confirm, and Ravi's balance rises by ₹200.
4. "ఈరోజు ఎంత లాభం వచ్చింది?": Telugu spoken report computed from the database.

## Deploy

- **Database:** create a MongoDB Atlas cluster and copy the connection string.
- **API (Render):** `render.yaml` is included. Set `MONGO_URI`, `GNANI_API_KEY` and `CLIENT_URL` (the Vercel URL), then run `npm run seed` once from the Render shell.
- **Web (Vercel):** root directory `client`, environment variable `VITE_API_URL=https://<your-render-app>.onrender.com`. `vercel.json` handles SPA routing.

## What is implemented vs pending

Implemented and verified end to end against the live Gnani APIs and MongoDB:
- Register, login, shop onboarding, JWT sessions
- Telugu speech to Prisma transcript (verified with Timbre-generated Telugu audio sent through the browser's own WAV encoder)
- Structured command, confirmation card, edit, confirm, MongoDB updates, Timbre spoken reply
- All four demo steps, including weighted-average COGS and the Telugu profit report
- Dashboard, inventory CRUD, transactions with filters and manual entry, customer khata with payments and credit, reports with weekly and monthly trends, smart alerts
- Responsive layout with a mobile bottom navigation centred on the mic

Pending or not verified:
- Public deployment (needs your Atlas, Render and Vercel accounts)
- Testing with live human speech on a real phone mic. Automated tests used Timbre-generated speech.
- Supplier credit (money the vendor owes) and multi-item voice commands ("2 kg tomatoes and 1 kg onions")
- Evon reasoning (not available)

## Project structure

```
server/src
  index.js               app, middleware, rate limits
  config.js              env, DB connect, transaction helper
  models.js              User, Business, Product, Customer, Transaction, VoiceLog
  middleware.js          auth, business scoping, validation, errors
  routes/                auth, business (+dashboard/reports/alerts), products, transactions, customers, voice
  services/
    prisma.service.js    Gnani STT
    timbre.service.js    Gnani TTS
    intent.service.js    parse + validate commands (pure)
    lexicon.js           Telugu/Hindi/English words and products
    responses.js         reply templates in 3 languages
    ledger.service.js    the only code that writes money/stock
    reports.service.js   P&L, trends, alerts
  seed.js                demo shop
client/src
  pages/                 Landing, Auth, Onboarding, Dashboard, Voice, Inventory, Transactions, Khata, Reports, Settings
  lib/recorder.js        browser mic to 16 kHz WAV (Prisma does not accept WebM)
```
