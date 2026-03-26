"use client";

import { useState, useTransition } from "react";
import { addScore } from "./actions";
import { PlusCircle, Loader2, Lock } from "lucide-react";
import Link from "next/link";

interface ScoreEntryFormProps {
  isActive: boolean;
  currentCount: number;
}

export function ScoreEntryForm({ isActive, currentCount }: ScoreEntryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isActive) {
    return (
      <div className="text-center py-8">
        <Lock size={28} className="text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          An active subscription is required to submit scores.
        </p>
        <Link href="/pricing" className="btn btn-primary btn-sm">
          Subscribe Now
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const res = await addScore(data);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        form.reset();
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-sm">
          ✓ Score submitted! Your rolling 5 scores have been updated.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="value" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Score (1–45)
          </label>
          <input
            id="value"
            name="value"
            type="number"
            min={1}
            max={45}
            required
            placeholder="e.g. 18"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="score_date" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Date Played
          </label>
          <input
            id="score_date"
            name="score_date"
            type="date"
            required
            defaultValue={new Date().toISOString().split("T")[0]}
            className="input"
          />
        </div>
      </div>

      {currentCount >= 5 && (
        <p className="text-xs text-yellow-400 flex items-center gap-1.5">
          ⚠ You have 5 scores. Submitting will remove your oldest score automatically.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary w-full"
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Submitting…</>
        ) : (
          <><PlusCircle size={16} /> Add Score</>
        )}
      </button>
    </form>
  );
}
