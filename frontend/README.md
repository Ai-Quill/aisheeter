# AISheeter Frontend (Google Apps Script)

> Google Apps Script frontend for AISheeter - AI-powered Google Sheets™ add-on

**Version:** 3.0.0  
**Updated:** April 6, 2026

### What's New in v3.0.0

🧠 **Thinking/Reasoning Model UX** (Apr 2026)
- 3-state progressive disclosure thinking indicator (compact → teaser → expanded)
- Reasoning toggle on agent messages — see the model's thinking process
- Supports GPT-5.4, o3, o4-mini and all OpenAI reasoning models
- Reasoning token tracking in cost display

🎨 **Agent UX Redesign** (Apr 2026)
- **Message cards:** User messages right-aligned, agent left-border cards with action bar
- **Workflow timeline:** Vertical dot progress with gradient accent cards
- **Execution dots:** CSS animated states (pending → active/pulse → complete)
- **Suggestions:** One-click rows replacing checkbox multi-select
- **Design system:** DM Sans + JetBrains Mono fonts, CSS custom properties, shimmer animations

📊 **Chart Reliability Fixes** (Apr 2026)
- Adjacent column ranges use single contiguous range (fixes axis scaling bug)
- Auto-converts text-as-number values (e.g., "$ 19.4") before charting
- Reliable `useFirstColumnAsDomain` behavior

🤖 **AI Agent with Model Selection** (v2.3.0)
- Conversational interface for bulk operations
- **Model selector dropdown** - choose your model like in Cursor IDE
- **Task history** - last 10 tasks persisted, rerun with one click

🏗️ **Modular HTML Architecture** (v2.2.0)
- Refactored 1,478-line Sidebar.html into clean modules
- Uses GAS `<?!= include() ?>` pattern

---

## 📁 File Structure

```
ai-sheet-front-end/
│
├── 📜 GOOGLE APPS SCRIPT FILES
├── Code.gs              # Main entry point + AI functions
├── Config.gs            # Environment configuration (LOCAL/PRODUCTION)
├── ApiClient.gs         # HTTP request utilities
├── SecureRequest.gs     # Encrypted API communication
├── Crypto.gs            # API key encryption/decryption
├── User.gs              # User identity, settings, status
├── Prompts.gs           # Saved prompts CRUD operations
├── Jobs.gs              # Bulk processing & async jobs
├── Context.gs           # Context engineering & task inference
├── Agent.gs             # AI Agent backend (model, conversation, API)
├── AgentContext.gs      # Rich spreadsheet context (columns, types, samples)
├── AgentAnalyzer.gs     # Pattern detection for proactive suggestions
├── AgentPatternLearner.gs  # Learn user patterns over time
├── AgentResponseActions.gs # Insert responses (note, column, sheet)
├── AgentTaskChain_Parse.gs    # Parse command → multi-step workflow
├── AgentTaskChain_Plan.gs     # Build plan for each step
├── AgentTaskChain_Execute.gs  # Execute steps sequentially
├── AgentTaskChain_Analyze.gs  # Analysis/summary execution
├── AgentTaskChain_State.gs    # Chain state management
├── PricingConfig.gs     # Credit pricing per model
│
├── 📊 SHEET ACTION MODULES
├── SheetActions_Main.gs           # Action router
├── SheetActions_Format.gs         # Formatting (bold, currency, borders)
├── SheetActions_Chart.gs          # Chart creation (bar, line, pie, etc.)
├── SheetActions_ConditionalFormat.gs # Conditional formatting rules
├── SheetActions_Validation.gs     # Data validation (dropdowns, checkboxes)
├── SheetActions_Filter.gs         # Filter views
├── SheetActions_Data.gs           # Write data operations
├── SheetActions_Operations.gs     # Sheet ops (freeze, sort, resize)
├── SheetActions_Utils.gs          # Shared utilities
│
├── 🔢 FORMULA CATALOG
├── FormulaEngine.gs       # Formula generation engine
├── FormulaFirst.gs        # First-run formula setup
├── FormulaGenerator.gs    # Generate formulas from prompts
├── FormulaCatalog_*.gs    # Category catalogs (Array, DateTime, Math, etc.)
│
├── 🎨 MODULAR HTML FILES
├── Sidebar.html                          # Main orchestrator (~170 lines)
├── Sidebar_Styles.html                   # CSS design system (DM Sans, JetBrains Mono, ~840 lines)
├── Sidebar_Utils.html                    # Toast, menu, helpers, home page
├── Sidebar_Bulk.html                     # Bulk Agent feature
├── Sidebar_Settings.html                 # Settings, forms, contact
├── Sidebar_i18n.html                     # Internationalization
│
├── 🤖 AGENT UI MODULES
├── Sidebar_Agent.html                    # Agent main container
├── Sidebar_Agent_Core.html               # Core agent logic
├── Sidebar_Agent_UI.html                 # UI helpers
├── Sidebar_Agent_Thinking.html           # 3-state reasoning indicator (NEW)
├── Sidebar_Agent_Parsing.html            # Message cards (user/agent bubbles)
├── Sidebar_Agent_Execution.html          # Single-task execution
├── Sidebar_Agent_Context.html            # Context display
├── Sidebar_Agent_CostDisplay.html        # Cost + reasoning tokens display
├── Sidebar_Agent_Formula.html            # Formula mode
├── Sidebar_Agent_MultiColumnFormula.html  # Multi-column formulas
├── Sidebar_Agent_Suggestions.html        # Follow-up suggestions
├── Sidebar_Agent_Notifications.html      # Notifications
├── Sidebar_Agent_Help.html               # Help/onboarding
├── Sidebar_Agent_JobMonitor.html         # Async job monitoring
├── Sidebar_Agent_SheetPicker.html        # Sheet selection
├── Sidebar_Agent_PatternLearning.html    # Pattern learning UI
├── Sidebar_Agent_Templates.html          # Workflow templates
├── Sidebar_Agent_Validation.html         # Input validation
├── Sidebar_Agent_WriteQueue.html         # Write queue management
│
├── ⛓️ TASK CHAIN UI MODULES
├── Sidebar_Agent_TaskChain.html          # Task chain container
├── Sidebar_Agent_TaskChain_UI.html       # Workflow cards + timeline
├── Sidebar_Agent_TaskChain_Parsing.html  # Chain parse + reasoning capture
├── Sidebar_Agent_TaskChain_Execution.html # Chain progress dots
├── Sidebar_Agent_TaskChain_State.html    # Chain state management
├── Sidebar_Agent_TaskChain_Context.html  # Chain context
├── Sidebar_Agent_TaskChain_Validation.html # Chain validation
├── Sidebar_Agent_TaskChain_Suggestions.html # Post-chain suggestions
│
├── 📝 OTHER
├── PromptManager.html   # Prompt management modal
├── appsscript.json      # GAS manifest
└── README.md            # This file
```

### Module Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar.html (orchestrator)                            │
│  └─ <?!= include('Sidebar_Styles') ?>   → CSS          │
│  └─ <?!= include('Sidebar_Utils') ?>    → Core utils   │
│  └─ <?!= include('Sidebar_Bulk') ?>     → Bulk Agent   │
│  └─ <?!= include('Sidebar_Settings') ?> → Settings     │
│  └─ <?!= include('Sidebar_Agent') ?>    → AI Agent     │
└─────────────────────────────────────────────────────────┘
```

### Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│  AGENT DATA STORAGE (Lean Architecture)                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  SESSION (Memory)          UserProperties      Supabase  │
│  ─────────────────        ──────────────      ────────── │
│  • Current messages        • Agent model       • Jobs    │
│  • Active plan             • Last 10 tasks     • Results │
│  • Temp state              • Preferences       • Usage   │
│                                                          │
│  Lost on refresh ───────► Persists ─────────► Permanent  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Adding New Modules

1. Create `Sidebar_NewFeature.html` with your JavaScript
2. Add `<?!= include('Sidebar_NewFeature') ?>` in `Sidebar.html`
3. Functions become globally available
4. Remember: Utils must be included before features (dependency order)

---

## 🔧 Configuration

### Switching Environments

Edit `Config.gs` line 32:

```javascript
// For local development:
var CURRENT_ENV = ENV_TYPE.LOCAL;

// For production:
var CURRENT_ENV = ENV_TYPE.PRODUCTION;
```

### Environment URLs

| Environment | Base URL |
|-------------|----------|
| **LOCAL** | `http://localhost:3000` |
| **PRODUCTION** | `https://aisheet.vercel.app` |

### Debug Mode

Debug mode enables:
- Request/response logging
- Detailed error messages
- Configuration summary on load

Automatically enabled in LOCAL, disabled in PRODUCTION.

---

## 📦 Module Overview

### Config.gs
Centralized configuration for all environment settings.

```javascript
// Get current environment
Config.getEnv();           // 'LOCAL' or 'PRODUCTION'
Config.isProduction();     // boolean
Config.isLocal();          // boolean

// Get URLs
Config.getBaseUrl();       // 'https://aisheet.vercel.app'
Config.getApiUrl('QUERY'); // 'https://aisheet.vercel.app/api/query'

// Get defaults
Config.getDefaultModel('CHATGPT');  // 'gpt-5-mini'
Config.getSupportedProviders();     // ['CHATGPT', 'CLAUDE', 'GROQ', 'GEMINI']
```

### ApiClient.gs
HTTP request utilities with logging and error handling.

```javascript
// GET request
ApiClient.get('MODELS');
ApiClient.get('PROMPTS', { user_id: '123' });

// POST request
ApiClient.post('QUERY', { model: 'CHATGPT', input: 'Hello' });

// PUT request
ApiClient.put('PROMPTS', { id: '1', name: 'Updated' });

// DELETE request
ApiClient.delete('PROMPTS', { id: '1' });
```

### Crypto.gs
AES encryption for API keys using cCryptoGS library.

```javascript
// Encrypt/decrypt
var encrypted = Crypto.encrypt('sk-...');
var decrypted = Crypto.decrypt(encrypted);

// Salt management
Crypto.hasSalt();        // Check if salt exists
Crypto.regenerateSalt(); // Generate new salt (breaks existing keys!)
```

### User.gs
User identity and settings management.

```javascript
// Identity
getUserEmail();      // Get current user's email
getUserId();         // Get or create user ID from backend

// Settings
getUserSettings();   // Get decrypted settings from backend
saveAllSettings(settings);  // Save encrypted settings to backend

// Credit tracking
logCreditUsage(0.0025);
getCreditUsageLogs();
```

### Prompts.gs
Saved prompts CRUD operations.

```javascript
getSavedPrompts();                      // Get all user's prompts
savePrompt(name, prompt, variables);    // Create new prompt
updatePrompt(id, name, prompt, vars);   // Update existing
deletePrompt(id);                       // Delete prompt
openPromptManager();                    // Open dialog
```

### Jobs.gs
Best-in-class bulk processing & async jobs.

```javascript
// === SMART AUTO-DETECTION ===
var selection = getSelectedRange();
// { range: "A2:A500", rowCount: 498, suggestedOutput: "B", hasData: true }

// === PREVIEW MODE ===
var preview = previewBulkJob("A2:A10", "Summarize: {{input}}", "GEMINI");
// { previews: [{input, output, success}], allSuccessful: true, totalRows: 500 }

// === JOB CREATION ===
var job = createBulkJob(inputData, "Summarize: {{input}}", "GEMINI");

// === STATUS TRACKING ===
var status = getJobStatus(job.id);
// { progress: 45, successCount: 43, errorCount: 2, results: [...], errors: [...] }

// === INCREMENTAL WRITES (live updates) ===
writeIncrementalResults(job.id, results, "B", 2, true);
// Writes only NEW results, highlights green/red

// === ERROR RECOVERY ===
retryFailedRows(job.id);        // Retry only failed rows
var errors = getJobErrors(job.id);  // Get error details

// === JOB PERSISTENCE ===
var active = checkActiveJobs();  // Resume on sidebar reopen
// { hasActiveJob: true, job: {...} }

// === HELPERS ===
var values = getRangeValues("A2:A100");
var count = countNonEmptyRows("A2:A100");
clearResultHighlights("B", 2, 100);  // Remove cell colors
var estimate = estimateBulkCost(100, "GEMINI");
```

### Context.gs
Context engineering with automatic task type inference.

```javascript
// Infer task type from prompt
var taskType = inferTaskType("Extract the email from this text");
// Returns: "EXTRACT"

// Get task info
var info = getTaskTypeInfo("SUMMARIZE");
// { label: "Summarize", icon: "📝", description: "Condense information" }

// Get model recommendations
var recs = getRecommendedModels("CODE");
// { fast: "GROQ", quality: "CLAUDE" }

// Task types: EXTRACT, SUMMARIZE, CLASSIFY, TRANSLATE, CODE, ANALYZE, FORMAT, GENERAL
```

### Agent.gs *(v2.3.0)*
AI Agent backend with preferences, task history, and real-time job updates.

```javascript
// === MODEL SELECTION (Cursor-like) ===
getAgentModel();              // Get current model: 'GEMINI'
setAgentModel('CLAUDE');      // Persists to UserProperties
getAgentModels();             // Get all available models with pricing

// === PREFERENCES ===
getAgentPreferences();        
// { model: 'GEMINI', recentTasks: [{...}] }

// === TASK HISTORY ===
addTaskToHistory(task);       // Add task to history (keeps last 10)
getTaskHistory(5);            // Get last N tasks
clearTaskHistory();           // Clear all history

// === AGENT EXECUTION ===
executeAgentPlan(plan);       // Execute parsed plan, creates jobs
// plan: { inputRange, outputColumns, prompt, model, taskType }

// === REAL-TIME JOB UPDATES (SSE) ===
getJobStreamUrl(['job1', 'job2']); // Get SSE stream URL for job monitoring
// Returns: { url: 'https://.../api/jobs/stream?...', supportsSSE: true, fallbackPollingMs: 2000 }

// === MULTI-LANGUAGE SUPPORT ===
createTranslationPrompts(['Spanish', 'French'], ['B', 'C']);
// Returns column-to-prompt mapping for multi-language translation
```

### Code.gs
Main entry point with core functionality.

```javascript
// Menu/Sidebar
onOpen();       // Initialize menu
showSidebar();  // Display sidebar

// AI Queries (custom functions)
ChatGPT(prompt, imageUrl, model);
Claude(prompt, imageUrl, model);
Groq(prompt, imageUrl, model);
Gemini(prompt, imageUrl, model);

// Image Generation
DALLE(prompt);

// Other
fetchModels();              // Get available models
submitContactForm(name, email, message);
```

---

## 🎨 UI Design

### Design System
- **Font:** Inter (Google Fonts)
- **CSS Framework:** Tailwind CSS via Play CDN
- **Components:** shadcn/ui-inspired

### Key Components
- Cards with subtle shadows
- Button variants (primary, secondary, outline, ghost, destructive)
- Form inputs with focus rings
- Tab navigation
- Toast notifications
- Loading skeletons
- Slide-out menu panel

---

## 🔌 API Endpoints

All endpoints are relative to the base URL.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | AI text generation |
| `/api/generate-image` | POST | Image generation |
| `/api/models` | GET | Get available models |
| `/api/get-or-create-user` | POST | Create/get user |
| `/api/get-user-settings` | GET | Get user settings |
| `/api/save-all-settings` | POST | Save settings |
| `/api/prompts` | GET/POST/PUT/DELETE | Prompt CRUD |
| `/api/jobs` | GET/POST/DELETE | Bulk jobs |
| `/api/contact` | POST | Contact form |

---

## 📋 Version Tracking

Every file has a standardized header for easy version tracking when copying to Google Apps Script:

```javascript
/**
 * @file Code.gs
 * @version 2.2.0
 * @updated 2026-01-10
 * @author AISheeter Team
 * 
 * CHANGELOG:
 * - 2.2.0 (2026-01-10): Added include() for modular HTML
 * - 2.1.0 (2026-01-10): Input validation for empty prompts
 * - 2.0.0 (2026-01-09): Initial modular architecture
 */
```

### Current Versions

| File | Version | Last Updated |
|------|---------|--------------|
| `Code.gs` | 2.2.0 | 2026-01-10 |
| `Config.gs` | 2.3.0 | 2026-01-11 |
| `ApiClient.gs` | 2.0.0 | 2026-01-10 |
| `Crypto.gs` | 2.0.0 | 2026-01-10 |
| `User.gs` | 2.1.0 | 2026-01-10 |
| `Prompts.gs` | 2.0.0 | 2026-01-10 |
| `Jobs.gs` | 2.2.0 | 2026-01-10 |
| `Context.gs` | 2.0.0 | 2026-01-10 |
| `Agent.gs` | 2.3.0 | 2026-01-11 |
| `Sidebar.html` | 2.3.0 | 2026-01-10 |
| `Sidebar_Agent.html` | 2.6.0 | 2026-01-11 |
| `Sidebar_Styles.html` | 2.3.0 | 2026-01-10 |
| `Sidebar_Utils.html` | 2.2.0 | 2026-01-10 |
| `Sidebar_Bulk.html` | 2.2.0 | 2026-01-10 |
| `Sidebar_Settings.html` | 2.2.0 | 2026-01-10 |
| `PromptManager.html` | 2.0.0 | 2026-01-10 |

### When Updating

1. Increment version number (semver: major.minor.patch)
2. Update the `@updated` date
3. Add changelog entry at the top
4. Update the table above

---

## 🚀 Deployment

### Deploy to Google Apps Script

1. Open Google Sheets
2. Extensions → Apps Script
3. Copy all `.gs` and `.html` files (check versions match above)
4. Set `CURRENT_ENV = ENV_TYPE.PRODUCTION` in Config.gs
5. Save and test

### Local Development

1. Start backend locally: `cd ai-sheet-backend && npm run dev`
2. Set `CURRENT_ENV = ENV_TYPE.LOCAL` in Config.gs
3. Test from Google Sheets

---

## 📝 Default Models (January 2026)

| Provider | Default Model | Cost (per MTok) |
|----------|---------------|-----------------|
| **ChatGPT** | gpt-5-mini | $0.25 / $2.00 |
| **Claude** | claude-haiku-4-5 | $1.00 / $5.00 |
| **Groq** | meta-llama/llama-4-scout-17b-16e-instruct | $0.11 / $0.34 |
| **Gemini** | gemini-2.5-flash | $0.075 / $0.30 |

---

## 🔐 Dependencies

### Apps Script Libraries

| Library | ID | Version | Purpose |
|---------|-------|---------|---------|
| cCryptoGS | `1DrAWO6wSBwNgKaIH6hN4njIz2... ` | Latest | AES encryption |

---

## 📄 License

MIT License - See root LICENSE file
