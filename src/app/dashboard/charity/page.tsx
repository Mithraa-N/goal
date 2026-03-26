import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CharitySelector } from "./CharitySelector";
import { Heart, ExternalLink } from "lucide-react";
import { Charity, UserCharityPreference } from "@/lib/types";

export default async function CharityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [charitiesRes, prefRes] = await Promise.all([
    supabase.from("charities").select("*").eq("is_active", true).order("name"),
    supabase.from("user_charity_preferences").select("*, charity:charities(*)").eq("user_id", user.id).single(),
  ]);

  const charities: Charity[] = charitiesRes.data ?? [];
  const preference: UserCharityPreference | null = prefRes.data;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Heart className="text-rose-400" size={24} />
          My Charity
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          At least 10% of your subscription goes to your chosen charity every month.
        </p>
      </div>

      {/* Current charity */}
      {preference?.charity && (
        <div className="card border-rose-500/20 bg-rose-500/5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-3">Currently Supporting</p>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/30 border border-rose-500/30 flex items-center justify-center">
              <Heart size={24} className="text-rose-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">{(preference.charity as unknown as Charity).name}</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Contributing <span className="text-green-400 font-bold">{preference.contribution_percentage}%</span> of your subscription monthly
              </p>
            </div>
            {(preference.charity as unknown as Charity).website_url && (
              <a href={(preference.charity as unknown as Charity).website_url!} target="_blank" rel="noopener noreferrer"
                className="btn btn-ghost btn-sm text-[var(--text-muted)] hover:text-white">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Charity selector */}
      <div className="card">
        <h2 className="font-semibold text-white mb-1">
          {preference ? "Change Your Charity" : "Choose a Charity"}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          You can change your charity at any time. The change takes effect from your next billing cycle.
        </p>
        <CharitySelector
          charities={charities}
          currentCharityId={preference?.charity_id ?? null}
          currentPercentage={preference?.contribution_percentage ?? 10}
        />
      </div>
    </div>
  );
}
