-- 1. FIX: Enable RLS on all remaining tables that were missing it.
-- Without RLS enabled, the Supabase auto-generated API allows ANY authenticated or anon user 
-- to INSERT/UPDATE/DELETE records in these tables. This is a critical security vulnerability.
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- 2. FIX: Restrict Draws, Charities, and Payouts to Read-Only for normal users, Admin full-access
CREATE POLICY "Anyone can view active charities" ON public.charities FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view draws" ON public.draws FOR SELECT USING (true);

-- Note: Admin-only modifications are inherently protected by NOT creating an INSERT/UPDATE/DELETE
-- policy for the 'authenticated' role. Admins will modify these using the Supabase Service Role Key 
-- via backend API routes (e.g. /api/admin/draw) which bypasses RLS safely.

-- 3. FIX: Enforce ACTIVE SUBSCRIPTIONS at the Database Level for Score Submissions.
-- Previously, the policy only checked `auth.uid() = user_id`. An attacker could bypass the Next.js frontend
-- and hit the Supabase API directly to insert scores even if they cancelled their subscription.
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.scores;

CREATE POLICY "Users can insert their own scores if actively subscribed" ON public.scores 
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND subscription_status = 'active'
  )
);

-- 4. FIX: Restrict Winnings and Draw Entries
-- Users should never be able to insert their own winnings or draw entries directly. They must be managed by the Admin cron/API.
CREATE POLICY "Users can view their own draw entries" ON public.draw_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own winnings" ON public.winnings FOR SELECT USING (auth.uid() = user_id);
-- No insert/update policies -> locks it down so ONLY the backend service role can create entries!

-- 5. FIX: Restrict subscriptions to Read-Only for users
CREATE POLICY "Users can view their own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
-- Modifications to subscriptions table are handled by Stripe Webhooks using the Service Role.
