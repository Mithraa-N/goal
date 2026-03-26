-- ======================================================
-- TRUE DOUBLE-ENTRY ACCOUNTING & FRAUD INTELLIGENCE
-- ======================================================

-- 1. DROP OLD LEDGER (WE ARE REFACTORING TO TRUE DOUBLE-ENTRY)
DROP TABLE IF EXISTS public.financial_ledger CASCADE;

-- 2. TRUE DOUBLE-ENTRY LEDGER
CREATE TABLE public.financial_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_group_id UUID NOT NULL, -- Logical group (e.g., one Stripe payment, one Draw)
    user_id UUID REFERENCES public.users(id),
    account TEXT NOT NULL CHECK (account IN ('system_revenue', 'user_wallet', 'charity_pool', 'jackpot_pool', 'rollover_pool')),
    type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL CHECK (category IN ('subscription', 'payout', 'charity_allocation', 'rollover_allocation', 'refund')),
    reference_id UUID, -- Link to draw_id, subscription_id, etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for reconciliation performance
CREATE INDEX idx_ledger_group ON public.financial_ledger(entry_group_id);
CREATE INDEX idx_ledger_account ON public.financial_ledger(account);

-- 3. ENFORCE BALANCED ENTRIES (DEBIT = CREDIT)
CREATE OR REPLACE FUNCTION public.check_ledger_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_debit_sum NUMERIC(12, 2);
    v_credit_sum NUMERIC(12, 2);
BEGIN
    -- This check runs after the transaction is complete (deferred)
    -- Or we use a check within the RPC. For simplicity in Supabase, we enforce it in the RPC
    -- but we can add a constraint trigger for safety if supported.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. FRAUD SCORING & RESPONSE SYSTEM
CREATE TABLE IF NOT EXISTS public.user_risk_scores (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    risk_score NUMERIC DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update risk when flags are added
CREATE OR REPLACE FUNCTION public.update_user_risk()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_risk_scores
    SET risk_score = risk_score + (
        CASE 
            WHEN NEW.severity = 'low' THEN 10
            WHEN NEW.severity = 'medium' THEN 30
            WHEN NEW.severity = 'high' THEN 60
            WHEN NEW.severity = 'critical' THEN 100
            ELSE 0 
        END
    ),
    last_updated = NOW()
    WHERE user_id = NEW.user_id;
    
    -- Auto-block if high risk
    UPDATE public.user_risk_scores
    SET is_blocked = TRUE
    WHERE user_id = NEW.user_id AND risk_score >= 100;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_risk_on_flag
AFTER INSERT ON public.fraud_flags
FOR EACH ROW EXECUTE FUNCTION public.update_user_risk();

-- 5. RECONCILIATION VIEW
CREATE OR REPLACE VIEW public.account_balances AS
SELECT 
    account,
    SUM(CASE WHEN type='credit' THEN amount ELSE -amount END) AS balance,
    COUNT(*) as entry_count
FROM public.financial_ledger
GROUP BY account;

-- 6. PERIOD LOCKING
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- 7. RECONCILIATION FUNCTIONS
CREATE OR REPLACE FUNCTION public.validate_draw_integrity(p_draw_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_collected NUMERIC(12,2);
    v_total_payouts NUMERIC(12,2);
    v_charity_alloc NUMERIC(12,2);
    v_rollover_alloc NUMERIC(12,2);
    v_expected_pool NUMERIC(12,2);
    v_imbalance NUMERIC(12,2);
BEGIN
    -- Pull from ledger entries specific to this draw_id
    SELECT COALESCE(SUM(amount), 0) INTO v_total_payouts FROM public.financial_ledger WHERE reference_id = p_draw_id AND category = 'payout' AND type = 'credit';
    SELECT COALESCE(SUM(amount), 0) INTO v_charity_alloc FROM public.financial_ledger WHERE reference_id = p_draw_id AND category = 'charity_allocation' AND type = 'credit';
    SELECT COALESCE(SUM(amount), 0) INTO v_rollover_alloc FROM public.financial_ledger WHERE reference_id = p_draw_id AND category = 'rollover_allocation' AND type = 'credit';
    
    -- Expected pool is recorded in the draws table
    SELECT (total_pool + rollover_amount) INTO v_expected_pool FROM public.draws WHERE id = p_draw_id;
    
    v_imbalance := v_expected_pool - (v_total_payouts + v_charity_alloc + v_rollover_alloc);
    
    RETURN jsonb_build_object(
        'draw_id', p_draw_id,
        'expected_pool', v_expected_pool,
        'actual_distributed', (v_total_payouts + v_charity_alloc + v_rollover_alloc),
        'imbalance', v_imbalance,
        'status', CASE WHEN ABS(v_imbalance) < 0.01 THEN 'CLEAN' ELSE 'MISMATCH' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. GLOBAL RECONCILIATION
CREATE OR REPLACE FUNCTION public.validate_financial_integrity()
RETURNS JSONB AS $$
DECLARE
    v_debit_total NUMERIC(12,2);
    v_credit_total NUMERIC(12,2);
    v_imbalance NUMERIC(12,2);
BEGIN
    SELECT SUM(amount) INTO v_debit_total FROM public.financial_ledger WHERE type = 'debit';
    SELECT SUM(amount) INTO v_credit_total FROM public.financial_ledger WHERE type = 'credit';
    
    v_imbalance := COALESCE(v_debit_total, 0) - COALESCE(v_credit_total, 0);
    
    RETURN jsonb_build_object(
        'total_debits', v_debit_total,
        'total_credits', v_credit_total,
        'net_imbalance', v_imbalance,
        'is_perfect', ABS(v_imbalance) < 0.01
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. FRAUD RESPONSE: LOCK SCORE SUBMISSION
DROP POLICY IF EXISTS "Users insert scores conditionally" ON public.scores;
CREATE POLICY "Users insert scores if active and not blocked" ON public.scores FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND public.has_active_subscription()
  AND NOT EXISTS (
    SELECT 1 FROM public.user_risk_scores WHERE user_id = auth.uid() AND is_blocked = TRUE
  )
);

-- 10. REFACTORED DRAW EXECUTION TRANSACTION V3 (DOUBLE-ENTRY)
CREATE OR REPLACE FUNCTION execute_draw_transaction_v3(
    p_admin_id UUID,
    p_draw_id UUID,
    p_winning_numbers INTEGER[],
    p_entries JSONB,
    p_winnings JSONB,
    p_rollover_amount NUMERIC,
    p_charity_amount NUMERIC,
    p_next_draw_date TIMESTAMPTZ,
    p_execution_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_entry_group_id UUID := uuid_generate_v4();
    v_draw_pool NUMERIC(12,2);
    v_win JSONB;
    v_total_win_payout NUMERIC(12,2) := 0;
BEGIN
    -- 1. IDEMPOTENCY & PERIOD LOCK CHECK
    IF EXISTS (SELECT 1 FROM public.draws WHERE id = p_draw_id AND (status != 'pending' OR is_locked = TRUE)) THEN
        RAISE EXCEPTION 'Draw already processed or locked.';
    END IF;

    -- 2. FETCH DRAW POOL
    SELECT (total_pool + rollover_amount) INTO v_draw_pool FROM public.draws WHERE id = p_draw_id FOR UPDATE;

    -- 3. UPDATE DRAW
    UPDATE public.draws 
    SET status = 'completed', 
        winning_numbers = p_winning_numbers,
        execution_hash = p_execution_hash,
        is_locked = TRUE
    WHERE id = p_draw_id;

    -- 4. DOUBLE-ENTRY: DEBIT SYSTEM REVENUE (The whole pool being distributed)
    INSERT INTO public.financial_ledger (entry_group_id, account, type, amount, category, reference_id)
    VALUES (v_entry_group_id, 'system_revenue', 'debit', v_draw_pool, 'payout', p_draw_id);

    -- 5. CREDIT WINNERS
    FOR v_win IN SELECT * FROM jsonb_array_elements(p_winnings) LOOP
        INSERT INTO public.financial_ledger (entry_group_id, user_id, account, type, amount, category, reference_id)
        VALUES (v_entry_group_id, (v_win->>'user_id')::UUID, 'user_wallet', 'credit', (v_win->>'amount')::NUMERIC, 'payout', p_draw_id);
        
        -- Insert into winnings table
        INSERT INTO public.winnings (draw_id, user_id, amount, match_tier, status)
        VALUES (p_draw_id, (v_win->>'user_id')::UUID, (v_win->>'amount')::NUMERIC, (v_win->>'match_tier')::INTEGER, 'unverified');
        
        v_total_win_payout := v_total_win_payout + (v_win->>'amount')::NUMERIC;
    END LOOP;

    -- 6. CREDIT CHARITY POOL
    IF p_charity_amount > 0 THEN
        INSERT INTO public.financial_ledger (entry_group_id, account, type, amount, category, reference_id)
        VALUES (v_entry_group_id, 'charity_pool', 'credit', p_charity_amount, 'charity_allocation', p_draw_id);
    END IF;

    -- 7. CREDIT ROLLOVER POOL
    IF p_rollover_amount > 0 THEN
        INSERT INTO public.financial_ledger (entry_group_id, account, type, amount, category, reference_id)
        VALUES (v_entry_group_id, 'rollover_pool', 'credit', p_rollover_amount, 'rollover_allocation', p_draw_id);
    END IF;

    -- FINAL BALANCE CHECK: SUM(debit) MUST EQUAL SUM(credit)
    -- In this case: v_draw_pool (debit) = v_total_win_payout + p_charity_amount + p_rollover_amount (credits)
    IF ABS(v_draw_pool - (v_total_win_payout + p_charity_amount + p_rollover_amount)) > 0.01 THEN
        RAISE EXCEPTION 'Accounting imbalance detected: Expected %, got %', v_draw_pool, (v_total_win_payout + p_charity_amount + p_rollover_amount);
    END IF;

    -- 8. SNAPSHOTS & LOGS
    INSERT INTO public.draw_score_snapshots (draw_id, user_id, scores)
    SELECT p_draw_id, (e->>'user_id')::UUID, ARRAY(SELECT jsonb_array_elements_text(e->'submitted_scores')::INTEGER)
    FROM jsonb_array_elements(p_entries) AS e;

    INSERT INTO public.draws (draw_date, status, rollover_amount)
    VALUES (p_next_draw_date, 'pending', p_rollover_amount);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
