import { Score } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Target, Calendar } from "lucide-react";

interface ScoreBallsProps {
  scores: number[];
  winningNumbers?: number[];
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export function ScoreBalls({ scores, winningNumbers, size = "md" }: ScoreBallsProps) {
  const winningSet = winningNumbers ? new Set(winningNumbers) : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {scores.map((score, i) => {
        const isMatch = winningSet?.has(score);
        return (
          <div
            key={i}
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold transition-all ${
              isMatch
                ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg glow-gold"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]"
            }`}
          >
            {score}
          </div>
        );
      })}
    </div>
  );
}

interface ScoreCardProps {
  score: Score;
  winningNumbers?: number[];
  matchCount?: number;
}

export function ScoreCard({ score, winningNumbers, matchCount }: ScoreCardProps) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
          <Calendar size={12} />
          {formatDate(score.score_date)}
        </div>
        {matchCount !== undefined && matchCount > 0 && (
          <span className={`badge ${ matchCount >= 5 ? "badge-warning" : matchCount >= 4 ? "badge-success" : "badge-primary" }`}>
            {matchCount} match{matchCount !== 1 ? "es" : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Target size={14} className="text-[var(--text-muted)]" />
        <div className="flex items-center gap-1.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
            {score.value}
          </div>
        </div>
      </div>
    </div>
  );
}
