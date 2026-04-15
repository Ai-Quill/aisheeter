<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Vercel_AI_SDK-6-black?style=for-the-badge" alt="Vercel AI SDK" />
  <img src="https://img.shields.io/badge/Google_Apps_Script-GAS-4285F4?style=for-the-badge&logo=google" alt="Google Apps Script" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">AISheeter</h1>

<h3 align="center">Open-source AI-powered Google Sheets add-on.<br/>Use ChatGPT, Claude, Gemini, Groq &amp; more — directly in your spreadsheet.</h3>

<p align="center">
  <a href="https://www.aisheeter.com">Website</a> &middot;
  <a href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853">Install from Marketplace</a> &middot;
  <a href="#self-hosting">Self-Host Guide</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#contributing">Contributing</a>
</p>

---

## What is AISheeter?

AISheeter is a Google Sheets add-on that lets you query any major AI model through your own API keys. This repository contains the **complete Google Apps Script frontend** and the **Next.js API backend** — everything needed to self-host your own AI-powered spreadsheet tool.

**Bring Your Own Keys (BYOK)** — API keys are AES-encrypted on the client before leaving the browser. The server never sees plaintext keys.

### Capabilities

- **Multi-model queries** — GPT-4o, Claude, Gemini, Llama, DeepSeek from a single dropdown
- **Bulk AI processing** — Process hundreds of rows with real-time progress streaming
- **Prompt templates** — Save, reuse, and share prompt templates across sheets
- **Image generation** — Generate images from text descriptions (DALL-E, Imagen)
- **Custom formulas** — `=ChatGPT("summarize this")` using your own API key
- **Context engineering** — Task-aware system prompts for spreadsheet-optimized outputs
- **Response caching** — Identical prompts return cached results, saving API costs
- **Full monetization stack** — Stripe integration for SaaS if you want to build a business

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Google Sheets                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              AISheeter Sidebar (Apps Script)           │  │
│  │                                                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ Model Select │  │ Prompt Mgmt  │  │ Bulk Engine  │ │  │
│  │  └─────────────┘  └──────────────┘  └──────────────┘ │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ Formula Eng. │  │ Sheet Actions│  │ Task Chains  │ │  │
│  │  └─────────────┘  └──────────────┘  └──────────────┘ │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Crypto.gs ─► AES encrypt key ─► SecureRequest   │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └──────────────────────┬─────────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          │ HTTPS POST (encrypted API key + prompt)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Next.js 16 Backend (Vercel)                    │
│                                                              │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Security │  │  Decrypt  │  │  Context    │  │  Cache   │ │
│  │  Layer   │──│  API Key  │──│  Engineer.  │──│  Layer   │ │
│  │CORS+Rate │  │ AES→plain │  │  (prompts)  │  │ DB-based │ │
│  └──────────┘  └───────────┘  └─────┬──────┘  └──────────┘ │
│                                      │                       │
│                         ┌────────────▼────────────┐          │
│                         │  Vercel AI SDK 6        │          │
│                         │  generateText()         │          │
│                         │  Unified provider API   │          │
│                         └──┬─────┬─────┬──────┬──┘          │
│                            │     │     │      │              │
│  ┌─────────────────────────┼─────┼─────┼──────┼───────────┐ │
│  │  Model Registry — live discovery + manual pricing       │ │
│  └─────────────────────────┼─────┼─────┼──────┼───────────┘ │
└────────────────────────────┼─────┼─────┼──────┼─────────────┘
                             ▼     ▼     ▼      ▼
                         ┌──────┐┌──────┐┌──────┐┌──────┐
                         │OpenAI││Claude││Gemini││ Groq │
                         │GPT-4o││Sonnet││ 2.5  ││Llama │
                         └──────┘└──────┘└──────┘└──────┘
```

### Request Lifecycle

```
User types prompt in sidebar
         │
         ▼
┌─────────────────────┐
│ 1. Encrypt API key  │  Crypto.gs: AES encrypt with shared salt
│    (client-side)    │  Key never leaves browser in plaintext
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 2. SecureRequest     │  Builds payload: { encryptedKey, model,
│    builds payload    │  provider, prompt, systemPrompt, ... }
└────────┬─────────────┘
         │ HTTPS POST to /api/query
         ▼
┌─────────────────────┐
│ 3. CORS + Rate      │  Origin whitelist + Upstash Redis sliding
│    Limit check      │  window (30 req/60s for AI routes)
└────────┬─────────────┘
         │
         ▼
┌─────────────────────┐
│ 4. Validate + decrypt│  Zod schema validation → AES decrypt key
│    request body      │  → provider-specific format check
└────────┬─────────────┘
         │
         ▼
┌─────────────────────┐
│ 5. Check cache       │  SHA-256 hash of (model + prompt + system)
│    (DB lookup)       │  Hit rate: ~20-40% for spreadsheet use cases
└────────┬─────────────┘
         │ cache miss
         ▼
┌─────────────────────┐
│ 6. Infer task type   │  Keywords/patterns → EXTRACT, SUMMARIZE,
│    + system prompt   │  ANALYZE, CLASSIFY, TRANSLATE, GENERATE...
└────────┬─────────────┘
         │
         ▼
┌─────────────────────┐
│ 7. AI SDK            │  getModel(provider, modelId, apiKey)
│    generateText()    │  → unified LanguageModel interface
└────────┬─────────────┘
         │
         ▼
┌─────────────────────┐
│ 8. Cache response    │  TTL by model cost: 7d for GPT-5,
│    + return          │  3d for Haiku, 1d for Groq/Llama
└─────────────────────┘
```

### Security Model

```
┌──────────────────────────────────────────────────────────────┐
│                   SECURITY ARCHITECTURE                       │
│                                                              │
│  FRONTEND (Google Apps Script)                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  User enters API key                                 │    │
│  │       │                                              │    │
│  │       ▼                                              │    │
│  │  Crypto.gs: AES encrypt with ENCRYPTION_SALT         │    │
│  │       │  (salt stored in Script Properties)          │    │
│  │       ▼                                              │    │
│  │  SecureRequest.gs: Attach encrypted key to payload   │    │
│  │       │  (plaintext key NEVER leaves this layer)     │    │
│  │       ▼                                              │    │
│  │  HTTPS POST ─────────────────────────────────────────┼──► │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  BACKEND (Next.js)                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ◄── Incoming request                                │    │
│  │       │                                              │    │
│  │       ▼                                              │    │
│  │  1. CORS: Origin whitelist (configurable allowlist)  │    │
│  │       │                                              │    │
│  │       ▼                                              │    │
│  │  2. Rate Limit: Upstash Redis sliding window         │    │
│  │     • AI routes:  30 req / 60s per user              │    │
│  │     • Jobs:       10 req / 60s per user              │    │
│  │     • General:    60 req / 60s per user              │    │
│  │     • Fallback:   no-op if Redis not configured      │    │
│  │       │                                              │    │
│  │       ▼                                              │    │
│  │  3. Zod Validation: Schema-enforced request body     │    │
│  │       │                                              │    │
│  │       ▼                                              │    │
│  │  4. Decrypt: AES decrypt with same ENCRYPTION_SALT   │    │
│  │       │  (key exists in memory only during request)  │    │
│  │       ▼                                              │    │
│  │  5. Forward to AI provider ─► discard plaintext key  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  KEY PROPERTIES:                                             │
│  • Plaintext keys never stored on server (decrypt → use     │
│    → discard, all in one request lifecycle)                  │
│  • Same AES salt on both ends (env var + Script Properties)  │
│  • HTTPS in transit, AES at rest in user's Google account    │
└──────────────────────────────────────────────────────────────┘
```

### Multi-Provider Model Factory

```
                    getModel(provider, modelId, apiKey)
                                  │
                  ┌───────────────┼───────────────┐
                  │               │               │
              ┌───▼───┐     ┌────▼────┐     ┌────▼────┐
              │CHATGPT│     │ CLAUDE  │     │ GEMINI  │
              └───┬───┘     └────┬────┘     └────┬────┘
                  │              │               │
          createOpenAI()  createAnthropic()  createGoogleGenerativeAI()
                  │              │               │
                  └──────────────┼───────────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
              ┌───▼───┐    ┌────▼────┐    ┌────▼────┐
              │ GROQ  │    │STRATICO │    │ Custom  │
              └───┬───┘    └────┬────┘    └────┬────┘
                  │              │              │
          createOpenAI()   createOpenAI()   createOpenAI()
          (baseURL:groq)  (baseURL:custom)  (any OpenAI-compat)
                  │              │              │
                  ▼              ▼              ▼
            All return unified LanguageModel interface
            → generateText(), streamText(), generateObject()
```

Any OpenAI-compatible provider can be added with ~5 lines — just add a new case in `getModel()` with a custom `baseURL`.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Google Apps Script | Native Sheets integration, sidebar UI, 34 HTML modules |
| **Backend** | Next.js 16 + App Router | Serverless API routes, React landing page, edge-ready |
| **AI** | Vercel AI SDK 6 | One `generateText()` call for all providers — no SDK sprawl |
| **Database** | Neon PostgreSQL | Serverless Postgres with branching, free tier for dev |
| **Cache** | PostgreSQL (response cache) | SHA-256 keyed, model-aware TTL (1-7 days) |
| **Rate Limit** | Upstash Redis | Distributed sliding window, graceful no-op fallback |
| **Payments** | Stripe | Checkout, webhooks, customer portal, tier gating |
| **Security** | AES + CORS + Zod + rate limit | Defense in depth across every layer |
| **Hosting** | Vercel | Zero-config serverless, edge functions, preview deploys |

---

## Project Structure

```
frontend/                              # Google Apps Script — complete sidebar + engine
│
├── Code.gs                            # Entry point: menu registration, sidebar launcher
├── Config.gs                          # Environment config (backend URL, feature flags)
│
├── Crypto.gs                          # AES encryption (cCryptoGS library)
├── SecureRequest.gs                   # Encrypted API key payload builder
├── User.gs                            # User settings + API key storage
│
├── Agent*.gs                          # AI agent modules
│   ├── Agent.gs                       #   Core agent dispatcher
│   ├── AgentAnalyzer.gs               #   Response analysis + quality checks
│   ├── AgentContext.gs                 #   Sheet context builder for prompts
│   ├── AgentPatternLearner.gs         #   Pattern detection + workflow suggestions
│   └── AgentResponseActions.gs        #   Response → sheet action mapper
│
├── AgentTaskChain_*.gs                # Multi-step workflow engine
│   ├── AgentTaskChain_Plan.gs         #   Workflow planning + step decomposition
│   ├── AgentTaskChain_Parse.gs        #   Step parsing + validation
│   ├── AgentTaskChain_Execute.gs      #   Sequential step execution
│   ├── AgentTaskChain_State.gs        #   State machine (pending→running→done)
│   └── AgentTaskChain_Analyze.gs      #   Post-execution analysis
│
├── SheetActions_*.gs                  # Google Sheets operations
│   ├── SheetActions_Main.gs           #   Write data, read ranges, navigate
│   ├── SheetActions_Chart.gs          #   Chart creation (9 types + transpose)
│   ├── SheetActions_Format.gs         #   Cell/range formatting
│   ├── SheetActions_ConditionalFormat.gs  # Conditional formatting rules
│   ├── SheetActions_Filter.gs         #   Filter views + sort
│   ├── SheetActions_Data.gs           #   Data manipulation
│   ├── SheetActions_Operations.gs     #   Sheet-level ops (freeze, hide, resize)
│   ├── SheetActions_Validation.gs     #   Data validation rules
│   └── SheetActions_Utils.gs          #   Shared helpers (column math, type mapping)
│
├── FormulaCatalog_*.gs                # 200+ formula definitions by category
│   ├── FormulaCatalog_Math.gs         #   SUM, AVERAGE, ROUND, etc.
│   ├── FormulaCatalog_Text.gs         #   CONCAT, LEFT, SUBSTITUTE, etc.
│   ├── FormulaCatalog_Lookup.gs       #   VLOOKUP, INDEX/MATCH, XLOOKUP, etc.
│   ├── FormulaCatalog_DateTime.gs     #   DATE, EDATE, NETWORKDAYS, etc.
│   ├── FormulaCatalog_Financial.gs    #   PMT, NPV, IRR, etc.
│   ├── FormulaCatalog_Logic.gs        #   IF, IFS, SWITCH, etc.
│   ├── FormulaCatalog_Array.gs        #   ARRAYFORMULA, FILTER, SORT, etc.
│   ├── FormulaCatalog_Engineering.gs  #   BIN2DEC, COMPLEX, etc.
│   └── FormulaCatalog_Google.gs       #   GOOGLEFINANCE, IMPORTRANGE, etc.
│
├── FormulaEngine.gs                   # Formula composition from natural language
├── FormulaFirst.gs                    # Detects when native formulas > AI calls
│
├── Sidebar*.html                      # Modular sidebar UI (34 HTML modules)
│   ├── Sidebar.html                   #   Main container + module loader
│   ├── Sidebar_Agent*.html            #   Agent UI, thinking, execution, validation
│   ├── Sidebar_Bulk.html              #   Bulk processing interface
│   ├── Sidebar_Settings.html          #   API key + model configuration
│   ├── Sidebar_Styles.html            #   CSS (Material Design inspired)
│   └── Sidebar_i18n.html              #   Internationalization
│
├── Jobs.gs                            # Async job queue for bulk operations
├── Prompts.gs                         # Saved prompt template management
├── PricingConfig.gs                   # Credit/tier pricing configuration
├── ApiClient.gs                       # HTTP client for backend communication
└── appsscript.json                    # GAS manifest + OAuth scopes

backend/                               # Next.js 16 API server
│
├── src/
│   ├── app/api/                       # API Routes
│   │   ├── query/route.ts             #   Main AI query — all providers, caching, context
│   │   ├── models/route.ts            #   Live model discovery from provider APIs
│   │   ├── generate-image/route.ts    #   DALL-E / Imagen image generation
│   │   ├── stripe/                    #   Checkout, webhook, customer portal
│   │   ├── get-or-create-user/        #   User registration + lookup
│   │   ├── save-api-key/route.ts      #   Encrypted key storage
│   │   ├── save-default-model/        #   Per-user model preferences
│   │   ├── prompts/route.ts           #   Saved prompt CRUD
│   │   └── usage/check/route.ts       #   Credit balance + tier check
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── models.ts              #   Model factory: provider → LanguageModel
│   │   │   └── model-registry.ts      #   Live discovery + pricing data
│   │   ├── prompts/index.ts           #   Context engineering: task inference + system prompts
│   │   ├── cache/index.ts             #   Response cache: SHA-256 key, model-aware TTL
│   │   ├── auth/
│   │   │   ├── auth-service.ts        #   User authentication from Google token
│   │   │   └── gating.ts             #   Feature gating by subscription tier
│   │   ├── security/
│   │   │   ├── cors.ts                #   Origin whitelist middleware
│   │   │   ├── rate-limit.ts          #   Upstash Redis sliding window
│   │   │   └── validation.ts          #   Zod schemas for all endpoints
│   │   ├── stripe/index.ts            #   Stripe client + tier configuration
│   │   └── db.ts                      #   Neon PostgreSQL client (@neondatabase/serverless)
│   │
│   ├── utils/
│   │   └── encryption.ts              #   Server-side AES decrypt + key validation
│   │
│   ├── components/                    #   React landing page (15 sections)
│   └── pages/                         #   Marketing: landing, privacy, terms, contact
│
├── scripts/migrations/                #   SQL migrations for Neon
│   ├── 001_core_tables.sql            #   Users, settings, usage, cache, prompts
│   └── 007_integer_credits.sql        #   Credit system migration
│
├── .env.example                       #   Documented env vars (28 variables)
├── vercel.json                        #   Vercel deployment config
└── next.config.mjs                    #   Next.js 16 config
```

---

## Features in Detail

### Context Engineering

The backend implements task-aware system prompts inspired by [Anthropic's context engineering principles](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Every query goes through a task inference pipeline:

```
User prompt: "Extract the email and name from: John Smith, john@example.com"
                    │
                    ▼
           inferTaskType(prompt)
           ┌────────────────────┐
           │  Keyword matching: │
           │  "extract" → EXTRACT│
           └────────┬───────────┘
                    │
                    ▼
           SystemPrompts.EXTRACT
           ┌────────────────────────────────────────────────┐
           │  Base: "You are an AI in Google Sheets..."      │
           │  + Task: "Extract structured data.              │
           │    Output: field1: value1 | field2: value2      │
           │    If a field cannot be found, use 'N/A'"       │
           └────────────────────────────────────────────────┘
```

Supported task types: `EXTRACT`, `SUMMARIZE`, `ANALYZE`, `CLASSIFY`, `TRANSLATE`, `GENERATE`, `FORMAT`, `FORMULA`, `GENERAL`

### Response Caching

Identical prompts return cached results, saving significant API costs for spreadsheet workloads where users often run the same formula on similar data.

```
Cache key = SHA-256(model + prompt + systemPrompt)

TTL strategy (by model cost):
  ┌─────────────────────┬──────────┐
  │ Model               │ Cache TTL│
  ├─────────────────────┼──────────┤
  │ GPT-5, Claude Opus  │ 7 days   │
  │ Claude Sonnet, Gemini Pro │ 5 days │
  │ GPT-5-mini, Haiku, Flash  │ 3 days │
  │ Groq / Llama        │ 1 day    │
  │ Unknown models      │ 1 day    │
  └─────────────────────┴──────────┘

Typical hit rate: 20-40% for spreadsheet workloads
```

### Multi-Model Support

Switch between providers with a dropdown. All models go through the same `getModel()` factory:

| Provider | Models | Transport |
|----------|--------|-----------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-5.4, o3, o4-mini | Native SDK |
| **Anthropic** | Claude Sonnet 4.6, Claude Haiku | Native SDK |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash | Native SDK |
| **Groq** | Llama 3.3, DeepSeek R1 | OpenAI-compatible |
| **Custom** | Any OpenAI-compatible endpoint | OpenAI-compatible |

Adding a new OpenAI-compatible provider:

```typescript
case 'MY_PROVIDER':
  return createOpenAI({
    apiKey,
    baseURL: 'https://api.my-provider.com/v1',
  })(modelId);
```

### Client-Side Key Encryption

API keys are AES-encrypted in the browser before being sent to the server. The server stores and transmits only ciphertext.

```
Frontend (Crypto.gs):         Backend (encryption.ts):
  CryptoJS.AES.encrypt(       CryptoJS.AES.decrypt(
    apiKey,                      encryptedKey,
    ENCRYPTION_SALT              ENCRYPTION_SALT
  ) → ciphertext                ) → plaintext → use → discard
```

The same `ENCRYPTION_SALT` is shared between frontend (GAS Script Properties) and backend (environment variable). The server decrypts only for the duration of the API call — no plaintext keys are ever persisted server-side.

### Formula Catalogs

200+ Google Sheets formulas organized by category (math, text, lookup, date, financial, engineering, array, logic, Google-specific). The `FormulaEngine.gs` composes complex formulas from natural language, while `FormulaFirst.gs` detects when a native formula can replace an AI call — reducing costs to $0 for derived columns.

### Stripe Integration

Complete payment flow with tier-based feature gating:

```
User subscribes              Stripe webhook fires
      │                            │
      ▼                            ▼
 /api/stripe/checkout  →   /api/stripe/webhook
  Creates session            Updates user tier in DB
                                   │
                                   ▼
                             gating.ts checks tier
                             before each API call
```

Includes: checkout sessions, webhook handling, customer portal, and configurable tier limits.

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
git clone https://github.com/Ai-Quill/aisheeter.git
cd aisheeter/backend

npm install

cp .env.example .env.local
# Edit .env.local — at minimum set:
#   NEON_DB_URL=postgresql://...
#   ENCRYPTION_SALT=<any-random-string-shared-with-frontend>
#   NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Run database migrations
psql $NEON_DB_URL -f scripts/migrations/001_core_tables.sql

npm run dev
```

**Deploy to Vercel** (recommended for production):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Ai-Quill/aisheeter/tree/main/backend)

### 2. Deploy the Frontend

```bash
cd frontend

npm install -g @google/clasp
clasp login

# Create a new Apps Script project bound to a Google Sheet
clasp create --type sheets --title "AISheeter"

# Edit Config.gs — set PROD_BASE_URL to your deployed backend URL
# Edit Script Properties — set ENCRYPTION_SALT to match backend

clasp push
clasp open    # Opens in browser to configure triggers
```

### 3. Configure

1. Open any Google Sheet
2. Go to **Extensions > AISheeter**
3. Enter your AI provider API key in Settings
4. Start querying

### Environment Variables Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEON_DB_URL` | Yes | PostgreSQL connection string |
| `ENCRYPTION_SALT` | Yes | Shared AES salt (must match frontend) |
| `NEXT_PUBLIC_BASE_URL` | Yes | Backend URL for CORS |
| `UPSTASH_REDIS_REST_URL` | No | Rate limiting (falls back to no-op) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Rate limiting auth |
| `STRIPE_SECRET_KEY` | No | Payments (skip for free self-hosting) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook verification |

See `.env.example` for the full list of 28 configurable variables.

---

## The Full Product

This open-source version gives you a solid foundation for AI in Google Sheets. The **full AISheeter** product (available on the [Google Workspace Marketplace](https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853)) adds:

- **AI Agent with Multi-Step Chains** — "Build me a 12-month financial model with break-even analysis" executes as a single command with layout planning, data generation, formulas, formatting, and charts
- **10 Specialized Tools** — Charts (with horizontal time-series transpose), formatting, conditional formatting, data validation, filters, sheet operations, formulas with guardrails, data writing, tables, and conversational analysis
- **Formula Guardrails** — Real-time `toModelOutput` feedback catches `#DIV/0!`, `#REF!`, circular references, and syntax errors before they hit the sheet
- **Formula-First Optimization** — Detects when native Google Sheets formulas can replace AI calls, reducing costs to $0 for derived columns
- **Workflow Memory** — The agent learns from your patterns and suggests relevant workflows
- **Async Bulk Processing** — Process thousands of rows with SSE-based real-time progress

[Try it free on the Google Workspace Marketplace](https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas where contributions are especially welcome:
- New AI model/provider support (especially OpenAI-compatible endpoints)
- Formula catalog expansions
- UI/UX improvements to the sidebar
- Documentation, examples, and tutorials
- Bug fixes and security improvements
- Internationalization (i18n)

---

## License

MIT License. See [LICENSE](LICENSE).

---

<p align="center">
  Built by <a href="https://github.com/Ai-Quill">Ai-Quill</a>
</p>

<p align="center">
  <a href="https://github.com/Ai-Quill/aisheeter/stargazers">Star on GitHub</a> &middot;
  <a href="https://www.aisheeter.com">Website</a> &middot;
  <a href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853">Install Full Version</a>
</p>
