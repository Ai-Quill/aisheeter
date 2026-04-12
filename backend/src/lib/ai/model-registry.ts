/**
 * AI Model Registry — Live model discovery from provider APIs
 * 
 * Fetches available models from OpenAI, Anthropic, Google, and Groq APIs,
 * filters to chat-relevant models, and compares against our DB.
 * 
 * Pricing is NOT available via any provider API — must be maintained manually.
 * This module handles model *availability* discovery only.
 * 
 * @see https://platform.openai.com/docs/api-reference/models/list
 * @see https://docs.anthropic.com/en/api/models-list
 * @see https://ai.google.dev/api/models
 * @see https://console.groq.com/docs/models
 */

export type ProviderName = 'CHATGPT' | 'CLAUDE' | 'GROQ' | 'GEMINI';

export interface DiscoveredModel {
  id: string;           // API model ID (e.g., 'gpt-5-mini')
  displayName: string;  // Human-readable name
  provider: ProviderName;
  ownedBy?: string;
  created?: number;
  contextWindow?: number;
}

export interface KnownModelPricing {
  /** Cost per 1M input tokens */
  inputPerMTok: number;
  /** Cost per 1M output tokens */
  outputPerMTok: number;
  /** Blended credit_price_per_token for DB (avg of input weighted 60/40) */
  creditPricePerToken: number;
}

/**
 * Known pricing for models (must be updated manually — no API exposes this)
 * 
 * Format: modelId → { inputPerMTok, outputPerMTok, creditPricePerToken }
 * creditPricePerToken = blended avg used for credit billing
 * 
 * Sources:
 * - OpenAI:    https://platform.openai.com/docs/pricing
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/pricing
 * - Google:    https://ai.google.dev/pricing
 * - Groq:      https://groq.com/pricing
 * 
 * Last updated: 2026-04-05
 */
export const KNOWN_PRICING: Record<string, KnownModelPricing> = {
  // === OpenAI ===
  'gpt-5.4-nano':   { inputPerMTok: 0.20,  outputPerMTok: 1.25,  creditPricePerToken: 0.0000002 },
  'gpt-5.4-mini':   { inputPerMTok: 0.75,  outputPerMTok: 4.50,  creditPricePerToken: 0.00000075 },
  'gpt-5.4':        { inputPerMTok: 2.50,  outputPerMTok: 15.00, creditPricePerToken: 0.0000025 },
  'gpt-5-mini':     { inputPerMTok: 0.25,  outputPerMTok: 2.00,  creditPricePerToken: 0.00000025 },
  'gpt-5':          { inputPerMTok: 1.25,  outputPerMTok: 10.00, creditPricePerToken: 0.00000125 },
  'o3-mini':        { inputPerMTok: 1.10,  outputPerMTok: 4.40,  creditPricePerToken: 0.0000011 },
  'o3':             { inputPerMTok: 2.00,  outputPerMTok: 8.00,  creditPricePerToken: 0.000002 },
  'o4-mini':        { inputPerMTok: 1.10,  outputPerMTok: 4.40,  creditPricePerToken: 0.0000011 },

  // === Anthropic ===
  'claude-opus-4-6':                { inputPerMTok: 5.00,  outputPerMTok: 25.00, creditPricePerToken: 0.000005 },
  'claude-sonnet-4-6':              { inputPerMTok: 3.00,  outputPerMTok: 15.00, creditPricePerToken: 0.000003 },
  'claude-haiku-4-5-20251001':      { inputPerMTok: 1.00,  outputPerMTok: 5.00,  creditPricePerToken: 0.000001 },

  // === Google Gemini ===
  'gemini-3.1-pro-preview':         { inputPerMTok: 2.00,  outputPerMTok: 12.00, creditPricePerToken: 0.000002 },
  'gemini-3-flash-preview':         { inputPerMTok: 0.50,  outputPerMTok: 3.00,  creditPricePerToken: 0.0000005 },
  'gemini-3.1-flash-lite-preview':  { inputPerMTok: 0.25,  outputPerMTok: 1.50,  creditPricePerToken: 0.00000025 },
  'gemini-2.5-flash':               { inputPerMTok: 0.30,  outputPerMTok: 2.50,  creditPricePerToken: 0.0000003 },
  'gemini-2.5-pro':                 { inputPerMTok: 1.25,  outputPerMTok: 10.00, creditPricePerToken: 0.00000125 },
  'gemini-2.5-flash-lite':          { inputPerMTok: 0.10,  outputPerMTok: 0.40,  creditPricePerToken: 0.0000001 },

  // === Groq ===
  'openai/gpt-oss-120b':            { inputPerMTok: 0.15,  outputPerMTok: 0.60,  creditPricePerToken: 0.00000015 },
  'openai/gpt-oss-20b':             { inputPerMTok: 0.075, outputPerMTok: 0.30,  creditPricePerToken: 0.000000075 },
  'qwen/qwen3-32b':                 { inputPerMTok: 0.29,  outputPerMTok: 0.59,  creditPricePerToken: 0.00000029 },
  'meta-llama/llama-4-scout-17b-16e-instruct':    { inputPerMTok: 0.11,  outputPerMTok: 0.34, creditPricePerToken: 0.00000011 },
  'llama-3.3-70b-versatile':                       { inputPerMTok: 0.59,  outputPerMTok: 0.79, creditPricePerToken: 0.00000059 },
  'llama-3.1-8b-instant':                          { inputPerMTok: 0.05,  outputPerMTok: 0.08, creditPricePerToken: 0.00000005 },
};

/**
 * Model ID patterns to INCLUDE per provider (chat/completion models only)
 * Everything else is filtered out (embeddings, tts, whisper, dall-e, etc.)
 */
const INCLUDE_PATTERNS: Record<ProviderName, RegExp[]> = {
  CHATGPT: [
    /^gpt-5/,
    /^gpt-4o/,
    /^o[1-9]-/,      // o1-mini, o3-mini, o4-mini, etc.
    /^o[1-9]$/,       // o1, o3, o4
  ],
  CLAUDE: [
    /^claude-/,
  ],
  GEMINI: [
    /^models\/gemini-/,
    /^gemini-/,
  ],
  GROQ: [
    /llama-4/,
    /llama-3/,
    /openai\/gpt-oss/,
    /qwen/,
    /mixtral/,
    /gemma/,
    /deepseek/,
  ],
};

/**
 * Model ID patterns to EXCLUDE (deprecated, preview, internal, etc.)
 */
const EXCLUDE_PATTERNS: RegExp[] = [
  /realtime/i,
  /audio/i,
  /search/i,
  /-preview$/,
  /instruct$/,     // Usually internal fine-tune variants
  /^ft:/,           // Fine-tuned models
  /embedding/i,
  /tts/i,
  /whisper/i,
  /dall-e/i,
  /moderation/i,
  /babbage/i,
  /davinci/i,
];

/** Groq-specific exclusions — keep instruct variants for Llama */
const GROQ_EXCLUDE_PATTERNS: RegExp[] = [
  /preview/i,
  /guard/i,          // Llama Guard models
  /tool-use/i,
];

function shouldIncludeModel(modelId: string, provider: ProviderName): boolean {
  const patterns = INCLUDE_PATTERNS[provider];
  if (!patterns) return false;

  const matches = patterns.some(p => p.test(modelId));
  if (!matches) return false;

  // Provider-specific exclusions
  const exclusions = provider === 'GROQ' ? GROQ_EXCLUDE_PATTERNS : EXCLUDE_PATTERNS;
  const excluded = exclusions.some(p => p.test(modelId));
  return !excluded;
}

/**
 * Generate a human-readable display name from a model ID
 */
function inferDisplayName(modelId: string, provider: ProviderName): string {
  // Strip provider prefix for Gemini
  let id = modelId.replace(/^models\//, '');

  // Known display name mappings
  const displayNames: Record<string, string> = {
    'gpt-5.4-nano': 'GPT-5.4 Nano',
    'gpt-5.4-mini': 'GPT-5.4 Mini',
    'gpt-5.4': 'GPT-5.4',
    'gpt-5-mini': 'GPT-5 Mini',
    'gpt-5': 'GPT-5',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'o3-mini': 'o3 Mini',
    'o3': 'o3',
    'o4-mini': 'o4 Mini',
    'claude-opus-4-6': 'Claude Opus 4.6',
    'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
    'claude-haiku-4-5': 'Claude Haiku 4.5',
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
    'gemini-3-flash-preview': 'Gemini 3 Flash',
    'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash-Lite',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
    'openai/gpt-oss-120b': 'GPT-OSS 120B',
    'openai/gpt-oss-20b': 'GPT-OSS 20B',
    'qwen/qwen3-32b': 'Qwen3 32B',
  };

  if (displayNames[id]) return displayNames[id];

  // Auto-generate from ID
  return id
    .replace(/^meta-llama\//, '')
    .replace(/-/g, ' ')
    .replace(/(\d+[a-z]?)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}


// ============================================
// PROVIDER API FETCHERS
// ============================================

interface FetchResult {
  provider: ProviderName;
  models: DiscoveredModel[];
  error?: string;
}

/**
 * Fetch models from OpenAI API
 * @see https://platform.openai.com/docs/api-reference/models/list
 */
async function fetchOpenAIModels(apiKey: string): Promise<FetchResult> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return { provider: 'CHATGPT', models: [], error: `OpenAI API ${res.status}: ${res.statusText}` };
    }
    const data = await res.json() as { data: Array<{ id: string; owned_by: string; created: number }> };

    const models: DiscoveredModel[] = data.data
      .filter(m => shouldIncludeModel(m.id, 'CHATGPT'))
      .map(m => ({
        id: m.id,
        displayName: inferDisplayName(m.id, 'CHATGPT'),
        provider: 'CHATGPT' as ProviderName,
        ownedBy: m.owned_by,
        created: m.created,
      }));

    return { provider: 'CHATGPT', models };
  } catch (err) {
    return { provider: 'CHATGPT', models: [], error: `OpenAI fetch failed: ${(err as Error).message}` };
  }
}

/**
 * Fetch models from Anthropic API
 * @see https://docs.anthropic.com/en/api/models-list
 */
async function fetchAnthropicModels(apiKey: string): Promise<FetchResult> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) {
      return { provider: 'CLAUDE', models: [], error: `Anthropic API ${res.status}: ${res.statusText}` };
    }
    const data = await res.json() as { data: Array<{ id: string; display_name: string; created_at: string }> };

    const models: DiscoveredModel[] = data.data
      .filter(m => shouldIncludeModel(m.id, 'CLAUDE'))
      .map(m => ({
        id: m.id,
        displayName: m.display_name || inferDisplayName(m.id, 'CLAUDE'),
        provider: 'CLAUDE' as ProviderName,
        created: m.created_at ? new Date(m.created_at).getTime() / 1000 : undefined,
      }));

    return { provider: 'CLAUDE', models };
  } catch (err) {
    return { provider: 'CLAUDE', models: [], error: `Anthropic fetch failed: ${(err as Error).message}` };
  }
}

/**
 * Fetch models from Google Gemini API
 * @see https://ai.google.dev/api/models#method:-models.list
 */
async function fetchGeminiModels(apiKey: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      return { provider: 'GEMINI', models: [], error: `Gemini API ${res.status}: ${res.statusText}` };
    }
    const data = await res.json() as { models: Array<{ name: string; displayName: string; inputTokenLimit?: number; outputTokenLimit?: number }> };

    const models: DiscoveredModel[] = data.models
      .filter(m => shouldIncludeModel(m.name, 'GEMINI'))
      .map(m => {
        // Google returns "models/gemini-2.5-flash" — strip the prefix for our DB
        const id = m.name.replace(/^models\//, '');
        return {
          id,
          displayName: m.displayName || inferDisplayName(id, 'GEMINI'),
          provider: 'GEMINI' as ProviderName,
          contextWindow: m.inputTokenLimit,
        };
      });

    return { provider: 'GEMINI', models };
  } catch (err) {
    return { provider: 'GEMINI', models: [], error: `Gemini fetch failed: ${(err as Error).message}` };
  }
}

/**
 * Fetch models from Groq API (OpenAI-compatible)
 * @see https://console.groq.com/docs/models
 */
async function fetchGroqModels(apiKey: string): Promise<FetchResult> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return { provider: 'GROQ', models: [], error: `Groq API ${res.status}: ${res.statusText}` };
    }
    const data = await res.json() as { data: Array<{ id: string; owned_by: string; created: number; context_window?: number }> };

    const models: DiscoveredModel[] = data.data
      .filter(m => shouldIncludeModel(m.id, 'GROQ'))
      .map(m => ({
        id: m.id,
        displayName: inferDisplayName(m.id, 'GROQ'),
        provider: 'GROQ' as ProviderName,
        ownedBy: m.owned_by,
        created: m.created,
        contextWindow: m.context_window,
      }));

    return { provider: 'GROQ', models };
  } catch (err) {
    return { provider: 'GROQ', models: [], error: `Groq fetch failed: ${(err as Error).message}` };
  }
}


// ============================================
// SYNC LOGIC
// ============================================

export interface DbModel {
  name: string;
  display_name: string;
  llm: string;
  credit_price_per_token: number;
}

export interface ModelDiff {
  /** Models available from API but not in our DB */
  newModels: Array<DiscoveredModel & { suggestedPricing?: KnownModelPricing }>;
  /** Models in our DB but not found in provider API (may be deprecated) */
  deprecated: DbModel[];
  /** Models in both DB and API (no action needed) */
  unchanged: DbModel[];
  /** Errors from provider API calls */
  errors: Array<{ provider: ProviderName; error: string }>;
  /** Summary stats */
  summary: {
    totalFromAPIs: number;
    totalInDB: number;
    newCount: number;
    deprecatedCount: number;
    unchangedCount: number;
  };
}

/**
 * Fetch models from all providers and compare against DB
 */
export async function syncModels(
  dbModels: DbModel[],
  apiKeys: { openai?: string; anthropic?: string; google?: string; groq?: string }
): Promise<ModelDiff> {
  // Fetch from all providers in parallel
  const fetchPromises: Promise<FetchResult>[] = [];
  if (apiKeys.openai) fetchPromises.push(fetchOpenAIModels(apiKeys.openai));
  if (apiKeys.anthropic) fetchPromises.push(fetchAnthropicModels(apiKeys.anthropic));
  if (apiKeys.google) fetchPromises.push(fetchGeminiModels(apiKeys.google));
  if (apiKeys.groq) fetchPromises.push(fetchGroqModels(apiKeys.groq));

  const results = await Promise.all(fetchPromises);

  // Collect all discovered models and errors
  const allDiscovered: DiscoveredModel[] = [];
  const errors: Array<{ provider: ProviderName; error: string }> = [];

  for (const result of results) {
    allDiscovered.push(...result.models);
    if (result.error) {
      errors.push({ provider: result.provider, error: result.error });
    }
  }

  // Build sets for comparison
  const discoveredIds = new Set(allDiscovered.map(m => m.id));
  const dbIds = new Set(dbModels.map(m => m.name));

  // Categorize
  const newModels = allDiscovered
    .filter(m => !dbIds.has(m.id))
    .map(m => ({
      ...m,
      suggestedPricing: KNOWN_PRICING[m.id],
    }));

  // Only mark as deprecated if we successfully fetched from that provider
  const fetchedProviders = new Set(results.filter(r => !r.error).map(r => r.provider));
  const deprecated = dbModels.filter(m => {
    const provider = m.llm as ProviderName;
    // Only mark deprecated if we actually queried that provider successfully
    return fetchedProviders.has(provider) && !discoveredIds.has(m.name);
  });

  const unchanged = dbModels.filter(m => discoveredIds.has(m.name));

  return {
    newModels,
    deprecated,
    unchanged,
    errors,
    summary: {
      totalFromAPIs: allDiscovered.length,
      totalInDB: dbModels.length,
      newCount: newModels.length,
      deprecatedCount: deprecated.length,
      unchangedCount: unchanged.length,
    },
  };
}

/**
 * Build SQL upsert statements for new models
 * Only includes models that have known pricing
 */
export function buildUpsertStatements(
  models: Array<{ id: string; displayName: string; provider: ProviderName; creditPricePerToken?: number }>
): Array<{ name: string; display_name: string; llm: ProviderName; credit_price_per_token: number }> {
  return models
    .filter(m => {
      const pricing = KNOWN_PRICING[m.id];
      return pricing || m.creditPricePerToken;
    })
    .map(m => {
      const pricing = KNOWN_PRICING[m.id];
      return {
        name: m.id,
        display_name: m.displayName,
        llm: m.provider,
        credit_price_per_token: m.creditPricePerToken ?? pricing?.creditPricePerToken ?? 0,
      };
    });
}
