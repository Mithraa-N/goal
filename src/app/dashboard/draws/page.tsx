import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formatDate, formatCurrency, countMatches } from "@/lib/utils";
import { ScoreBalls } from "@/components/scores/ScoreComponents";
import { Trophy, Calendar, Clock, CheckCircle } from "lucide-react";
import { Draw, DrawEntry } from "@/lib/types";

export default async function DrawsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [activeDrawRes, pastDrawsRes, myEntriesRes, myWinningsRes] = await Promise.all([
    supabase.from("draws").select("*").eq("status", "pending").order("draw_date", { ascending: true }).limit(1).single(),
    supabase.from("draws").select("*").eq("status", "completed").order("draw_date", { ascending: false }).limit(10),
    supabase.from("draw_entries").select("*, draw:draws(*)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("winnings").select("*, draw:draws(draw_date, winning_numbers)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const activeDraw: Draw | null = activeDrawRes.data;
  const pastDraws: Draw[] = pastDrawsRes.data ?? [];
  const myEntries: DrawEntry[] = myEntriesRes.data ?? [];
  const myWinnings = myWinningsRes.data ?? [];

  const totalWon = myWinnings.reduce((s: number, w: { amount: number }) => s + w.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Trophy className="text-yellow-400" size={24} />
          Draws & Winnings
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Monthly draws, your entries, and a full history of wins.
        </p>
      </div>

      {/* Active draw countdown */}
      {activeDraw && (
        <div className="card border-yellow-500/25 bg-yellow-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="badge badge-warning mb-3">
                <Clock size={10} className="mr-1" /> Next Draw
              </div>
              <h2 className="text-xl font-bold text-white">{formatDate(activeDraw.draw_date)}</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Pool: <span className="text-yellow-400 font-semibold">{formatCurrency(activeDraw.total_pool)}</span>
                {activeDraw.rollover_amount > 0 && (
                  <span className="ml-2 text-orange-400">+ {formatCurrency(activeDraw.rollover_amount)} rollover</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)]">Your scores are</p>
              <p className="text-sm font-semibold text-green-400 flex items-center gap-1 justify-end">
                <CheckCircle size={14} /> Auto-entered
              </p>
            </div>
          </div>

          {/* Prize breakdown */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { tier: "5 Match", pct: "40%", amount: (activeDraw.total_pool + activeDraw.rollover_amount) * 0.4, label: "Jackpot", color: "text-yellow-400" },
              { tier: "4 Match", pct: "35%", amount: activeDraw.total_pool * 0.35, label: "Major", color: "text-blue-400" },
              { tier: "3 Match", pct: "25%", amount: activeDraw.total_pool * 0.25, label: "Minor", color: "text-cyan-400" },
            ].map(({ tier, pct, amount, label, color }) => (
              <div key={tier} className="glass-light rounded-xl p-3 text-center">
                <p className={`text-xs font-semibold ${color}`}>{tier}</p>
                <p className="text-base font-bold text-white mt-1">{formatCurrency(amount)}</p>
                <p className="text-xs text-[var(--text-muted)]">{pct} of pool</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My winnings summary */}
      {myWinnings.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Trophy size={16} className="text-yellow-400" /> My Winnings
            </h2>
            <span className="text-lg font-bold gradient-text-gold">{formatCurrency(totalWon)} total</span>
          </div>
          <div className="space-y-3">
            {myWinnings.map((w: { id: string; match_tier: number; amount: number; status: string; draw?: { winning_numbers?: number[]; draw_date?: string } }) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3 glass-light rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    w.match_tier === 5 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                    w.match_tier === 4 ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                    "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  }`}>
                    {w.match_tier}★
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{formatCurrency(w.amount)}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {w.draw?.draw_date ? formatDate(w.draw.draw_date) : "—"} · {w.match_tier}-number match
                    </p>
                  </div>
                </div>
                <span className={`badge ${
                  w.status === "paid" ? "badge-success" :
                  w.status === "verified" ? "badge-primary" : "badge-warning"
                } text-xs`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past draws */}
      {pastDraws.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-5 flex items-center gap-2">
            <Calendar size={16} className="text-[var(--text-muted)]" /> Past Draws
          </h2>
          <div className="space-y-4">
            {pastDraws.map((draw) => {
              const myEntry = myEntries.find((e) => e.draw_id === draw.id);
              const matches = myEntry ? countMatches(myEntry.submitted_scores, draw.winning_numbers) : 0;
              return (
                <div key={draw.id} className="p-4 glass-light rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">{formatDate(draw.draw_date)}</p>
                    <div className="flex items-center gap-2">
                      {myEntry && matches > 0 && (
                        <span className={`badge text-xs ${matches >= 5 ? "badge-warning" : matches >= 4 ? "badge-success" : "badge-primary"}`}>
                          {matches} match{matches !== 1 ? "es" : ""}!
                        </span>
                      )}
                      {myEntry && matches === 0 && <span className="badge badge-accent text-xs">Entered</span>}
                      {!myEntry && <span className="text-xs text-[var(--text-muted)]">Not entered</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-1.5">Winning Numbers</p>
                      <ScoreBalls scores={draw.winning_numbers} winningNumbers={myEntry?.submitted_scores} size="sm" />
                    </div>
                    {myEntry && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1.5">My Entry</p>
                        <ScoreBalls scores={myEntry.submitted_scores} winningNumbers={draw.winning_numbers} size="sm" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pastDraws.length === 0 && !activeDraw && (
        <div className="card text-center py-16">
          <Trophy size={40} className="text-[var(--text-muted)] mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">No draws yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
