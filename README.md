# ZMAIL Drop

**Fast, free, and public temporary mailboxes — with a full REST API for developers.**

[![Live](https://img.shields.io/badge/live-zmaildrop.vercel.app-55e6ff?style=flat-square)](https://zmaildrop.vercel.app)
[![API](https://img.shields.io/badge/API-v1-8b7cff?style=flat-square)](https://zmaildrop.vercel.app/developers.html)
[![License](https://img.shields.io/badge/license-MIT-4cdda0?style=flat-square)](LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-yes-ffc55a?style=flat-square)](https://github.com/zikky0001-droid/zmaildrop)
[![Built by](https://img.shields.io/badge/built%20by-DEV%20ZIKKY-8b7cff?style=flat-square)](https://github.com/zikky0001-droid/)

A lightweight web app and public API for creating disposable email inboxes — no account, no password, no cost. Built by [DEV ZIKKY 🧑‍💻](https://zmaildrop.vercel.app/owner.html).

</div>

---

## 📖 What is ZMAIL Drop?

ZMAIL Drop gives anyone a fast, ephemeral email address in seconds. It's designed for:

- One-time signups and confirmation codes
- Testing email flows without polluting a real inbox
- Bots and scripts that need to receive messages programmatically
- Anything that shouldn't touch a real email account

There's no account, no login, no tracking. You pick a mailbox name, and the ZMAIL Drop server assigns you an address. Everything is public and free — the whole stack is open source.

---



## 🛠️ Built With

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Font Awesome](https://img.shields.io/badge/Font_Awesome-339AF0?style=for-the-badge&logo=fontawesome&logoColor=white)

---

## 🚢 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zikky0001-droid/zmaildrop)

---

## 📦 How to Deploy

### Option 1 — Deploy with Vercel (Recommended)

The fastest path. No build step required — Vercel just serves the static files and runs your serverless functions.

**Steps:**
```
1. Click the **Deploy with Vercel** button above, or go to [vercel.com/new](https://vercel.com/new) and import `zikky0001-droid/zmaildrop`.
2. Vercel auto-detects the project as a static site + serverless functions.
3. **Before clicking Deploy**, open **Environment Variables** and add the 4 required variables (see the [Configuration](#-configuration) section below).
4. Click **Deploy**.
5. Wait ~40 seconds. Your app is live at `https://<your-project>.vercel.app`.

> ⚠️ **Do not deploy without setting the environment variables first.** The API will return `firebase: "disabled"` and rate limiting will fall back to in-memory only (which doesn't work across serverless instances).
```
---

### Option 2 — Manual Deploy

If you prefer the CLI or a different host.

#### 2.1 — Using the Vercel CLI

```bash
# 1. Clone the repo
git clone https://github.com/zikky0001-droid/zmaildrop.git
cd zmaildrop

# 2. Install Vercel CLI (if not already installed)
npm i -g vercel

# 3. Log in to Vercel
vercel login

# 4. Add your environment variables
vercel env add PROJECT_KEY
vercel env add EMAIL_KEY
vercel env add PRIVATE_KEY
vercel env add CRON_SECRET

# 5. Deploy to production
vercel --prod
```

2.2 — Using Any Static Host (Netlify, Cloudflare Pages, GitHub Pages)
```
ZMAIL Drop is a plain static site with serverless functions. The frontend works on any host, but the /api/v1/* endpoints require Vercel (or a Node-compatible serverless runtime).

If you only need the frontend:

· Upload everything inside public/ to your host
· Make sure vercel.json and package.json are at the repo root
· Point your DNS or subdomain at the host

Note: Without Vercel, the API endpoints won't run — you'd need to host them elsewhere (Cloudflare Workers, Netlify Functions, etc.) and update the frontend URLs accordingly.
```
---

⚙️ Configuration

`ZMAIL Drop needs Firebase (for rate limiting + stats) and a cron secret (for the daily cleanup). This section walks you through getting each one.`

Step 1 — Create a Firebase Project
```
1. Go to console.firebase.google.com
2. Click Add project
3. Give it a name (e.g. zmaildrop-prod)
4. Disable Google Analytics (optional)
5. Click Create project and wait for it to finish
```

`Step 2 — Enable Firestore`

```
1. In the Firebase Console, open your new project
2. Left sidebar → Build → Firestore Database
3. Click Create database
4. Choose Production mode (recommended — locks down access by default; your backend uses the Admin SDK which bypasses rules)
5. Pick a location close to your users (e.g. nam5 for US, europe-west1 for Europe, asia-south1 for India)
6. Click Enable
```

⚠️ Location cannot be changed later. Pick carefully.

`Step 3 — Generate a Service Account Key`

```
1. In the Firebase Console, click the ⚙️ gear icon next to Project Overview
2. Go to Project settings → Service accounts tab
3. Make sure Firebase Admin SDK is selected
4. Click Generate new private key
5. Confirm — a JSON file downloads to your machine
```

Open the JSON file. It contains everything you need:

```json
{
  "type": "service_account",
  "project_id": "zmaildrop-prod",
  "private_key_id": "abc...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAAS...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@zmaildrop-prod.iam.gserviceaccount.com",
  "client_id": "1234567890",
  ...
}
```
```
From this file, copy three values:

What you need Which field in the JSON
Firebase Project ID project_id
Service Account Email client_email
Private Key private_key (the whole value, including -----BEGIN... and ...END-----)
```

`Step 4 — Generate the Cron Secret`

Run this in Termux (or any terminal):

```bash
echo "zmaildrop$(openssl rand -hex 12 | cut -c1-23)"
```

Example output:

```
zmaildropa3f8c2b9d1e6f4a7c8b2d5e
```

Save this — you'll need it in the next step.

`Step 5 — Set Environment Variables`

You now have 4 values ready:

```
PROJECT_KEY=<project_id from Firebase JSON>
EMAIL_KEY=<client_email from Firebase JSON>
PRIVATE_KEY=<private_key from Firebase JSON>
CRON_SECRET=<the random string you just generated>
```

`🅰️ If deploying on Vercel (recommended)`
```
1. In your Vercel project, open Settings → Environment Variables
2. Add each of the 4 variables:
   · Name: PROJECT_KEY — Value: your project ID
   · Name: EMAIL_KEY — Value: your service account email
   · Name: PRIVATE_KEY — Value: the full private key
   · Name: CRON_SECRET — Value: your random secret
3. For each, tick Production, Preview, and Development
4. Click Save for each one
5. Go to Deployments → click the latest → Redeploy

⚠️ For PRIVATE_KEY, paste the value with the literal \n characters as text. Do NOT press Enter to make real newlines. The code converts \n to real line breaks automatically.
```

`🅱️ If using GitHub Environment Variables (only for private repos)`
```
If your repo is private and you want CI/CD to inject secrets at build time:

1. In GitHub, go to Settings → Secrets and variables → Actions
2. Click New repository secret for each:
   · PROJECT_KEY → your project ID
   · EMAIL_KEY → your service account email
   · PRIVATE_KEY → the full private key
   · CRON_SECRET → your random secret
3. Reference them in any .github/workflows/*.yml file using ${{ secrets.PROJECT_KEY }}
```

⚠️ Never use GitHub secrets on a public repo. Even though GitHub hides them from public view, forks and logs can leak them. If your repo is public, set env vars ONLY in Vercel.

`Step 6 — Verify the Deployment`

Once deployed, test the health endpoint:

```bash
curl -s "https://<your-project>.vercel.app/api/v1/health" | jq
```

You want to see:

```json
{
  "ok": true,
  "data": {
    "service": "ZMAIL Drop API",
    "version": "v1",
    "status": "online",
    "firebase": "connected",   ← ⬅ this is the important one
    ...
  }
}
```
```
If firebase shows "disabled", one of your 3 Firebase env vars is missing or misformatted. The most common issue is the PRIVATE_KEY — make sure it:

· Includes -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----
· Keeps the \n as literal text (no real newlines)
· Is not wrapped in quotes
```
Step 7 — Enable the Daily Cleanup Cron

The project ships with a cron job in vercel.json:

```json
{
  "crons": [
    { "path": "/api/v1/cleanup", "schedule": "0 23 * * *" }
  ]
}
```

This fires every day at 23:00 UTC = 00:00 Lagos (WAT). Vercel automatically sends the CRON_SECRET header — you don't need to do anything.

To test it manually:

```bash
curl -s -H "Authorization: Bearer <your CRON_SECRET>" \
  "https://<your-project>.vercel.app/api/v1/cleanup" | jq
```

Expected response:

```json
{
  "ok": true,
  "data": {
    "cleaned": 12,
    "batches": 1,
    "collection": "rate_limits",
    "note": "stats/global and system/upstream_lock were NOT touched."
  }
}
```

---

🧾 Environment Variables at a Glance
`
Variable Where it comes from What it does
PROJECT_KEY Firebase JSON → project_id Identifies your Firebase project
EMAIL_KEY Firebase JSON → client_email Service account that writes to Firestore
PRIVATE_KEY Firebase JSON → private_key Authenticates the service account
CRON_SECRET Generated with openssl Protects /api/v1/cleanup from abuse
`
Where to set them:
```
Deployment Where env vars go
Vercel (any repo) Vercel → Settings → Environment Variables ✅
GitHub (private repo only) GitHub → Settings → Secrets and variables
GitHub (public repo) ❌ Never use GitHub secrets — Vercel only
Local development .env file (gitignored)

```

## ✨ Features

### For users
- **Instant inboxes** — pick a name, get an address, done
- **Live mailbox view** — messages appear within a few seconds
- **Rich email rendering** — inline images resolved, HTML bodies displayed in a sandboxed iframe
- **Attachment downloads** — every file attached to a message, one click away
- **Full message export** — download the entire raw email as `.eml`
- **Zero setup** — no account, no password, no profile
- **Mobile-friendly** — works on phones, tablets, and desktops
- **Custom 404 page** — built in ZMAIL Drop's brand style

### For developers
- **REST API** — 4 clean endpoints, JSON responses
- **No authentication** — no signup, no API key
- **Rate limited** — 30 requests/minute per IP, fair use enforced
- **Global throttle** — upstream calls never overlap
- **In-memory caching** — 3-second TTL on inbox and message reads
- **CID resolution** — inline images automatically resolved
- **Attachment detection** — flags and pre-extracted data
- **CORS enabled** — call from any browser origin

---

## 🚀 Quick Start

### For users

1. Visit **[zmaildrop.vercel.app](https://zmaildrop.vercel.app)**
2. Click **Open a mailbox**
3. Type a name like `myname123`
4. Your address becomes `myname123@maildrop.cc`
5. Send anything to that address — it appears in your inbox

### For developers

```bash
# List messages in a mailbox
curl -s "https://zmaildrop.vercel.app/api/v1/inbox?mailbox=myname123" | jq

# Read a single message
curl -s "https://zmaildrop.vercel.app/api/v1/message?mailbox=myname123&id=abc123" | jq

# Delete a message
curl -s -X DELETE "https://zmaildrop.vercel.app/api/v1/message?mailbox=myname123&id=abc123" | jq
```

Full API docs: zmaildrop.vercel.app/developers.html

---

🛠️ Tech Stack

Layer Technology
Frontend Vanilla HTML, CSS, JavaScript
Backend Node.js serverless functions
Hosting Vercel
Database Firebase Firestore (rate limits, stats)
Caching In-memory (per serverless instance)
Upstream ZMAIL Drop mail server
Fonts Inter, Space Grotesk
Design Custom dark glass aesthetic

No frameworks. No build step. Just fast, hand-written code.

---

👨‍💻 About the Developer

Dev Zikky is a full-stack developer, builder, and problem-solver from Nigeria. He builds tools that solve real problems — usually from a phone, in Termux, at odd hours. His work spans AI chat assistants, email infrastructure, manga readers, Telegram and WhatsApp bots, and cybersecurity awareness projects.

Philosophy:

"Innovation is not about having all the answers — it's about asking the right questions."

Every project starts the same way: notice something annoying or missing, then build the fix. ZMAIL Drop, ZIKKY AI, Manga Hub, ZQUOTE, and ZMAIL Studio all began as personal needs that turned into public tools.

· 🌐 Portfolio: zikkytech.xo.je
· 👤 About: zmaildrop.vercel.app/owner.html

---

🌟 Other Projects by Dev Zikky

If you like ZMAIL Drop, here's what else is in the workshop:

🤖 ZIKKY AI — zikkyai.xo.je

A free AI chat platform. Talk to capable AI models, get coding help, and use features like text-to-speech — all in one place. Create a free account and start chatting. Powered by multi-model orchestration (Gemini, DeepSeek, Meta AI).

📧 ZMAIL Studio — zmail.zone.id

Where ZMAIL Drop receives, ZMAIL Studio sends. A beautiful workspace for crafting polished personal emails — 7 reusable templates, a rich editor, live preview, and a server-side sending API. Credentials stay on the server, never in the browser.

📚 ZIKKY Manga Hub — zikkymangahub.onrender.com

A free manga reading site with a clean reader, downloads, and bookmarking — built for readers who want a premium-feeling experience without the paywalls.

💬 ZQUOTE — zquote-tau.vercel.app

A Telegram-style quote generator API. Send a username, message, and optional avatar, and get back a rendered, shareable quote image hosted on a CDN. Includes a live preview tester and copy-paste examples for cURL, JavaScript, and Python.

```📮 ZDropMail — zdropmail.vercel.app```

```A separate temporary mailbox service with a different workflow. Where ZMAIL Drop focuses on public, name-your-own inboxes, ZDropMail generates private mailboxes with short lifetimes — perfect when you want something that isn't publicly discoverable by name.```
```
Why two services? Different needs. ZMAIL Drop is fast, public, and name-based (great for quick sign-ups). ZDropMail is private, generated, and lifetime-bound (better for sensitive sign-ups where you don't want anyone guessing your address).
```
🌐 ZIKKY Tech Portfolio — zikkytech.xo.je
```
The complete catalogue of everything Dev Zikky builds — ZIKKY AI v1 & v2, the matrix calculator, Telegram bots, the API gateway, and all projects in development.
```
---

💖 Support the Project

ZMAIL Drop is free forever and runs on generosity. Every dollar helps pay for:
```
· Vercel hosting (serverless function invocations)
· Firebase Firestore reads/writes (rate limiting + stats)
· Domain renewal
· Coffee for late-night debugging sessions ☕
```
If the service has been useful to you — whether for one signup or a hundred — consider buying Dev Zikky a coffee to keep it alive for everyone.

How to donate

Contact the developer directly to arrange a donation or sponsorship:

```
· 👤 Owner page: zmaildrop.vercel.app/owner.html
· 💬 GitHub: @zikky0001-droid
· 🌐 Portfolio: zikkytech.xo.je
```

Why contact directly? It keeps costs low (no payment processor fees) and lets you ask questions, suggest features, or sponsor a specific improvement.

Not able to donate?

You can still help a lot:

· ⭐ Star the GitHub repo — signals it's worth maintaining
· 🐛 Report bugs — makes the service better for everyone
· 📣 Share it with friends, forums, or developer communities
· 💡 Suggest features — many are built on user requests
· ✍️ Write about it — blog posts and mentions help visibility

---

📁 Project Structure

```
zmaildrop/
├── api/
│   ├── maildrop.js             # Internal proxy for the frontend
│   └── v1/
│       ├── utils.js            # Shared helpers (Firebase, rate limit, cache)
│       ├── health.js           # GET    /api/v1/health
│       ├── inbox.js            # GET    /api/v1/inbox?mailbox=:name
│       ├── message.js          # GET / DELETE /api/v1/message?mailbox=:name&id=:id
│       └── cleanup.js          # Cron-triggered rate-limit wipe
├── public/
│   ├── index.html              # Homepage
│   ├── login.html              # Mailbox picker
│   ├── inbox.html              # Message list
│   ├── view.html               # Message viewer
│   ├── owner.html              # Developer page
│   ├── developers.html         # Public API documentation
│   ├── 404.html                # Custom not-found page
│   ├── script.js               # Frontend logic
│   ├── style.css               # Global styles
│   └── js/
│       ├── clock.js            # Lagos time ticker
│       ├── hamburger.js        # Mobile menu
│       └── ui.js               # Scroll reveal, counters, etc.
├── .env.example                # Environment template
├── .gitignore
├── LICENSE
├── README.md
├── package.json
└── vercel.json
```

---

🔌 Public API (v1)

`Base URL: https://zmaildrop.vercel.app/api/v1`
```
Method Endpoint Description
GET /health Service status, uptime, lifetime request count
GET /inbox?mailbox=:name List all messages in a mailbox
GET /message?mailbox=:name&id=:id Read one message (HTML + raw MIME)
DELETE /message?mailbox=:name&id=:id Delete one message
```
Response envelope

Every response is JSON. Success responses have ok: true and a data field. Errors have ok: false and an error object.

```json
{
  "ok": true,
  "data": { ... },
  "meta": {
    "request_id": "req_b41o301d",
    "timestamp": "2026-09-22T16:25:10.193Z",
    "rate": { "limit": 30, "remaining": 29 }
  }
}
```

Rate limits
`
· 30 requests / minute per IP
· Exceeding the limit blacks out your IP for 5 minutes
· Every response includes standard X-RateLimit-* headers
· 429 responses include Retry-After
`
Error codes
```
Code Status Meaning
MISSING_MAILBOX 400 The mailbox parameter was omitted
MISSING_ID 400 The id parameter was omitted
INVALID_MAILBOX 400 Mailbox name failed validation
INVALID_ID 400 Message ID failed validation
MESSAGE_NOT_FOUND 404 Message doesn't exist or expired
METHOD_NOT_ALLOWED 405 Wrong HTTP verb
RATE_LIMITED 429 30 req/min exceeded
IP_BLACKLISTED 429 IP temporarily blocked
UPSTREAM_BUSY 503 Server queue is full
UPSTREAM_ERROR 502 ZMAIL Drop mail server failed
```
---

🧠 How It Works

Frontend flow

1. User picks a mailbox name (login.html)
2. App redirects to /inbox?mailbox=<name>
3. script.js calls /api/maildrop?action=inbox&mailbox=<name>
4. Messages render as cards with View and Delete buttons
5. Clicking View loads /view?mailbox=<name>&id=<id>
6. The message viewer fetches the raw email and renders it inside a sandboxed iframe

Backend flow
```
1. Every request hits a Vercel serverless function
2. utils.js checks rate limits, cache, and the global throttle
3. If cache misses, the request is proxied to the ZMAIL Drop mail server
4. Results are cached in memory for 3 seconds
5. Errors bubble up with clean JSON messages
```


Rate limiting
`
· First 5 requests per IP hit only the in-memory counter
· Requests 6+ trigger a Firestore transaction for shared state
· Over 30/min → blacklisted in Firestore for 5 minutes
· Cleanup cron wipes rate_limits/ every day at 00:00 Lagos time
`
Upstream throttling
`
The ZMAIL Drop mail server is called at most once every 750 ms globally. This is enforced with a Firestore lock that all serverless instances share — so even if 10 users request at once, only 1 upstream call goes out per 750 ms window. The others wait and then read the fresh cache.`

---

🔐 Environment Variables

`Copy .env.example to .env and fill in:`
`
Variable Description
PROJECT_KEY Firebase project ID
EMAIL_KEY Firebase service account email
PRIVATE_KEY Firebase service account private key (with literal \n)
CRON_SECRET Secret for authenticating the cleanup cron
`

For production on Vercel, set these in Settings → Environment Variables. Do NOT commit your .env file.

Generating CRON_SECRET

```bash
echo "zmaildrop$(openssl rand -hex 12 | cut -c1-23)"
```

---

🚢 Deployment

`Deploy to Vercel`
```
https://vercel.com/button

1. Fork this repository
2. Import it into Vercel
3. Add the 4 environment variables
4. Deploy — Vercel builds nothing, just serves the static files and functions
```
Local development

```bash
# Install the Vercel CLI
npm i -g vercel

# Clone
git clone https://github.com/zikky0001-droid/zmaildrop.git
cd zmaildrop

# Copy env template
cp .env.example .env
# Then edit .env

# Run locally
vercel dev
```

The dev server runs at http://localhost:3000.

---

🔒 Security
```
· No user data stored — mailboxes are anonymous and public
· No cookies, no tracking — the app is stateless
· Sandboxed iframes — email HTML renders with sandbox and no script execution
· Firestore TTL — stale rate-limit docs are wiped daily by the cleanup cron
· Secrets stay on the server — the Firebase private key never reaches the browser
· Rate limits enforced — abuse protection at both the IP and upstream levels
```
---

🤝 Contributing

This project is open source and contributions are welcome.

```bash
# 1. Fork the repo
# 2. Create a feature branch
git checkout -b feature/my-improvement

# 3. Make your changes
# 4. Test locally with `vercel dev`
# 5. Commit and push
git commit -m "Add my improvement"
git push origin feature/my-improvement

# 6. Open a Pull Request
```

Guidelines

· Keep the stack minimal — no frameworks
· Maintain the visual identity (colors, fonts, glass cards)
· Test on mobile before submitting
· Update developers.html if you add or change any API endpoint

---

📜 License

MIT — see LICENSE for details.

You're free to fork, modify, self-host, and redistribute. Attribution appreciated but not required.

---

🙏 Credits
```
Built and maintained by Dev Zikky — zikkytech.xo.je

· Design & code: Dev Zikky
. Organization: DEV ZIKKY TECH 
· API infrastructure: Vercel serverless functions
· Persistent state: Firebase Firestore
· Upstream mail service: ZMAIL Drop mail server
```
---

📬 Contact & Links
```
Web links ♥️

🌐 Homepage zmaildrop.vercel.app
📖 API Docs zmaildrop.vercel.app/developers.html
👤 About Dev Zikky zmaildrop.vercel.app/owner.html
💻 GitHub github.com/zikky0001-droid/zmaildrop
🌟 Portfolio zikkytech.xo.je
🤖 ZIKKY AI zikkyai.xo.je
📧 ZMAIL Studio zmail.zone.id
📚 Manga Hub zikkymangahub.onrender.com
💬 ZQUOTE zquote-tau.vercel.app
📮 ZDropMail zdropmail.vercel.app
```
---

<div align="center">

⭐ If ZMAIL Drop helped you, consider starring the repo or contacting the developer to support its upkeep.

ZMAIL Drop — Simple temporary mail access.

Built with ☕ and 🌙 by Dev Zikky from Lagos, Nigeria 🇳🇬

</div>


