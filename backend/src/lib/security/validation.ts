/**
 * Zod Validation Schemas for API Routes
 * 
 * Centralized request body schemas for the heaviest API routes.
 * These prevent malformed requests, payload bombs, and provide
 * clear error messages for debugging.
 * 
 * @version 1.0.0
 */

import { z } from 'zod/v4';

// ============================================
// SHARED SCHEMAS
// ============================================

/** Encrypted API key - opaque string, reasonable max length */
const encryptedApiKeySchema = z.string().max(4096);

/** AI provider identifier */
const providerSchema = z.string().max(20).optional();

/** Model identifier */
const modelIdSchema = z.string().max(100).optional();

/** User email */
const emailSchema = z.string().email().max(320).optional();

/** User UUID */
const userIdSchema = z.string().max(128).optional();

// ============================================
// /api/agent/parse-chain
// ============================================

export const parseChainBodySchema = z.object({
  command: z.string().min(1).max(10000),
  context: z.record(z.string(), z.unknown()).optional(),
  provider: providerSchema,
  encryptedApiKey: encryptedApiKeySchema.optional(),
  specificModel: modelIdSchema,
  model: z.string().max(20).optional(),
  // Managed mode
  managedMode: z.boolean().optional(),
  userId: userIdSchema,
  userEmail: emailSchema,
  // Conversation
  conversationHistory: z.array(z.unknown()).max(50).optional(),
  // Continuation: sent when the first batch was incomplete and needs more steps
  continuation: z.object({
    originalCommand: z.string().min(1).max(10000),
    priorStepsSummary: z.string().max(50000),
    cellMap: z.string().max(50000),
  }).optional(),
  // Progress tracking: sidebar polls /api/agent/plan-progress?planId=... for live updates
  planId: z.string().max(64).optional(),
}).strict().refine(
  data => !!(data.encryptedApiKey || data.managedMode),
  { message: 'Either encryptedApiKey or managedMode=true is required' }
);

// ============================================
// /api/query
// ============================================

export const queryBodySchema = z.object({
  model: z.string().min(1).max(20),
  input: z.string().min(1).max(50000),
  userEmail: emailSchema,
  userId: userIdSchema,
  specificModel: modelIdSchema,
  encryptedApiKey: encryptedApiKeySchema,
  imageUrl: z.string().url().max(2048).optional(),
  taskType: z.string().max(50).optional(),
  skipCache: z.boolean().optional(),
}).refine(
  data => !!(data.userEmail || data.userId),
  { message: 'Either userEmail or userId is required' }
);

// ============================================
// /api/jobs (POST - create job)
// ============================================

export const createJobBodySchema = z.object({
  userEmail: emailSchema,
  userId: userIdSchema,
  inputs: z.array(z.string().max(50000)).min(1).max(10000),
  config: z.object({
    model: z.string().min(1).max(20),
    specificModel: modelIdSchema,
    encryptedApiKey: encryptedApiKeySchema,
    taskType: z.string().max(50).optional(),
    prompt: z.string().max(10000).optional(),
  }),
}).refine(
  data => !!(data.userEmail || data.userId),
  { message: 'Either userEmail or userId is required' }
);

// ============================================
// /api/agent/fix-formula
// ============================================

export const fixFormulaBodySchema = z.object({
  formula: z.string().min(1).max(5000),
  error: z.string().min(1).max(200),
  column: z.string().min(1).max(10),
  description: z.string().max(1000).optional(),
  retryNumber: z.number().int().min(1).max(5).optional(),
  sheetContext: z.object({
    headers: z.array(z.string().max(200)).max(50).optional(),
    sampleData: z.array(z.array(z.string().max(500)).max(50)).max(10).optional(),
    crossSheetData: z.array(z.object({
      sheetName: z.string().max(200),
      headers: z.array(z.string().max(200)).max(20),
      rows: z.array(z.array(z.string().max(500)).max(20)).max(20),
    })).max(5).optional(),
  }).optional(),
  // Auth fields
  provider: providerSchema,
  encryptedApiKey: encryptedApiKeySchema.optional(),
  specificModel: modelIdSchema,
  model: z.string().max(20).optional(),
  managedMode: z.boolean().optional(),
  userId: userIdSchema,
  userEmail: emailSchema,
}).strict().refine(
  data => !!(data.encryptedApiKey || data.managedMode),
  { message: 'Either encryptedApiKey or managedMode=true is required' }
);

// ============================================
// VALIDATION HELPER
// ============================================

/**
 * Validate a request body against a schema.
 * Returns { success: true, data } or { success: false, error: string }.
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: `Validation error: ${messages}` };
}
