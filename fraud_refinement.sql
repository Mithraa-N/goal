-- ======================================================
-- FRAUD DETECTION REFINEMENT (SQL BUG FIX)
-- ======================================================

CREATE OR REPLACE FUNCTION public.detect_fraud_patterns(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_last_scores INTEGER[];
    v_pattern_count INTEGER;
BEGIN
    -- Correctly identify if a user has submitted the EXACT SAME 5 scores in 3 or more of their last 10 draws.
    -- This identifies static pattern abuse or bot behavior.
    WITH pattern_counts AS (
        SELECT submitted_scores, COUNT(*) as occurs
        FROM (
            SELECT submitted_scores 
            FROM public.draw_entries 
            WHERE user_id = p_user_id 
            ORDER BY created_at DESC 
            LIMIT 10
        ) sub
        GROUP BY submitted_scores
    )
    SELECT occurs, submitted_scores INTO v_pattern_count, v_last_scores
    FROM pattern_counts
    WHERE occurs >= 3
    LIMIT 1;

    IF v_pattern_count IS NOT NULL THEN
        -- Check if it was already flagged to avoid spam
        IF NOT EXISTS (
            SELECT 1 FROM public.fraud_flags 
            WHERE user_id = p_user_id 
            AND reason = 'REPEATED_SCORE_PATTERN' 
            AND metadata->>'pattern' = v_last_scores::TEXT
            AND created_at > (NOW() - INTERVAL '30 days')
        ) THEN
            INSERT INTO public.fraud_flags (user_id, reason, severity, metadata)
            VALUES (p_user_id, 'REPEATED_SCORE_PATTERN', 'medium', jsonb_build_object(
                'pattern', v_last_scores, 
                'frequency', v_pattern_count,
                'sample_size', 10
            ));
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
