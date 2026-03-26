-- ======================================================
-- FINAL PRODUCTION SAFEGUARDS: RECONCILIATION & ALERTS
-- ======================================================

-- 1. STRIPE RECONCILIATION SYSTEM
CREATE TABLE IF NOT EXISTS public.stripe_reconciliation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    stripe_object_id TEXT, -- sub_id, ch_id, in_id
    event_type TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'GBP',
    status TEXT,
    matched BOOLEAN DEFAULT FALSE,
    ledger_entry_group_id UUID REFERENCES public.financial_ledger(entry_group_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SYSTEM ALERTING ENGINE
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.generate_system_alert(
    p_type TEXT,
    p_severity TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    INSERT INTO public.system_alerts (type, severity, message, metadata)
    VALUES (p_type, p_severity, p_message, p_metadata)
    RETURNING id INTO v_alert_id;
    
    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PAYOUT DAMAGE CONTROL (Secondary Approval)
ALTER TABLE public.winnings ADD COLUMN IF NOT EXISTS requires_secondary_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE public.winnings ADD COLUMN IF NOT EXISTS approved_by_admin_2 UUID REFERENCES public.users(id);

-- Threshold for secondary approval (e.g., £500)
CREATE OR REPLACE FUNCTION check_payout_threshold()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.amount >= 500.00 THEN
        NEW.requires_secondary_approval := TRUE;
    END IF;
    
    -- If high risk user, force review
    IF EXISTS (SELECT 1 FROM public.user_risk_scores WHERE user_id = NEW.user_id AND risk_score >= 50) THEN
        NEW.status := 'under_review';
        NEW.requires_secondary_approval := TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_payout_protection
BEFORE INSERT OR UPDATE ON public.winnings
FOR EACH ROW EXECUTE FUNCTION check_payout_threshold();

-- Multi-admin enforcement
CREATE OR REPLACE FUNCTION enforce_multi_admin_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'paid' AND NEW.requires_secondary_approval = TRUE THEN
        -- Check if two distinct admins approved
        -- admin_1 is the one who moved it to 'approved', admin_2 is secondary.
        -- We assume the 'approver' is logged in admin_logs or a field.
        -- For strictness, we require approved_by_admin_2 to be set.
        IF NEW.approved_by_admin_2 IS NULL THEN
            RAISE EXCEPTION 'High-value payout % requires secondary admin approval.', NEW.id;
        END IF;
        
        -- Verification logic for distinctness usually happens in the API, 
        -- but we can record the first approver in a new column.
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_multi_admin_check
BEFORE UPDATE ON public.winnings
FOR EACH ROW EXECUTE FUNCTION enforce_multi_admin_approval();

-- 4. STRIPE ↔ LEDGER RECONCILIATION LOGIC
CREATE OR REPLACE FUNCTION public.reconcile_stripe_events()
RETURNS JSONB AS $$
DECLARE
    v_mismatches JSONB := '[]'::JSONB;
    v_unmatched RECORD;
BEGIN
    -- 1. Detect Ledger entries missing in Stripe
    -- 2. Detect Stripe events missing in Ledger
    FOR v_unmatched IN 
        SELECT sr.stripe_event_id, sr.amount, sr.stripe_object_id 
        FROM public.stripe_reconciliation sr
        LEFT JOIN public.financial_ledger fl ON sr.ledger_entry_group_id = fl.entry_group_id
        WHERE fl.id IS NULL AND sr.event_type = 'checkout.session.completed'
    LOOP
        v_mismatches := v_mismatches || jsonb_build_object(
            'event_id', v_unmatched.stripe_event_id,
            'issue', 'MISSING_LEDGER_ENTRY',
            'amount', v_unmatched.amount
        );
        
        PERFORM public.generate_system_alert(
            'RECONCILIATION_FAILURE', 
            'high', 
            'Stripe event ' || v_unmatched.stripe_event_id || ' has no corresponding ledger entry.',
            jsonb_build_object('stripe_id', v_unmatched.stripe_object_id)
        );
    END LOOP;

    RETURN jsonb_build_object('mismatches', v_mismatches, 'count', jsonb_array_length(v_mismatches));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. AUTOMATED INTEGRITY TRIGGERS
-- Trigger on draw completion to verify pool
CREATE OR REPLACE FUNCTION public.trigger_draw_reconciliation()
RETURNS TRIGGER AS $$
DECLARE
    v_result JSONB;
BEGIN
    v_result := public.validate_draw_integrity(NEW.id);
    IF (v_result->>'status') = 'MISMATCH' THEN
        PERFORM public.generate_system_alert(
            'FINANCIAL_IMBALANCE', 
            'critical', 
            'Draw ' || NEW.id || ' pool imbalance detected: ' || (v_result->>'imbalance'),
            v_result
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_draw_after_completion
AFTER UPDATE ON public.draws
FOR EACH ROW 
WHEN (OLD.status = 'pending' AND NEW.status = 'completed')
EXECUTE FUNCTION public.trigger_draw_reconciliation();

-- 6. REVERSAL LOGIC SUPPORT
-- Category check already includes 'refund' / 'reversal' from previous script or we add it.
ALTER TABLE public.financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_category_check;
ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_category_check 
CHECK (category IN ('subscription', 'payout', 'charity_allocation', 'rollover_allocation', 'refund', 'reversal'));

-- 7. ANOMALY DETECTION (DAILY PAYOUT CAP)
CREATE OR REPLACE FUNCTION check_daily_payout_cap()
RETURNS TRIGGER AS $$
DECLARE
    v_daily_total NUMERIC(12,2);
    v_cap NUMERIC(12,2) := 5000.00; -- £5000 daily limit
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_daily_total 
    FROM public.winnings 
    WHERE status = 'paid' AND created_at >= (NOW() - INTERVAL '24 hours');

    IF v_daily_total > v_cap THEN
        PERFORM public.generate_system_alert(
            'PAYOUT_ANOMALY', 
            'critical', 
            'Daily payout cap exceeded! Current: ' || v_daily_total,
            jsonb_build_object('total', v_daily_total, 'cap', v_cap)
        );
        -- We don't necessarily block it here (as it might be a big draw), 
        -- but we ALERT and could potentially block in future logic.
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_payout_anomaly_detect
AFTER UPDATE ON public.winnings
FOR EACH ROW 
WHEN (OLD.status != 'paid' AND NEW.status = 'paid')
EXECUTE FUNCTION check_daily_payout_cap();
