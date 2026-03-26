-- 1. STRIPE IDEMPOTENCY TABLE
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADMIN ROLE FUNCTION
-- Secure function to check if a user is an admin without recursive policy loops
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ACTIVE SUBSCRIPTION FUNCTION
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND subscription_status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. COMPLETE RLS HARDENING
-- Enable RLS on everything securely
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_charity_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- 5. APPLY PARANOID POLICIES

-- Users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
-- Users cannot insert users. Handled by Supabase Auth trigger.
-- Users cannot update users (is_admin, subscription_status handled by service role!)

-- Subscriptions
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
-- Modifications handled purely by Stripe Webhooks (service role)

-- Scores
DROP POLICY IF EXISTS "Users can view their own scores" ON public.scores;
DROP POLICY IF EXISTS "Users can insert their own scores if actively subscribed" ON public.scores;
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.scores;

CREATE POLICY "Users view own scores" ON public.scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert scores conditionally" ON public.scores FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND public.has_active_subscription()
  -- DB checks value BETWEEN 1 AND 45 natively
);
CREATE POLICY "Users delete own scores" ON public.scores FOR DELETE USING (auth.uid() = user_id);

-- Draws (Strict Admin modification, public read)
DROP POLICY IF EXISTS "Anyone can view draws" ON public.draws;
CREATE POLICY "Public read draws" ON public.draws FOR SELECT USING (true);
CREATE POLICY "Admin full access draws" ON public.draws FOR ALL USING (public.is_admin());

-- Draw Entries
DROP POLICY IF EXISTS "Users can view their own draw entries" ON public.draw_entries;
CREATE POLICY "Users view own draw entries" ON public.draw_entries FOR SELECT USING (auth.uid() = user_id);
-- No insert/update for users (Handled by Draw Engine RPC / Service Role)

-- Winnings
DROP POLICY IF EXISTS "Users can view their own winnings" ON public.winnings;
CREATE POLICY "Users view own winnings" ON public.winnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upload proof" ON public.winnings FOR UPDATE USING (auth.uid() = user_id) 
WITH CHECK (status = 'unverified'); -- Users can only update to upload proof if unverified
CREATE POLICY "Admin full access winnings" ON public.winnings FOR ALL USING (public.is_admin());

-- Charities
DROP POLICY IF EXISTS "Anyone can view active charities" ON public.charities;
CREATE POLICY "Public view active charities" ON public.charities FOR SELECT USING (is_active = true);
CREATE POLICY "Admin full access charities" ON public.charities FOR ALL USING (public.is_admin());

-- Charity Preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_charity_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_charity_preferences;
CREATE POLICY "Users view own charity pref" ON public.user_charity_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own charity pref" ON public.user_charity_preferences FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (contribution_percentage >= 10);
CREATE POLICY "Users insert own charity pref" ON public.user_charity_preferences FOR INSERT WITH CHECK (auth.uid() = user_id AND contribution_percentage >= 10);

-- Payouts
CREATE POLICY "Users view own payouts" ON public.payouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin full access payouts" ON public.payouts FOR ALL USING (public.is_admin());

-- 6. DATA INTEGRITY
-- Just explicitly adding/renewing CONSTRAINTS to be paranoid
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_score_range') THEN
    ALTER TABLE public.scores ADD CONSTRAINT valid_score_range CHECK (value >= 1 AND value <= 45);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_contribution') THEN
    ALTER TABLE public.user_charity_preferences ADD CONSTRAINT valid_contribution CHECK (contribution_percentage >= 10);
  END IF;
END $$;


-- 7. TRANSACTIONAL DRAW ENGINE RPC
-- Ensures atomicity during draw executions. Either all inserts succeed or it rolls back entirely.
CREATE OR REPLACE FUNCTION execute_draw_transaction(
    p_draw_id UUID,
    p_winning_numbers INTEGER[],
    p_entries JSONB,     -- [{"user_id": "uuid", "submitted_scores": [1,2,3,4,5], "match_count": 3}]
    p_winnings JSONB,    -- [{"user_id": "uuid", "amount": 100, "match_tier": 5}]
    p_rollover_amount DECIMAL,
    p_next_draw_date TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
    entry RECORD;
    win RECORD;
BEGIN
    -- 1. Lock the pending draw to prevent race conditions
    PERFORM 1 FROM public.draws WHERE id = p_draw_id AND status = 'pending' FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draw % is either non-existent or not pending', p_draw_id;
    END IF;

    -- 2. Bulk Insert Draw Entries
    INSERT INTO public.draw_entries (draw_id, user_id, submitted_scores, match_count)
    SELECT p_draw_id, (e->>'user_id')::UUID, ARRAY(SELECT jsonb_array_elements_text(e->'submitted_scores')::INTEGER), (e->>'match_count')::INTEGER
    FROM jsonb_array_elements(p_entries) AS e;

    -- 3. Bulk Insert Winnings
    INSERT INTO public.winnings (draw_id, user_id, amount, match_tier, status)
    SELECT p_draw_id, (w->>'user_id')::UUID, (w->>'amount')::DECIMAL, (w->>'match_tier')::INTEGER, 'unverified'
    FROM jsonb_array_elements(p_winnings) AS w;

    -- 4. Mark Current Draw Completed & Set Winning Numbers
    UPDATE public.draws 
    SET status = 'completed', winning_numbers = p_winning_numbers
    WHERE id = p_draw_id;

    -- 5. Auto-Create Next Draw with Rollover
    INSERT INTO public.draws (draw_date, winning_numbers, total_pool, rollover_amount, status)
    VALUES (p_next_draw_date, ARRAY[]::INTEGER[], 0.00, p_rollover_amount, 'pending');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    -- Postgres automatically rolls back on exception
    RAISE EXCEPTION 'Draw execution transaction failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
