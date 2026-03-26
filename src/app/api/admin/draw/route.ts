import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { generateRandomDraw, generateFrequencyDraw, countMatches, calculatePrizeSplits } from "@/lib/utils";

const SYSTEM_CRON_ID = "00000000-0000-0000-0000-000000000000";

function getAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase configuration");
  }
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(request: NextRequest) {
  // 1. Dual authentication validation
  const secret = request.headers.get("x-admin-secret");
  const configuredSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user && secret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized access detected." }, { status: 401 });
  }

  if (user) {
    const { data: profile } = await serverSupabase.from("users").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Access denied. Admin required." }, { status: 403 });
    }
  }

  const adminId = user?.id || SYSTEM_CRON_ID;
  const body = await request.json();
  const mode: "random" | "frequency" = body.mode ?? "random";
  const simulate: boolean = body.simulate ?? false;
  const supabase = getAdminClient();

  // 2. Data Acquisition
  const [{ data: activeSubs }, { data: pendingDraw }] = await Promise.all([
    supabase.from("subscriptions").select("user_id").eq("status", "active"),
    supabase.from("draws").select("id, total_pool, rollover_amount").eq("status", "pending").order("draw_date", { ascending: true }).limit(1).single()
  ]);

  if (!activeSubs || activeSubs.length === 0) {
    return NextResponse.json({ error: "No active subscribers found." }, { status: 400 });
  }

  if (!pendingDraw) {
    return NextResponse.json({ error: "No pending draw found." }, { status: 400 });
  }

  const userIds = activeSubs.map((s: { user_id: string }) => s.user_id);
  const { data: allScores, error: scoreErr } = await supabase.from("scores").select("user_id, value").in("user_id", userIds);

  if (scoreErr) return NextResponse.json({ error: scoreErr.message }, { status: 500 });

  // 3. Logic Layer
  let winningNumbers: number[];
  const userScoresMap: Record<string, number[]> = {};
  (allScores ?? []).forEach((s: { user_id: string; value: number }) => {
    if (!userScoresMap[s.user_id]) userScoresMap[s.user_id] = [];
    userScoresMap[s.user_id].push(s.value);
  });

  if (mode === "frequency") {
    winningNumbers = generateFrequencyDraw(userIds.map(id => userScoresMap[id] ?? []));
  } else {
    winningNumbers = generateRandomDraw();
  }

  // FINANCIALS
  const currentTotalPool = Number(pendingDraw.total_pool ?? 0) + Number(pendingDraw.rollover_amount ?? 0);
  
  // Charity is 10% of CURRENT pool (collected this month)
  const charityAmount = Number(pendingDraw.total_pool ?? 0) * 0.10;
  
  // Remaining 90% + rollover is prize pool
  const prizePool = currentTotalPool - charityAmount;
  const splits = calculatePrizeSplits(prizePool);

  const entriesToInsert = userIds.map((uid: string) => ({
    user_id: uid,
    submitted_scores: userScoresMap[uid] ?? [],
    match_count: countMatches(userScoresMap[uid] ?? [], winningNumbers),
  }));

  const winningsToInsert: Array<{ user_id: string; amount: number; match_tier: number }> = [];
  let rolloverAmount = 0;

  // Prize Distribution
  const fiveMatch = entriesToInsert.filter(e => e.match_count === 5);
  if (fiveMatch.length > 0) {
    const perWinner = splits.fiveMatch / fiveMatch.length;
    fiveMatch.forEach(e => winningsToInsert.push({ user_id: e.user_id, amount: perWinner, match_tier: 5 }));
  } else {
    rolloverAmount += splits.fiveMatch;
  }

  const fourMatch = entriesToInsert.filter(e => e.match_count === 4);
  if (fourMatch.length > 0) {
    const perWinner = splits.fourMatch / fourMatch.length;
    fourMatch.forEach(e => winningsToInsert.push({ user_id: e.user_id, amount: perWinner, match_tier: 4 }));
  } else {
    rolloverAmount += splits.fourMatch; // Any un-won prize rolls over
  }

  const threeMatch = entriesToInsert.filter(e => e.match_count === 3);
  if (threeMatch.length > 0) {
    const perWinner = splits.threeMatch / threeMatch.length;
    threeMatch.forEach(e => winningsToInsert.push({ user_id: e.user_id, amount: perWinner, match_tier: 3 }));
  } else {
    rolloverAmount += splits.threeMatch;
  }

  if (simulate) {
    return NextResponse.json({
      simulate: true, winningNumbers, mode, currentTotalPool, prizePool, charityAmount,
      winners: { fiveMatch: fiveMatch.length, fourMatch: fourMatch.length, threeMatch: threeMatch.length },
      rolloverAmount, winnings: winningsToInsert,
    });
  }

  // 4. ATOMIC COMMIT (Double-Entry V3)
  const executionHash = Buffer.from(`${pendingDraw.id}-${winningNumbers.join(",")}-${mode}`).toString("base64");
  const nextDrawDate = new Date();
  nextDrawDate.setMonth(nextDrawDate.getMonth() + 1);
  nextDrawDate.setDate(1);

  const { error: txErr } = await supabase.rpc("execute_draw_transaction_v3_cb_protected", {
    p_admin_id: adminId,
    p_draw_id: pendingDraw.id,
    p_winning_numbers: winningNumbers,
    p_entries: entriesToInsert,
    p_winnings: winningsToInsert,
    p_rollover_amount: rolloverAmount,
    p_charity_amount: charityAmount,
    p_next_draw_date: nextDrawDate.toISOString(),
    p_execution_hash: executionHash
  });

  if (txErr) {
    console.error("Atomic draw commit failure:", txErr);
    return NextResponse.json({ error: `Fintech audit failure: ${txErr.message}` }, { status: 500 });
  }

  // 5. Fraud Routine
  startTransitionaryFraudDetect(supabase, userIds.slice(0, 50));

  return NextResponse.json({
    success: true, winningNumbers, mode, currentTotalPool, rolloverAmount,
    winners: { fiveMatch: fiveMatch.length, fourMatch: fourMatch.length, threeMatch: threeMatch.length }
  });
}

async function startTransitionaryFraudDetect(supabase: any, userIds: string[]) {
  try {
    for (const uid of userIds) {
      await supabase.rpc("detect_fraud_patterns", { p_user_id: uid });
    }
  } catch (err) {
    console.error("Fraud detection routine failed:", err);
  }
}
