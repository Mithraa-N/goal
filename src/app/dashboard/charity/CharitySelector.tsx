"use client";

import { useState, useTransition } from "react";
import { updateCharityPreference } from "./actions";
import { Charity } from "@/lib/types";
import { Heart, Loader2, CheckCircle } from "lucide-react";

interface CharitySelectorProps {
  charities: Charity[];
  currentCharityId: string | null;
  currentPercentage: number;
}

export function CharitySelector({ charities, currentCharityId, currentPercentage }: CharitySelectorProps) {
  const [selected, setSelected] = useState<string>(currentCharityId ?? "");
  const [percentage, setPercentage] = useState(currentPercentage);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateCharityPreference(fd);
      if (res?.error) setError(res.error);
      else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle size={14} /> Charity preference updated!
        </div>
      )}

      {/* Charity grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {charities.map((charity) => (
          <label
            key={charity.id}
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              selected === charity.id
                ? "border-rose-500/50 bg-rose-500/10"
                : "border-[var(--border)] hover:border-rose-500/30 hover:bg-white/3"
            }`}
          >
            <input
              type="radio"
              name="charity_id"
              value={charity.id}
              checked={selected === charity.id}
              onChange={() => setSelected(charity.id)}
              className="sr-only"
            />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              selected === charity.id ? "bg-rose-500/20 border border-rose-500/40" : "bg-[var(--surface-2)] border border-[var(--border)]"
            }`}>
              <Heart size={18} className={selected === charity.id ? "text-rose-400" : "text-[var(--text-muted)]"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-tight ${selected === charity.id ? "text-white" : "text-[var(--text-secondary)]"}`}>
                {charity.name}
              </p>
              {charity.description && (
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{charity.description}</p>
              )}
            </div>
            {selected === charity.id && (
              <CheckCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
            )}
          </label>
        ))}
      </div>

      {/* Contribution slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="contribution_percentage" className="text-sm font-medium text-[var(--text-secondary)]">
            Contribution Percentage
          </label>
          <span className="text-lg font-bold gradient-text">{percentage}%</span>
        </div>
        <input
          id="contribution_percentage"
          name="contribution_percentage"
          type="range"
          min={10}
          max={50}
          step={5}
          value={percentage}
          onChange={(e) => setPercentage(Number(e.target.value))}
          className="w-full accent-rose-500"
          style={{ accentColor: "#f43f5e" }}
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
          <span>Min 10%</span>
          <span>Max 50%</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || !selected}
        className="btn w-full"
        style={{ background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "white", boxShadow: "0 4px 15px rgba(244,63,94,0.4)" }}
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Saving…</>
        ) : (
          <><Heart size={16} /> Save Charity Preference</>
        )}
      </button>
    </form>
  );
}
