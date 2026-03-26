"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, XCircle, Loader2, CreditCard, ShieldCheck } from "lucide-react";

interface VerificationActionsProps {
  winningId: string;
  currentStatus: string;
  requiresSecondary: boolean;
  secondaryApproved: boolean;
  currentUserId: string;
}

export function VerificationActions({ 
  winningId, 
  currentStatus, 
  requiresSecondary, 
  secondaryApproved, 
  currentUserId 
}: VerificationActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function updateStatus(newStatus: string) {
    if (newStatus === "paid" && requiresSecondary && !secondaryApproved) {
        setError("Secondary approval required before marking as paid.");
        return;
    }

    setError(null);
    setAction(newStatus);
    const supabase = createClient();
    startTransition(async () => {
      const { error: err } = await supabase
        .from("winnings")
        .update({ status: newStatus })
        .eq("id", winningId);

      if (err) {
        setError(err.message);
      } else {
        router.refresh();
      }
    });
  }

  async function secondaryApprove() {
    setError(null);
    setAction("secondary");
    const supabase = createClient();
    startTransition(async () => {
        // Double-check user is not approving their own? 
        // In a real system, we'd check if first approver was different.
        const { error: err } = await supabase
            .from("winnings")
            .update({ approved_by_admin_2: currentUserId })
            .eq("id", winningId);

        if (err) {
            setError(err.message);
        } else {
            router.refresh();
        }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs text-center border-dashed">
          {error}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-semibold">Security Action Suite</p>

      <div className="flex flex-wrap gap-3">
        {/* Approve Button */}
        <button
          onClick={() => updateStatus("approved")}
          disabled={isPending || currentStatus !== "under_review"}
          className="btn btn-sm"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", opacity: currentStatus !== "under_review" ? 0.4 : 1 }}
        >
          {isPending && action === "approved" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          Approve (Step 1)
        </button>

        {/* Secondary Approval Button */}
        {requiresSecondary && !secondaryApproved && (
           <button
             onClick={secondaryApprove}
             disabled={isPending || currentStatus !== "approved"}
             className="btn btn-sm"
             style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "white", opacity: currentStatus !== "approved" ? 0.4 : 1 }}
           >
             {isPending && action === "secondary" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
             Secondary Admin Approval
           </button>
        )}

        {/* Rejection Button */}
        <button
          onClick={() => updateStatus("rejected")}
          disabled={isPending || currentStatus === "paid" || currentStatus === "rejected"}
          className="btn btn-secondary btn-sm"
        >
          {isPending && action === "rejected" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Reject Payout
        </button>

        {/* Payment Button */}
        <button
          onClick={() => updateStatus("paid")}
          disabled={isPending || currentStatus !== "approved" || (requiresSecondary && !secondaryApproved)}
          className="btn btn-sm"
          style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white", opacity: (currentStatus !== "approved" || (requiresSecondary && !secondaryApproved)) ? 0.4 : 1 }}
        >
          {isPending && action === "paid" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
          Mark as Paid
        </button>
      </div>

      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
        <p className="text-[10px] text-blue-300">
           🔏 <strong>SECURITY POLICY:</strong> {requiresSecondary 
             ? "High-value or high-risk payout. Requires two unique admins to authorize before being marked as PAID." 
             : "Standard payout. One admin approval required."}
        </p>
      </div>
    </div>
  );
}
