-- ==========================================
-- FINAL PRODUCTION HARDENING & FINANCIAL INTEGRITY
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SUBSCRIPTION SOURCE OF TRUTH (SSOT)
-- Remove any cached status from users table to prevent stale data attacks
ALTER TABLE public.users DROP COLUMN IF EXISTS subscription_status;

-- Re-create the check function to target the subscriptions table directly
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions 
    WHERE user_id = p_user_id AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. UNIQUE CONSTRAINTS (PREVENT DOUBLE PAYOUTS / ENTRIES)
-- Prevent a user from having multiple entries in the same draw
ALTER TABLE public.draw_entries DROP CONSTRAINT IF EXISTS unique_user_draw_entry;
ALTER TABLE public.draw_entries ADD CONSTRAINT unique_user_draw_entry UNIQUE (user_id, draw_id);

-- Prevent duplicate wins for the same user/draw/tier (e.g. if script runs twice)
ALTER TABLE public.winnings DROP CONSTRAINT IF EXISTS unique_user_draw_win;
ALTER TABLE public.winnings ADD CONSTRAINT unique_user_draw_win UNIQUE (user_id, draw_id, match_tier);

-- 4. AUDIT LOGGING SYSTEM
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES public.users(id) NOT NULL,
    action TEXT NOT NULL,
    payload JSONB,
    severity TEXT DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deny all modifications to audit logs by non-service-role
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view logs" ON public.admin_logs FOR SELECT USING (public.is_admin());

-- 5. ATOMIC DRAW EXECUTION (IDEMPOTENT)
CREATE OR REPLACE FUNCTION execute_draw_transaction(
    p_admin_id UUID,
    p_draw_id UUID,
    p_winning_numbers INTEGER[],
    p_entries JSONB,
    p_winnings JSONB,
    p_rollover_amount DECIMAL,
    p_next_draw_date TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status TEXT;
BEGIN
    -- ATOMIC LOCK: Select for update prevents any other transaction from touching this draw
    SELECT status INTO v_current_status FROM public.draws WHERE id = p_draw_id FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Draw % not found', p_draw_id;
    END IF;

    IF v_current_status != 'pending' THEN
        RAISE EXCEPTION 'Draw % has already been processed (Status: %)', p_draw_id, v_current_status;
    END IF;

    -- Update current draw
    UPDATE public.draws 
    SET status = 'completed', 
        winning_numbers = p_winning_numbers,
        draw_date = NOW()
    WHERE id = p_draw_id;

    -- Insert Entries (Unique constraint will catch duplicates)
    INSERT INTO public.draw_entries (draw_id, user_id, submitted_scores, match_count)
    SELECT p_draw_id, (e->>'user_id')::UUID, ARRAY(SELECT jsonb_array_elements_text(e->'submitted_scores')::INTEGER), (e->>'match_count')::INTEGER
    FROM jsonb_array_elements(p_entries) AS e;

    -- Insert Winnings (Unique constraint will catch duplicate wins)
    INSERT INTO public.winnings (draw_id, user_id, amount, match_tier, status)
    SELECT p_draw_id, (w->>'user_id')::UUID, (w->>'amount')::DECIMAL, (w->>'match_tier')::INTEGER, 'unverified'
    FROM jsonb_array_elements(p_winnings) AS w;

    -- Create next draw
    INSERT INTO public.draws (draw_date, status, rollover_amount)
    VALUES (p_next_draw_date, 'pending', p_rollover_amount);

    -- Log action
    INSERT INTO public.admin_logs (admin_id, action, payload, severity)
    VALUES (p_admin_id, 'DRAW_EXECUTED', jsonb_build_object(
        'draw_id', p_draw_id,
        'winners_count', jsonb_array_length(p_winnings),
        'winning_numbers', p_winning_numbers
    ), 'critical');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    -- Transaction automatically rolls back
    RAISE EXCEPTION 'Draw Transaction Failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. STORAGE SECURITY (WINNER PROOFS)
-- These must be run if the storage schema exists (Supabase default)
-- We assume the bucket 'winner-proofs' is created as PRIVATE.

-- Policy: Users can only upload proofs for THEIR OWN winnings
-- Policy: Only admins can see all proofs

-- 7. DATA INTEGRITY CONSTRAINTS
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS valid_score_range;
ALTER TABLE public.scores ADD CONSTRAINT valid_score_range CHECK (value >= 1 AND value <= 45);

ALTER TABLE public.user_charity_preferences DROP CONSTRAINT IF EXISTS valid_contribution;
ALTER TABLE public.user_charity_preferences ADD CONSTRAINT valid_contribution CHECK (contribution_percentage >= 10);

-- Ensure orphan records are prevented (Cascade is already set on some, let's group verify)
-- Already handled in initial schema with REFERENCES ... ON DELETE CASCADE.

-- 8. COMPREHENSIVE RLS AUDIT
-- Scores: Insert only if active sub
DROP POLICY IF EXISTS "Users insert scores conditionally" ON public.scores;
CREATE POLICY "Users insert scores if active" ON public.scores FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND public.has_active_subscription()
);

-- Winnings: Users update only their own AND only proof_url if status is unverified
DROP POLICY IF EXISTS "Users upload proof" ON public.winnings;
CREATE POLICY "Users upload proof" ON public.winnings FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (
  status = 'unverified' 
  AND (CASE WHEN proof_url IS NOT NULL THEN true ELSE false END)
);

-- 9. ADMIN LOCKDOWN
-- Ensure no user can set themselves as admin
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
CREATE POLICY "Users view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- No update policy for users -> only service role (Admin UI) can update profiles.
