import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ScoreEntryForm } from "./ScoreEntryForm";
import { ScoreList } from "./ScoreList";
import { Target, Info } from "lucide-react";

export default async function ScoresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, scoresRes] = await Promise.all([
    supabase.from("subscriptions").select("status").eq("user_id", user.id).single(),
    supabase.from("scores").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const isActive = profileRes.data?.status === "active";
  const scores = scoresRes.data ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Target className="text-blue-400" size={24} />
          My Scores
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Your rolling 5 scores — the latest 5 are entered into each monthly draw.
        </p>
      </div>

      {/* Info banner */}
      <div className="glass-light rounded-xl p-4 flex gap-3 border border-blue-500/20">
        <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--text-secondary)]">
          You can hold up to <strong className="text-white">5 scores</strong> at a time. When you add a 6th,
          the oldest is automatically removed. Scores must be between{" "}
          <strong className="text-white">1</strong> and <strong className="text-white">45</strong>.
        </p>
      </div>

      {/* Score entry form */}
      <div className="card">
        <h2 className="font-semibold text-white mb-5">Submit a New Score</h2>
        <ScoreEntryForm isActive={isActive} currentCount={scores.length} />
      </div>

      {/* Score list */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white">Your Scores</h2>
          <span className="badge badge-primary">{scores.length}/5 slots used</span>
        </div>
        <ScoreList scores={scores} />
      </div>
    </div>
  );
}
