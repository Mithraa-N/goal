import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formatCurrency, formatDate, getDaysUntil, capitalise } from "@/lib/utils";
import Link from "next/link";
import {
  Trophy, Target, Heart, TrendingUp, Calendar,
  ChevronRight, Star, AlertCircle, CheckCircle, Clock
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  // Parallel data fetches
  const [profileRes, scoresRes, subscriptionRes, charityPrefRes, winningsRes, currentDrawRes] =
    await Promise.all([
      supabase.from("users").select("full_name, email").eq("id", authUser.id).single(),
      supabase.from("scores").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("subscriptions").select("status, current_period_end").eq("user_id", authUser.id).order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("user_charity_preferences").select("*, charity:charities(*)").eq("user_id", authUser.id).single(),
      supabase.from("winnings").select("*, draw:draws(draw_date, winning_numbers)").eq("user_id", authUser.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("draws").select("*").eq("status", "pending").order("draw_date", { ascending: true }).limit(1).single(),
    ]);

  const profile = profileRes.data;
  const scores = scoresRes.data ?? [];
  const subscription = subscriptionRes.data;
  const charityPref = charityPrefRes.data;
  const winnings = winningsRes.data ?? [];
  const currentDraw = currentDrawRes.data;

  const isActive = subscription?.status === "active";
  const totalWon = winnings.reduce((sum: number, w: { amount: number }) => sum + (w.amount ?? 0), 0);
  const daysUntilDraw = currentDraw ? getDaysUntil(currentDraw.draw_date) : null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {profile?.full_name?.split(" ")[0] ?? "Golfer"} 👋
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Here&apos;s your GolfDraw summary for this month.
        </p>
      </div>

      {/* Subscription banner */}
      {!isActive && (
        <div className="card border-yellow-500/30 bg-yellow-500/5 flex items-center gap-4 p-4">
          <AlertCircle size={20} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-300">Subscription Required</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Activate your subscription to enter monthly draws and submit scores.
            </p>
          </div>
          <Link href="/pricing" className="btn btn-sm" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white", boxShadow: "0 4px 12px rgba(245,158,11,0.4)" }}>
            Subscribe Now
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Subscription",
            value: capitalise(subscription?.status ?? "inactive"),
            icon: CheckCircle,
            color: isActive ? "text-green-400" : "text-[var(--text-muted)]",
            sub: subscription?.current_period_end ? `Renews ${formatDate(subscription.current_period_end)}` : "No active plan",
          },
          {
            label: "Scores on Record",
            value: `${scores.length}/5`,
            icon: Target,
            color: "text-blue-400",
            sub: scores.length > 0 ? `Latest: ${scores[0]?.value}` : "No scores yet",
          },
          {
            label: "Total Winnings",
            value: formatCurrency(totalWon),
            icon: Trophy,
            color: "text-yellow-400",
            sub: `Across ${winnings.length} draw${winnings.length !== 1 ? "s" : ""}`,
          },
          {
            label: "Next Draw",
            value: daysUntilDraw !== null ? `${daysUntilDraw}d` : "—",
            icon: Calendar,
            color: "text-cyan-400",
            sub: currentDraw ? formatDate(currentDraw.draw_date) : "No draw scheduled",
          },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--text-muted)] font-medium">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scores card */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-blue-400" />
              <h2 className="font-semibold text-white">My Scores</h2>
              <span className="badge badge-primary text-xs">{scores.length}/5 slots</span>
            </div>
            <Link href="/dashboard/scores" className="btn btn-ghost btn-sm text-blue-400 hover:text-blue-300">
              Manage <ChevronRight size={14} />
            </Link>
          </div>

          {scores.length === 0 ? (
            <div className="text-center py-12">
              <Target size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-secondary)] text-sm">No scores yet</p>
              <Link href="/dashboard/scores" className="btn btn-primary btn-sm mt-4">
                Submit Your First Score
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {scores.map((score: { id: string; value: number; score_date: string; created_at: string }) => (
                <div key={score.id} className="flex items-center justify-between px-4 py-3 glass-light rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                      {score.value}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Score: {score.value}</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatDate(score.score_date)}</p>
                    </div>
                  </div>
                  <span className="badge badge-primary text-xs">{formatDate(score.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Charity card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={16} className="text-rose-400" />
              <h2 className="font-semibold text-white text-sm">My Charity</h2>
            </div>
            {charityPref?.charity ? (
              <div>
                <p className="font-semibold text-white">{(charityPref.charity as { name: string }).name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Contributing <span className="text-green-400 font-semibold">{charityPref.contribution_percentage}%</span> monthly
                </p>
                <Link href="/dashboard/charity" className="btn btn-ghost btn-sm mt-3 text-rose-400 hover:text-rose-300 px-0">
                  Change charity <ChevronRight size={12} />
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-3">No charity selected yet</p>
                <Link href="/dashboard/charity" className="btn btn-sm w-full" style={{ background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "white" }}>
                  Choose a charity
                </Link>
              </div>
            )}
          </div>

          {/* Recent winnings card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} className="text-yellow-400" />
              <h2 className="font-semibold text-white text-sm">Recent Wins</h2>
            </div>
            {winnings.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-[var(--text-muted)]">No winnings yet — keep playing!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {winnings.slice(0, 3).map((w: { id: string; amount: number; match_tier: number; status: string }) => (
                  <div key={w.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <div>
                      <p className="text-sm text-white font-semibold">{formatCurrency(w.amount)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{w.match_tier}-match</p>
                    </div>
                    <span className={`badge ${w.status === "paid" ? "badge-success" : w.status === "verified" ? "badge-primary" : "badge-warning"} text-xs`}>
                      {w.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
