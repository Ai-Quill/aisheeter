-- ============================================
-- Migration 007: Integer Credit System
-- Replaces USD-based managed credits with integer credits.
-- Free: 100 credits/month, Pro: 1000 credits/month, Legacy: 0 (BYOK only)
-- BYOK: Free 600 req/month, Pro/Legacy unlimited
-- Run with: psql $DATABASE_URL -f 007_integer_credits.sql
-- ============================================

-- 1. Set credits_balance to tier-appropriate values
-- credits_balance already exists (INTEGER DEFAULT 100 from migration 001)
-- credits_reset_at already exists from migration 001
UPDATE users SET credits_balance = 100 WHERE plan_tier = 'free';
UPDATE users SET credits_balance = 1000 WHERE plan_tier = 'pro';
UPDATE users SET credits_balance = 0 WHERE plan_tier = 'legacy';

-- 2. Ensure credits_reset_at is set for users who don't have one
UPDATE users SET credits_reset_at = NOW() + INTERVAL '30 days'
WHERE credits_reset_at IS NULL;

-- 3. Replace debit_managed_credits to work with integer credits_balance
CREATE OR REPLACE FUNCTION debit_managed_credits(p_user_id UUID, p_credits INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
  v_reset_at TIMESTAMP WITH TIME ZONE;
  v_tier TEXT;
BEGIN
  SELECT credits_balance, credits_reset_at, plan_tier
  INTO v_balance, v_reset_at, v_tier
  FROM users WHERE id = p_user_id;

  -- Auto-reset if period expired
  IF v_reset_at IS NOT NULL AND v_reset_at < NOW() THEN
    v_balance := CASE v_tier
      WHEN 'pro' THEN 1000
      WHEN 'free' THEN 100
      ELSE 0
    END;
    UPDATE users
    SET credits_balance = v_balance - p_credits,
        credits_reset_at = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING credits_balance INTO v_balance;
  ELSE
    UPDATE users
    SET credits_balance = GREATEST(0, credits_balance - p_credits),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING credits_balance INTO v_balance;
  END IF;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- 4. Replace check_managed_credits to return integer values
CREATE OR REPLACE FUNCTION check_managed_credits(p_user_id UUID)
RETURNS TABLE(
  can_use BOOLEAN,
  credits_remaining INTEGER,
  credits_limit INTEGER
) AS $$
DECLARE
  v_balance INTEGER;
  v_reset_at TIMESTAMP WITH TIME ZONE;
  v_tier TEXT;
  v_limit INTEGER;
BEGIN
  SELECT u.credits_balance, u.credits_reset_at, u.plan_tier
  INTO v_balance, v_reset_at, v_tier
  FROM users u WHERE u.id = p_user_id;

  v_limit := CASE v_tier
    WHEN 'pro' THEN 1000
    WHEN 'free' THEN 100
    ELSE 0
  END;

  -- Auto-reset if period expired
  IF v_reset_at IS NOT NULL AND v_reset_at < NOW() THEN
    v_balance := v_limit;
    PERFORM reset_managed_credits(p_user_id);
  END IF;

  can_use := v_balance > 0 AND v_limit > 0;
  credits_remaining := v_balance;
  credits_limit := v_limit;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 5. Replace reset_managed_credits to reset integer balance
CREATE OR REPLACE FUNCTION reset_managed_credits(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
BEGIN
  SELECT plan_tier INTO v_tier FROM users WHERE id = p_user_id;

  v_limit := CASE v_tier
    WHEN 'pro' THEN 1000
    WHEN 'free' THEN 100
    ELSE 0
  END;

  UPDATE users
  SET credits_balance = v_limit,
      credits_reset_at = NOW() + INTERVAL '30 days',
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Update check_request_limit: free tier now 600 BYOK requests/month
CREATE OR REPLACE FUNCTION check_request_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_is_legacy BOOLEAN;
BEGIN
  SELECT plan_tier, requests_this_period, is_legacy_user
  INTO v_plan, v_count, v_is_legacy
  FROM users
  WHERE id = p_user_id;

  IF v_is_legacy OR v_plan = 'legacy' OR v_plan = 'pro' THEN
    RETURN TRUE;
  END IF;

  IF v_plan = 'free' THEN
    RETURN v_count < 600;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. Update index for credit reset queries (drop old conditional index, create new)
DROP INDEX IF EXISTS idx_users_managed_reset;
CREATE INDEX IF NOT EXISTS idx_users_credits_reset ON users(credits_reset_at)
WHERE credits_balance > 0;

SELECT 'Migration 007: Integer credits system - completed!' AS status;

-- Verification
SELECT plan_tier, COUNT(*), AVG(credits_balance) as avg_credits
FROM users
GROUP BY plan_tier;
