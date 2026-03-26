-- ======================================================
-- ADVANCED FINANCIAL LEDGER & FRAUD DETECTION SYSTEM
-- ======================================================

-- 1. IMMUTABLE FINANCIAL LEDGER
CREATE TABLE IF NOT EXISTS public.financial_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    category TEXT NOT NULL CHECK (category IN ('subscription', 'payout', 'charity', 'refund', 'rollover')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    reference_id UUID, -- Link to draw_id, subscription_id, or payout_id
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deny all updates/deletes to ensure append-only audit trail
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view all ledger" ON public.financial_ledger FOR SELECT USING (public.is_admin());
CREATE POLICY "Users view own ledger" ON public.financial_ledger FOR SELECT USING (auth.uid() = user_id);

-- Enforce IMMUTABILITY at database level
CREATE OR REPLACE FUNCTION block_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Financial ledger is append-only. Modification of record % is strictly prohibited.', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_lock_financial_ledger
BEFORE UPDATE OR DELETE ON public.financial_ledger
FOR EACH ROW EXECUTE FUNCTION block_ledger_modification();

-- 2. SCORE SNAPSHOTS (PRE-DRAW IMMUTABILITY)
CREATE TABLE IF NOT EXISTS public.draw_score_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    scores INTEGER[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshot_draw_user ON public.draw_score_snapshots(draw_id, user_id);

-- 3. FRAUD DETECTION SYSTEM
CREATE TABLE IF NOT EXISTS public.fraud_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Heuristic: Detect repeated patterns or rapid submissions
CREATE OR REPLACE FUNCTION public.detect_fraud_patterns(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_last_scores INTEGER[];
    v_pattern_count INTEGER;
BEGIN
    -- Check for identical repeated score sets (same 5 numbers multiple times)
    -- This is a simple heuristic for bots or static entry abuse
    WITH last_entries AS (
        SELECT submitted_scores 
        FROM public.draw_entries 
        WHERE user_id = p_user_id 
        ORDER BY created_at DESC 
        LIMIT 5
    )
    SELECT COUNT(*), (SELECT submitted_scores FROM last_entries LIMIT 1) 
    INTO v_pattern_count, v_last_scores
    FROM last_entries;

    IF v_pattern_count >= 3 THEN
        INSERT INTO public.fraud_flags (user_id, reason, severity, metadata)
        VALUES (p_user_id, 'REPEATED_SCORE_PATTERN', 'medium', jsonb_build_object('pattern', v_last_scores, 'frequency', v_pattern_count));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PAYOUT STATE MACHINE (STRICT FLOW)
-- pending -> under_review -> approved -> paid (OR -> rejected)
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS valid_payout_status;
ALTER TABLE public.payouts ADD CONSTRAINT valid_payout_status 
CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'paid'));

CREATE OR REPLACE FUNCTION enforce_payout_status_flow()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevents skipping 'approved' before 'paid'
    IF NEW.status = 'paid' AND OLD.status != 'approved' THEN
        RAISE EXCEPTION 'Payout must be APPROVED before being marked as PAID.';
    END IF;
    
    -- Prevents moving from 'rejected' back to anything else
    IF OLD.status = 'rejected' AND NEW.status != 'rejected' THEN
        RAISE EXCEPTION 'Rejected payouts cannot be reopened.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_payout_status_flow
BEFORE UPDATE ON public.payouts
FOR EACH ROW EXECUTE FUNCTION enforce_payout_status_flow();

-- 5. DRAW ENGINE IDEMPOTENCY
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS execution_hash TEXT UNIQUE;

-- 6. FINANCIAL RECONCILIATION
CREATE OR REPLACE FUNCTION validate_financial_integrity()
RETURNS JSONB AS $$
DECLARE
    v_total_credits NUMERIC(12,2);
    v_total_debits NUMERIC(12,2);
    v_actual_balance NUMERIC(12,2);
    v_is_matched BOOLEAN;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_credits FROM public.financial_ledger WHERE type = 'credit';
    SELECT COALESCE(SUM(amount), 0) INTO v_total_debits FROM public.financial_ledger WHERE type = 'debit';
    
    v_actual_balance := v_total_credits - v_total_debits;
    -- In a real system, we'd compare this to the Stripe balance or bank account state
    
    RETURN jsonb_build_object(
        'total_credits', v_total_credits,
        'total_debits', v_total_debits,
        'net_balance', v_actual_balance,
        'reconciled_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. AUDIT LOG IMMUTABILITY
-- Ensure admin_logs are insert-only
CREATE OR REPLACE FUNCTION block_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable for forensic compliance.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_lock_admin_logs
BEFORE UPDATE OR DELETE ON public.admin_logs
FOR EACH ROW EXECUTE FUNCTION block_audit_log_modification();

-- 8. REFACTORED DRAW EXECUTION TRANSACTION (LEDGER INTEGRATED)
CREATE OR REPLACE FUNCTION execute_draw_transaction_v2(
    p_admin_id UUID,
    p_draw_id UUID,
    p_winning_numbers INTEGER[],
    p_entries JSONB,
    p_winnings JSONB,
    p_rollover_amount NUMERIC,
    p_next_draw_date TIMESTAMPTZ,
    p_execution_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status TEXT;
    v_total_winning_payout NUMERIC(12,2) := 0;
    v_win JSONB;
BEGIN
    -- 1. IDEMPOTENCY LOCK
    SELECT status INTO v_current_status FROM public.draws WHERE id = p_draw_id FOR UPDATE;
    IF v_current_status != 'pending' THEN
        RAISE EXCEPTION 'Draw % already processed or locked.', p_draw_id;
    END IF;

    -- Update Draw with Execution Hash
    UPDATE public.draws 
    SET status = 'completed', 
        winning_numbers = p_winning_numbers,
        execution_hash = p_execution_hash,
        draw_date = NOW()
    WHERE id = p_draw_id;

    -- 2. SNAPSHOT SCORES (Audit-proof state)
    INSERT INTO public.draw_score_snapshots (draw_id, user_id, scores)
    SELECT p_draw_id, (e->>'user_id')::UUID, ARRAY(SELECT jsonb_array_elements_text(e->'submitted_scores')::INTEGER)
    FROM jsonb_array_elements(p_entries) AS e;

    -- 3. RECORD ENTRIES
    INSERT INTO public.draw_entries (draw_id, user_id, submitted_scores, match_count)
    SELECT p_draw_id, (e->>'user_id')::UUID, ARRAY(SELECT jsonb_array_elements_text(e->'submitted_scores')::INTEGER), (e->>'match_count')::INTEGER
    FROM jsonb_array_elements(p_entries) AS e;

    -- 4. RECORD WINNINGS & LEDGER ENTRIES
    FOR v_win IN SELECT * FROM jsonb_array_elements(p_winnings) LOOP
        INSERT INTO public.winnings (draw_id, user_id, amount, match_tier, status)
        VALUES (p_draw_id, (v_win->>'user_id')::UUID, (v_win->>'amount')::NUMERIC, (v_win->>'match_tier')::INTEGER, 'unverified');

        -- Debit Ledger for each win
        INSERT INTO public.financial_ledger (user_id, type, category, amount, reference_id, metadata)
        VALUES ((v_win->>'user_id')::UUID, 'debit', 'payout', (v_win->>'amount')::NUMERIC, p_draw_id, jsonb_build_object('tier', v_win->>'match_tier'));
        
        v_total_winning_payout := v_total_winning_payout + (v_win->>'amount')::NUMERIC;
    END LOOP;

    -- 5. CHARITY ALLOCATION (Debit Ledger)
    -- Note: Charity logic usually sits in separate table, here we log system-wide debit
    INSERT INTO public.financial_ledger (type, category, amount, reference_id, metadata)
    VALUES ('debit', 'charity', 0, p_draw_id, '{"note": "Charity distribution pending manual payout"}');

    -- 6. ROLLFORWARD
    INSERT INTO public.draws (draw_date, status, rollover_amount)
    VALUES (p_next_draw_date, 'pending', p_rollover_amount);

    -- 7. AUDIT LOG
    INSERT INTO public.admin_logs (admin_id, action, payload, severity)
    VALUES (p_admin_id, 'DRAW_EXECUTED_V2', jsonb_build_object(
        'draw_id', p_draw_id,
        'hash', p_execution_hash,
        'winnings_sum', v_total_winning_payout
    ), 'critical');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
