import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DrawEngine } from "./DrawEngine";
import { Zap, Info } from "lucide-react";

export default async function AdminDrawPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: pendingDraw } = await supabase
    .from("draws")
    .select("*")
    .eq("status", "pending")
    .order("draw_date", { ascending: true })
    .limit(1)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Zap className="text-yellow-400" size={24} />
          Draw Engine
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Execute or simulate the monthly prize draw.
        </p>
      </div>

      {!pendingDraw && (
        <div className="card border-yellow-500/30 bg-yellow-500/5 flex gap-3 p-4">
          <Info size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-300">
            No pending draw found. Create a new draw in the database first with status &quot;pending&quot; and a future draw date.
          </p>
        </div>
      )}

      {pendingDraw && (
        <div className="card border-blue-500/20">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-3">Current Pending Draw</p>
          <p className="text-white font-semibold">{new Date(pendingDraw.draw_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          <div className="flex gap-4 mt-2 text-sm text-[var(--text-muted)]">
            <span>Pool: <strong className="text-white">£{pendingDraw.total_pool}</strong></span>
            <span>Rollover: <strong className="text-yellow-400">£{pendingDraw.rollover_amount}</strong></span>
          </div>
        </div>
      )}

      <div className="card">
        <DrawEngine />
      </div>
    </div>
  );
}
