import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { VerificationActions } from "./VerificationActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Shield, FileCheck, ExternalLink, AlertTriangle, UserCheck } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VerificationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: winning } = await supabase
    .from("winnings")
    .select("*, user:users(full_name, email), draw:draws(draw_date, winning_numbers)")
    .eq("id", id)
    .single();

  if (!winning) notFound();

  // SECURE FILE VIEW: Create a signed URL for 60 seconds (prevents public leakage)
  let signedUrl = null;
  if (winning.proof_url) {
    const { data } = await supabase.storage
      .from("winner-proofs")
      .createSignedUrl(winning.proof_url, 60);
    signedUrl = data?.signedUrl;
  }

  const u = winning.user as { full_name: string | null; email: string };
  const draw = winning.draw as { draw_date: string; winning_numbers: number[] };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="text-blue-400" size={24} />
            Winner Verification
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Reviewing transaction ID: {id}</p>
        </div>
        {winning.requires_secondary_approval && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-full text-xs font-bold animate-pulse">
                <AlertTriangle size={14} />
                SECONDARY APPROVAL REQUIRED
            </div>
        )}
      </div>

      {/* Financial stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Prize Amount</p>
          <p className="text-3xl font-bold gradient-text-gold">{formatCurrency(winning.amount)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Current Status</p>
          <span className={`badge mt-1 ${
            winning.status === 'paid' ? 'badge-primary' : 
            winning.status === 'approved' ? 'badge-success' : 
            winning.status === 'under_review' ? 'badge-warning' : 'badge-accent'
          }`}>
            {winning.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Winner info */}
      <div className="card">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-4">Claim Details</p>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Player</p>
              <p className="font-semibold text-white">{u.full_name ?? "Unknown"}</p>
              <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Draw Date</p>
              <p className="font-semibold text-white">{formatDate(draw.draw_date)}</p>
            </div>
          </div>
          <div className="space-y-4">
           <div>
              <p className="text-xs text-[var(--text-muted)]">Winning Numbers</p>
              <div className="flex gap-1 mt-1">
                {draw.winning_numbers?.map((n: number, i: number) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 text-xs font-bold shadow-lg shadow-yellow-500/10">
                    {n}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Secondary Approval From</p>
              <p className="font-semibold text-white">{winning.approved_by_admin_2 ? "ADMIN APPROVED" : "N/A"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Proof */}
      <div className="card">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-4">Proof of Identity / Win</p>
        {signedUrl ? (
          <div>
            <div className="rounded-xl overflow-hidden border border-[var(--border)] mb-3 bg-[var(--surface-2)] shadow-inner">
              <img
                src={signedUrl}
                alt="Winner proof"
                className="w-full max-h-80 object-contain"
              />
            </div>
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm text-blue-400 hover:bg-blue-500/10"
            >
              <ExternalLink size={14} /> Open in New Tab
            </a>
          </div>
        ) : (
          <div className="p-12 text-center border border-dashed border-[var(--border)] rounded-xl">
             <AlertTriangle size={32} className="text-[var(--text-muted)] mx-auto mb-2" />
             <p className="text-sm text-[var(--text-muted)]">No verification proof available.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card">
        <VerificationActions 
          winningId={id} 
          currentStatus={winning.status} 
          requiresSecondary={winning.requires_secondary_approval}
          secondaryApproved={!!winning.approved_by_admin_2}
          currentUserId={user.id} 
        />
      </div>
    </div>
  );
}
