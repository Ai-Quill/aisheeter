<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Vercel_AI_SDK-6-black?style=for-the-badge" alt="Vercel AI SDK" />
  <img src="https://img.shields.io/badge/Google_Apps_Script-GAS-4285F4?style=for-the-badge&logo=google" alt="Google Apps Script" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">AISheeter</h1>

<h3 align="center">Open-source Google Sheets add-on with multi-model AI support.<br/>Use ChatGPT, Claude, Gemini, and Groq directly in your spreadsheet.</h3>

<p align="center">
  <a href="https://www.aisheeter.com">Website</a> &middot;
  <a href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853">Install from Marketplace</a> &middot;
  <a href="#self-hosting">Self-Host Guide</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

## What is this?

AISheeter is a Google Sheets add-on that connects your spreadsheet to any major AI model through your own API keys. This repository contains the **complete frontend** (Google Apps Script sidebar) and the **core backend** (Next.js API server) — everything you need to self-host your own AI-powered spreadsheet tool.

**Bring Your Own Keys (BYOK)** — your API keys are encrypted client-side before they ever leave the browser. The server never sees plaintext keys.

### What you can do with this

- Query any AI model (GPT-4o, Claude Sonnet, Gemini, Llama, DeepSeek) from a spreadsheet cell
- Bulk-process hundreds of rows with AI
- Save and reuse prompt templates
- Generate images from descriptions
- Use custom formulas like `=ChatGPT("summarize this")` (with your own API key)
- Full Stripe integration for monetization if you want to build a SaaS

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Google Sheets                     │
│  ┌───────────────────────────────────────────┐  │
│  │         AISheeter Sidebar (GAS)           │  │
│  │  • Model selector     • Prompt manager    │  │
│  │  • API key encryption • Formula engine    │  │
│  │  • Sheet actions      • Bulk processing   │  │
│  └──────────────────┬────────────────────────┘  │
└─────────────────────┼───────────────────────────┘
                      │ HTTPS (encrypted keys)
                      ▼
┌─────────────────────────────────────────────────┐
│            Next.js Backend (Vercel)              │
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐  │
│  │  /api/query  │  │ /api/    │  │ /api/     │  │
│  │  AI routing  │  │ models   │  │ stripe    │  │
│  └──────┬──────┘  └──────────┘  └───────────┘  │
│         │                                        │
│  ┌──────▼──────────────────────────────────┐    │
│  │  Vercel AI SDK 6 (unified provider)     │    │
│  └──────┬──────────┬───────────┬───────────┘    │
└─────────┼──────────┼───────────┼────────────────┘
          ▼          ▼           ▼
      ┌───────┐  ┌───────┐  ┌───────┐
      │OpenAI │  │Claude │  │Gemini │  ...
      └───────┘  └───────┘  └───────┘
```

**Frontend** (`frontend/`): Full Google Apps Script codebase — sidebar UI, formula catalogs, sheet actions, prompt management, API key encryption, bulk processing UI.

**Backend** (`backend/`): Next.js 16 API server — multi-model AI routing via Vercel AI SDK 6, user management, Stripe payments, rate limiting, Neon PostgreSQL database.

---

## Self-Hosting

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database (free tier works)
- API keys for at least one AI provider (OpenAI, Anthropic, Google, or Groq)
- A Google account (for Apps Script deployment)
- Optional: [Vercel](https://vercel.com) account for deployment, [Stripe](https://stripe.com) for payments

### 1. Deploy the Backend

```bash
# Clone the repo
git clone https://github.com/Ai-Quill/aisheeter-opensource.git
cd aisheeter-opensource/backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URL, encryption salt, etc.

# Run database migrations
# Connect to your Neon database and run:
# psql $NEON_DB_URL -f supabase/migrations/001_core_tables.sql

# Start development server
npm run dev
```

**Deploy to Vercel** (recommended for production):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Ai-Quill/aisheeter-opensource/tree/main/backend)

### 2. Deploy the Frontend

```bash
cd frontend

# Install Google's clasp CLI
npm install -g @google/clasp

# Login to your Google account
clasp login

# Create a new Apps Script project bound to a Google Sheet
# Or use an existing one — update .clasp.json with your scriptId
clasp create --type sheets --title "AISheeter"

# Edit Config.gs to point to your backend URL
# Change PROD_BASE_URL to your deployed backend URL

# Push the code
clasp push

# Open the script in browser to set up triggers
clasp open
```

### 3. Configure

1. Open any Google Sheet
2. Go to **Extensions > AISheeter**
3. Enter your AI provider API key in Settings
4. Start querying

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Google Apps Script | Sidebar UI, sheet operations, formula engine |
| **Backend** | Next.js 16 + App Router | API server, SSR landing page |
| **AI** | Vercel AI SDK 6 | Unified multi-provider interface |
| **Database** | Neon PostgreSQL | User data, settings, usage tracking |
| **Payments** | Stripe | Subscription management, webhooks |
| **Security** | AES encryption + CORS + rate limiting | API key protection |
| **Hosting** | Vercel | Serverless deployment |

---

## Project Structure

```
frontend/                          # Google Apps Script (complete)
├── Code.gs                        # Entry point, menu, sidebar
├── Agent*.gs                      # AI agent modules
├── AgentTaskChain_*.gs            # Multi-step workflow engine
├── SheetActions_*.gs              # Sheet operations (charts, format, filter, etc.)
├── FormulaCatalog_*.gs            # 200+ Google Sheets formula definitions
├── FormulaEngine.gs               # Formula composition engine
├── Crypto.gs                      # Client-side AES encryption
├── SecureRequest.gs               # Encrypted API key transport
├── Sidebar*.html                  # Modular sidebar UI (34 HTML modules)
└── appsscript.json                # GAS manifest

backend/                           # Next.js API server (core)
├── src/
│   ├── app/api/
│   │   ├── query/                 # Main AI query endpoint
│   │   ├── models/                # List available AI models
│   │   ├── generate-image/        # DALL-E / Imagen generation
│   │   ├── stripe/                # Checkout, webhooks, portal
│   │   ├── get-or-create-user/    # User management
│   │   ├── save-api-key/          # Encrypted key storage
│   │   ├── prompts/               # Saved prompt templates
│   │   └── usage/                 # Usage tracking
│   ├── lib/
│   │   ├── ai/                    # Model registry, provider factory
│   │   ├── auth/                  # Authentication, feature gating
│   │   ├── security/              # CORS, rate limiting, validation
│   │   ├── stripe/                # Stripe client, tier config
│   │   └── db.ts                  # Neon PostgreSQL client
│   ├── components/                # React landing page components
│   └── pages/                     # Marketing pages
└── .env.example                   # Documented environment variables
```

---

## Features

### Multi-Model AI Support
Switch between providers with a single dropdown. Currently supports:
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-5.4, o3, o4-mini
- **Anthropic**: Claude Sonnet 4.6, Claude Haiku
- **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash
- **Groq**: Llama 3.3, DeepSeek R1
- **More**: Easy to add via the model registry

### Client-Side Key Encryption
API keys are AES-encrypted in the browser before being sent to the server. The server stores and transmits only ciphertext. See `frontend/Crypto.gs` and `frontend/SecureRequest.gs`.

### Formula Catalogs
200+ Google Sheets formulas organized by category (math, text, lookup, date, financial, engineering, array, logic, Google-specific). The formula engine can compose complex formulas from natural language descriptions.

### Stripe Integration
Complete payment flow: checkout sessions, webhook handling, customer portal, tier-based feature gating. See `backend/src/lib/stripe/` and `backend/src/app/api/stripe/`.

### Rate Limiting
Per-user rate limiting via Upstash Redis with graceful fallback. See `backend/src/lib/security/rate-limit.ts`.

---

## The Full Product

This open-source version gives you a solid foundation for AI in Google Sheets. The **full AISheeter** product (available on the [Google Workspace Marketplace](https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853)) adds:

- **AI Agent with Multi-Step Chains** — "Build me a 12-month financial model with break-even analysis" executes as a single command with layout planning, data generation, formulas, formatting, and charts
- **10 Specialized Skills** — Charts, formatting, conditional formatting, data validation, filters, sheet operations, formulas, data writing, tables, and conversational analysis
- **Workflow Memory** — The agent learns from your patterns and suggests relevant workflows
- **Formula-First Optimization** — Detects when native Google Sheets formulas can replace AI calls, reducing costs to $0 for derived columns
- **Intent Classification** — Embedding-based classifier routes commands to the right skill instantly
- **Async Bulk Processing** — Process thousands of rows with SSE-based real-time progress

[Try it free on the Google Workspace Marketplace](https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas where contributions are especially welcome:
- New AI model/provider support
- Formula catalog expansions
- UI/UX improvements
- Documentation and examples
- Bug fixes

---

## License

MIT License. See [LICENSE](LICENSE).

---

<p align="center">
  Built by <a href="https://github.com/Ai-Quill">Ai-Quill</a>
</p>

<p align="center">
  <a href="https://github.com/Ai-Quill/aisheeter-opensource/stargazers">Star on GitHub</a> &middot;
  <a href="https://www.aisheeter.com">Website</a> &middot;
  <a href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853">Install Full Version</a>
</p>
