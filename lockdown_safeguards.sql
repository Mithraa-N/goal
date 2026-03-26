-- ======================================================
-- CIRCUIT BREAKER RLS & PAYOUT LOCKDOWN
-- ======================================================

-- 1. Payouts Lockdown (Protect Winnings from modification during Circuit Breaker)
DROP POLICY IF EXISTS "Users upload proof" ON public.winnings;
CREATE POLICY "Users upload proof (Circuit Breaker Protected)" ON public.winnings FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND NOT check_circuit_breaker() -- Only if circuit breaker is OFF
)
WITH CHECK (
  status = 'unverified' 
  AND (CASE WHEN proof_url IS NOT NULL THEN true ELSE false END)
);

-- 2. Admin Draw RPC Protection (Double-check inside the RPC)
CREATE OR REPLACE FUNCTION execute_draw_transaction_v3_cb_protected(
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
BEGIN
    -- KILL SWITCH: REJECT ALL DRAWS IF ACTIVE
    IF check_circuit_breaker() THEN
        PERFORM public.generate_system_alert(
            'DRAW_ATTEMPT_DURING_LOCKDOWN', 
            'critical', 
            'Draw attempted while system circuit breaker is ACTIVE.',
            jsonb_build_object('draw_id', p_draw_id, 'admin_id', p_admin_id)
        );
        RAISE EXCEPTION 'System lockdown active! No draws allowed until reset.';
    END IF;

    -- Call original RPC now that we passed the kill switch
    RETURN public.execute_draw_transaction_v3(
        p_admin_id, p_draw_id, p_winning_numbers, p_entries, p_winnings, 
        p_rollover_amount, p_charity_amount, p_next_draw_date, p_execution_hash
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
