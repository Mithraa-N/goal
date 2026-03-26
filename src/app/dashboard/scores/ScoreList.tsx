"use client";

import { useTransition, useState } from "react";
import { deleteScore } from "./actions";
import { Score } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Trash2, Calendar, Loader2 } from "lucide-react";

interface ScoreListProps {
  scores: Score[];
}

export function ScoreList({ scores }: ScoreListProps) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (scores.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)] text-sm">
        No scores yet. Submit your first score above to get started.
      </div>
    );
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this score?")) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteScore(id);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-2">
      {scores.map((score, index) => (
        <div
          key={score.id}
          className="flex items-center justify-between px-4 py-3.5 glass-light rounded-xl border border-[var(--border)] group hover:border-blue-500/30 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              {/* Slot number */}
              <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[9px] text-[var(--text-muted)] font-bold">
                {index + 1}
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-lg">
                {score.value}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Score: <span className="gradient-text">{score.value}</span></p>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5">
                <Calendar size={10} />
                <span>Played: {formatDate(score.score_date)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] hidden sm:block">
              Added {formatDate(score.created_at)}
            </span>
            <button
              onClick={() => handleDelete(score.id)}
              disabled={isPending && deletingId === score.id}
              className="btn btn-icon btn-ghost text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete score"
            >
              {isPending && deletingId === score.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
