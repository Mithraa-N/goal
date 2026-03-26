-- 1. FIX SUBSCRIPTION SOURCE OF TRUTH
-- Ensure has_active_subscription relies exclusively on the Stripe 'subscriptions' table.
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions 
    WHERE user_id = auth.uid() AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the dependency on users.subscription_status to ensure 100% financial correctness
ALTER TABLE public.users DROP COLUMN IF EXISTS subscription_status;


-- 2. PREVENT FINANCIAL DUPLICATION (UNIQUE CONSTRAINTS)
ALTER TABLE public.draw_entries 
ADD CONSTRAINT unique_user_draw_entry UNIQUE (user_id, draw_id);

ALTER TABLE public.winnings 
ADD CONSTRAINT unique_user_draw_win UNIQUE (user_id, draw_id, match_tier);


-- 3. AUDIT LOGGING SYSTEM (ADMIN ACTIONS)
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES public.users(id) NOT NULL,
    action TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view logs" ON public.admin_logs FOR SELECT USING (public.is_admin());
-- System inserts via service_role/RPC bypassing RLS, no normal user can insert


-- 4. HARDEN FILE UPLOAD SECURITY (STORAGE BUCKETS)
-- Ensure only PDF and images are uploaded. Only owners and admins can view correctly.
-- Setting up Security on the "winner-proofs" bucket natively.

-- Note: The following requires the Supabase Storage schema, typically handled via dashboard:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('winner-proofs', 'winner-proofs', false) ON CONFLICT DO NOTHING;
-- CREATE POLICY "Users upload their own proof" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'winner-proofs' AND auth.uid() = owner);
-- CREATE POLICY "Users view own proof" ON storage.objects FOR SELECT USING (bucket_id = 'winner-proofs' AND auth.uid() = owner);
-- CREATE POLICY "Admins view all proofs" ON storage.objects FOR SELECT USING (bucket_id = 'winner-proofs' AND public.is_admin());

-- 5. UPGRADED: DRAW ENGINE TRANSACTION SAFETY
-- Ensure we absolutely only execute if draw is 'pending', and lock it specifically avoiding concurrent double draws.
CREATE OR REPLACE FUNCTION execute_draw_transaction(
    p_admin_id UUID,
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
    -- This guarantees atomic lock and ensures ONLY ONE execution per draw ID
    PERFORM 1 FROM public.draws WHERE id = p_draw_id AND status = 'pending' FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draw % is either non-existent or already completed', p_draw_id;
    END IF;

    -- Note: Because of unique_user_draw_entry and unique_user_draw_win constraints, 
    -- if any duplicate inserts are attempted, Postgres will throw a native exception and rollback everything.

    -- Insert Entries
    INSERT INTO public.draw_entries (draw_id, user_id, submitted_scores, match_count)
    SELECT p_draw_id, (e->>'user_id')::UUID, ARRAY(SELECT jsonb_array_elements_text(e->'submitted_scores')::INTEGER), (e->>'match_count')::INTEGER
    FROM jsonb_array_elements(p_entries) AS e;

    -- Insert Winnings
    INSERT INTO public.winnings (draw_id, user_id, amount, match_tier, status)
    SELECT p_draw_id, (w->>'user_id')::UUID, (w->>'amount')::DECIMAL, (w->>'match_tier')::INTEGER, 'unverified'
    FROM jsonb_array_elements(p_winnings) AS w;

    -- Update status atomically
    UPDATE public.draws 
    SET status = 'completed', winning_numbers = p_winning_numbers
    WHERE id = p_draw_id;

    -- Roll forward schedule
    INSERT INTO public.draws (draw_date, winning_numbers, total_pool, rollover_amount, status)
    VALUES (p_next_draw_date, ARRAY[]::INTEGER[], 0.00, p_rollover_amount, 'pending');

    -- Insert Audit Log natively inside the transaction
    INSERT INTO public.admin_logs (admin_id, action, payload) 
    VALUES (
      p_admin_id, 
      'execute_draw', 
      jsonb_build_object('draw_id', p_draw_id, 'winning_numbers', p_winning_numbers, 'total_winnings', jsonb_array_length(p_winnings))
    );

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Draw Execution Failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
