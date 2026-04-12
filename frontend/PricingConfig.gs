/**
 * @file PricingConfig.gs
 * @description AI Model Pricing Configuration
 * @updated 2026-01-21
 * 
 * IMPORTANT: Update this file when model prices change.
 * Prices are per 1 MILLION tokens (MTok) in USD.
 * 
 * Last verified: January 21, 2026
 * Sources:
 * - Google: https://ai.google.dev/pricing
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - Groq: https://groq.com/pricing
 */

// ============================================
// PRICING CONFIGURATION
// ============================================

/**
 * Model pricing per 1 million tokens (MTok)
 * 
 * Structure:
 * - input: Cost per 1M input tokens
 * - output: Cost per 1M output tokens
 * - class: Model class/tier
 * - displayName: Human-readable name
 * - notes: Any special pricing notes
 */
var MODEL_PRICING = {
  
  // ========== GOOGLE GEMINI ==========
  
  GEMINI: {
    input: 0.30,        // $0.30 per 1M tokens (price updated Apr 2026)
    output: 2.50,       // $2.50 per 1M tokens
    class: 'Efficient',
    displayName: 'Gemini 2.5 Flash',
    notes: 'Default model. Fast and cost-effective.',
    updated: '2026-04-05'
  },
  
  GEMINI_31_PRO: {
    input: 2.00,        // $2.00 per 1M tokens
    output: 12.00,      // $12.00 per 1M tokens
    class: 'Flagship',
    displayName: 'Gemini 3.1 Pro (Preview)',
    notes: 'Latest flagship preview. Highest capability.',
    updated: '2026-04-05'
  },
  
  GEMINI_3_FLASH: {
    input: 0.50,        // $0.50 per 1M tokens
    output: 3.00,       // $3.00 per 1M tokens
    class: 'Fast Flagship',
    displayName: 'Gemini 3 Flash (Preview)',
    notes: 'Fast flagship model.',
    updated: '2026-04-05'
  },
  
  GEMINI_31_FLASH_LITE: {
    input: 0.25,        // $0.25 per 1M tokens
    output: 1.50,       // $1.50 per 1M tokens
    class: 'Light',
    displayName: 'Gemini 3.1 Flash-Lite (Preview)',
    notes: 'Lightweight preview model.',
    updated: '2026-04-05'
  },
  
  GEMINI_PRO: {
    input: 1.25,        // $1.25 per 1M tokens
    output: 10.00,      // $10.00 per 1M tokens
    class: 'Balanced',
    displayName: 'Gemini 2.5 Pro',
    notes: 'Balanced performance and cost.',
    updated: '2026-04-05'
  },
  
  GEMINI_FLASH_LITE: {
    input: 0.10,        // $0.10 per 1M tokens
    output: 0.40,       // $0.40 per 1M tokens
    class: 'Ultra-Light',
    displayName: 'Gemini 2.5 Flash-Lite',
    notes: 'Cheapest. Good for simple tasks.',
    updated: '2026-04-05'
  },
  
  // ========== OPENAI ==========
  
  GPT54: {
    input: 2.50,        // $2.50 per 1M tokens
    output: 15.00,      // $15.00 per 1M tokens
    class: 'Flagship',
    displayName: 'GPT-5.4',
    notes: 'Latest OpenAI flagship model.',
    updated: '2026-04-05'
  },
  
  GPT54_MINI: {
    input: 0.75,        // $0.75 per 1M tokens
    output: 4.50,       // $4.50 per 1M tokens
    class: 'Balanced',
    displayName: 'GPT-5.4 Mini',
    notes: 'Balanced performance and cost.',
    updated: '2026-04-05'
  },
  
  CHATGPT: {
    input: 0.20,        // $0.20 per 1M tokens (gpt-5.4-nano)
    output: 1.25,       // $1.25 per 1M tokens
    class: 'Efficient',
    displayName: 'GPT-5.4 Nano',
    notes: 'Default OpenAI model. Cheapest GPT-5.4.',
    updated: '2026-04-05'
  },
  
  GPT5: {
    input: 1.25,        // $1.25 per 1M tokens
    output: 10.00,      // $10.00 per 1M tokens
    class: 'Previous Gen',
    displayName: 'GPT-5',
    notes: 'Previous generation flagship.',
    updated: '2026-04-05'
  },
  
  GPT5_MINI: {
    input: 0.25,        // $0.25 per 1M tokens
    output: 2.00,       // $2.00 per 1M tokens
    class: 'Previous Gen',
    displayName: 'GPT-5 Mini',
    notes: 'Previous generation efficient model.',
    updated: '2026-04-05'
  },
  
  O3: {
    input: 2.00,        // $2.00 per 1M tokens
    output: 8.00,       // $8.00 per 1M tokens
    class: 'Reasoning',
    displayName: 'o3',
    notes: 'Advanced reasoning model.',
    updated: '2026-04-05'
  },
  
  O3_MINI: {
    input: 1.10,        // $1.10 per 1M tokens
    output: 4.40,       // $4.40 per 1M tokens
    class: 'Fast Reasoning',
    displayName: 'o3-mini',
    notes: 'Fast reasoning model.',
    updated: '2026-04-05'
  },
  
  O4_MINI: {
    input: 1.10,        // $1.10 per 1M tokens
    output: 4.40,       // $4.40 per 1M tokens
    class: 'Fast Reasoning',
    displayName: 'o4-mini',
    notes: 'Latest reasoning model.',
    updated: '2026-04-05'
  },
  
  // ========== ANTHROPIC CLAUDE ==========
  
  CLAUDE: {
    input: 1.00,        // $1.00 per 1M tokens
    output: 5.00,       // $5.00 per 1M tokens
    class: 'Efficient',
    displayName: 'Claude Haiku 4.5',
    notes: 'Default Claude. Fast and efficient.',
    updated: '2026-04-05'
  },
  
  CLAUDE_SONNET: {
    input: 3.00,        // $3.00 per 1M tokens
    output: 15.00,      // $15.00 per 1M tokens
    class: 'Balanced',
    displayName: 'Claude Sonnet 4.6',
    notes: 'Latest Sonnet. Balanced performance.',
    updated: '2026-04-05'
  },
  
  CLAUDE_OPUS: {
    input: 5.00,        // $5.00 per 1M tokens
    output: 25.00,      // $25.00 per 1M tokens
    class: 'Flagship',
    displayName: 'Claude Opus 4.6',
    notes: 'Latest flagship. Highest capability.',
    updated: '2026-04-05'
  },
  
  // ========== GROQ ==========
  
  GROQ: {
    input: 0.11,        // $0.11 per 1M tokens
    output: 0.34,       // $0.34 per 1M tokens
    class: 'Open Efficient',
    displayName: 'Llama 4 Scout (17B)',
    notes: 'Default Groq. Supports structured outputs. Fast inference.',
    updated: '2026-04-05'
  },
  
  GROQ_GPT_OSS_120B: {
    input: 0.15,        // $0.15 per 1M tokens
    output: 0.60,       // $0.60 per 1M tokens
    class: 'Open Flagship',
    displayName: 'GPT-OSS 120B',
    notes: 'Open-source GPT via Groq. High capability.',
    updated: '2026-04-05'
  },
  
  GROQ_GPT_OSS_20B: {
    input: 0.075,       // $0.075 per 1M tokens
    output: 0.30,       // $0.30 per 1M tokens
    class: 'Open Efficient',
    displayName: 'GPT-OSS 20B',
    notes: 'Lightweight open-source GPT via Groq.',
    updated: '2026-04-05'
  },
  
  GROQ_QWEN3: {
    input: 0.29,        // $0.29 per 1M tokens
    output: 0.59,       // $0.59 per 1M tokens
    class: 'Open Balanced',
    displayName: 'Qwen3 32B',
    notes: 'Alibaba Qwen3 via Groq.',
    updated: '2026-04-05'
  },
  
  GROQ_LLAMA70B: {
    input: 0.59,        // $0.59 per 1M tokens
    output: 0.79,       // $0.79 per 1M tokens
    class: 'Open Large',
    displayName: 'Llama 3.3 70B',
    notes: 'Versatile large open model.',
    updated: '2026-04-05'
  },
  
  GROQ_LITE: {
    input: 0.05,        // $0.05 per 1M tokens
    output: 0.08,       // $0.08 per 1M tokens
    class: 'Ultra-Light',
    displayName: 'Llama 3.1 8B',
    notes: 'Cheapest. Ultra-fast inference.',
    updated: '2026-04-05'
  }
};

// ============================================
// PRICING FUNCTIONS
// ============================================

/**
 * Get pricing for a specific model
 * @param {string} modelId - Model identifier (e.g., 'GEMINI', 'CHATGPT')
 * @return {Object} Pricing object or default pricing
 */
function getModelPricing(modelId) {
  return MODEL_PRICING[modelId] || MODEL_PRICING.GEMINI;
}

/**
 * Calculate cost for a given number of tokens
 * @param {string} modelId - Model identifier
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @return {Object} Cost breakdown
 */
function calculateTokenCost(modelId, inputTokens, outputTokens) {
  var pricing = getModelPricing(modelId);
  
  // Convert tokens to millions and multiply by price per million
  var inputCost = (inputTokens / 1000000) * pricing.input;
  var outputCost = (outputTokens / 1000000) * pricing.output;
  var totalCost = inputCost + outputCost;
  
  return {
    model: modelId,
    modelName: pricing.displayName,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCost: inputCost,
    outputCost: outputCost,
    totalCost: totalCost,
    // Formatted strings
    inputCostFormatted: formatCost(inputCost),
    outputCostFormatted: formatCost(outputCost),
    totalCostFormatted: formatCost(totalCost),
    pricing: {
      inputPerMillion: pricing.input,
      outputPerMillion: pricing.output
    }
  };
}

/**
 * Estimate cost for a bulk job based on row count
 * Uses average token estimates per row
 * 
 * @param {string} modelId - Model identifier
 * @param {number} rowCount - Number of rows to process
 * @param {Object} options - Optional overrides
 * @param {number} options.avgInputTokens - Average input tokens per row (default: 150)
 * @param {number} options.avgOutputTokens - Average output tokens per row (default: 100)
 * @return {Object} Cost estimate
 */
function estimateJobCost(modelId, rowCount, options) {
  options = options || {};
  
  // Default token estimates (conservative)
  var avgInputTokens = options.avgInputTokens || 150;
  var avgOutputTokens = options.avgOutputTokens || 100;
  
  var totalInputTokens = rowCount * avgInputTokens;
  var totalOutputTokens = rowCount * avgOutputTokens;
  
  var costBreakdown = calculateTokenCost(modelId, totalInputTokens, totalOutputTokens);
  
  return {
    rowCount: rowCount,
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedTotalTokens: totalInputTokens + totalOutputTokens,
    estimatedCost: costBreakdown.totalCost,
    estimatedCostFormatted: costBreakdown.totalCostFormatted,
    model: modelId,
    modelName: costBreakdown.modelName,
    assumptions: {
      avgInputTokensPerRow: avgInputTokens,
      avgOutputTokensPerRow: avgOutputTokens
    },
    note: 'Estimate based on ~' + avgInputTokens + ' input + ~' + avgOutputTokens + ' output tokens per row'
  };
}

/**
 * Format cost as currency string
 * @param {number} cost - Cost in USD
 * @return {string} Formatted cost (e.g., "$0.0012" or "<$0.01")
 */
function formatCost(cost) {
  if (cost === 0) return '$0.00';
  if (cost < 0.0001) return '<$0.0001';
  if (cost < 0.01) return '$' + cost.toFixed(4);
  if (cost < 1) return '$' + cost.toFixed(3);
  return '$' + cost.toFixed(2);
}

/**
 * Format token count with K/M suffix
 * @param {number} tokens - Token count
 * @return {string} Formatted count (e.g., "1.2K", "3.5M")
 */
function formatTokenCount(tokens) {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K';
  return (tokens / 1000000).toFixed(2) + 'M';
}

/**
 * Get all available models with pricing
 * @return {Array} Array of model info objects
 */
function getAllModelPricing() {
  return Object.keys(MODEL_PRICING).map(function(modelId) {
    var pricing = MODEL_PRICING[modelId];
    return {
      id: modelId,
      name: pricing.displayName,
      inputPerMillion: pricing.input,
      outputPerMillion: pricing.output,
      notes: pricing.notes,
      updated: pricing.updated
    };
  });
}

/**
 * Compare costs across models for a given workload
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @return {Array} Array of costs sorted by total cost
 */
function compareModelCosts(inputTokens, outputTokens) {
  var comparisons = Object.keys(MODEL_PRICING).map(function(modelId) {
    return calculateTokenCost(modelId, inputTokens, outputTokens);
  });
  
  // Sort by total cost (cheapest first)
  comparisons.sort(function(a, b) {
    return a.totalCost - b.totalCost;
  });
  
  return comparisons;
}
