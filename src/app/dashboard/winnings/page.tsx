import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProofUploadForm } from "./ProofUploadForm";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Upload, Trophy } from "lucide-react";

export default async function WinnerVerificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: winnings } = await supabase
    .from("winnings")
    .select("*, draw:draws(draw_date, winning_numbers)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const unverified = (winnings ?? []).filter((w: { status: string }) => w.status === "unverified");
  const verified = (winnings ?? []).filter((w: { status: string }) => w.status !== "unverified");

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Trophy className="text-yellow-400" size={24} />
          Winner Verification
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Upload proof for your wins to get paid. Admin will review within 48 hours.
        </p>
      </div>

      {/* Pending uploads */}
      {unverified.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-white">Wins Awaiting Proof Upload</h2>
          {unverified.map((w: { id: string; amount: number; match_tier: number; proof_url: string | null; draw?: { draw_date?: string } }) => (
            <div key={w.id} className="card border-yellow-500/25 bg-yellow-500/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-bold gradient-text-gold">{formatCurrency(w.amount)}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {w.match_tier}-match · {w.draw?.draw_date ? formatDate(w.draw.draw_date) : "—"}
                  </p>
                </div>
                <span className="badge badge-warning">Unverified</span>
              </div>
              {w.proof_url ? (
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <Upload size={14} /> Proof uploaded — awaiting admin review
                </p>
              ) : (
                <ProofUploadForm winningId={w.id} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Verified / paid history */}
      {verified.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-5">Verified Wins</h2>
          <div className="space-y-3">
            {verified.map((w: { id: string; amount: number; match_tier: number; status: string; draw?: { draw_date?: string } }) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3 glass-light rounded-xl">
                <div>
                  <p className="text-sm font-bold text-white">{formatCurrency(w.amount)}</p>
                  <p className="text-xs text-[var(--text-muted)]">{w.match_tier}-match · {w.draw?.draw_date ? formatDate(w.draw.draw_date) : "—"}</p>
                </div>
                <span className={`badge text-xs ${w.status === "paid" ? "badge-success" : "badge-primary"}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(winnings ?? []).length === 0 && (
        <div className="card text-center py-16">
          <Trophy size={40} className="text-[var(--text-muted)] mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">No wins yet. Keep playing each month!</p>
        </div>
      )}
    </div>
  );
}
