"use client";

import { useState, useTransition } from "react";
import { Zap, Play, Loader2, CheckCircle, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SimResult {
  winningNumbers: number[];
  mode: string;
  totalPool: number;
  splits: { fiveMatch: number; fourMatch: number; threeMatch: number };
  winners: { fiveMatch: number; fourMatch: number; threeMatch: number };
  rolloverAmount: number;
  winningsCreated?: number;
}

export function DrawEngine() {
  const [mode, setMode] = useState<"random" | "frequency">("random");
  const [simulate, setSimulate] = useState(true);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runDraw() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/draw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "",
        },
        body: JSON.stringify({ mode, simulate }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Unknown error");
      else setResult(data);
    });
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Draw Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {(["random", "frequency"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  mode === m
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-blue-500/30"
                }`}
              >
                {m === "random" ? "🎲 Random" : "📊 Frequency"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Execution Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {([true, false] as const).map((sim) => (
              <button
                key={String(sim)}
                onClick={() => setSimulate(sim)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  simulate === sim
                    ? sim ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" : "bg-red-500/20 border-red-500/40 text-red-300"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-blue-500/30"
                }`}
              >
                {sim ? "🔬 Simulate" : "🚀 Execute"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!simulate && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          ⚠️ <strong>Execute mode</strong> will permanently run the draw and write results to the database.
        </div>
      )}

      <button
        onClick={runDraw}
        disabled={isPending}
        className={`btn w-full ${simulate ? "btn-secondary" : "btn-danger"}`}
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Running…</>
        ) : simulate ? (
          <><Play size={16} /> Simulate Draw</>
        ) : (
          <><Zap size={16} /> Execute Draw NOW</>
        )}
      </button>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/25">
            <div className="flex items-center gap-2 text-green-400 font-semibold mb-3">
              <CheckCircle size={16} />
              {result.winningsCreated !== undefined ? "Draw Executed Successfully" : "Simulation Complete"}
            </div>

            {/* Winning numbers */}
            <div className="mb-4">
              <p className="text-xs text-[var(--text-muted)] mb-2">Winning Numbers</p>
              <div className="flex gap-2">
                {result.winningNumbers.map((n, i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold text-sm flex items-center justify-center">
                    {n}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "5-Match Winners", value: result.winners.fiveMatch, prize: result.splits.fiveMatch },
                { label: "4-Match Winners", value: result.winners.fourMatch, prize: result.splits.fourMatch },
                { label: "3-Match Winners", value: result.winners.threeMatch, prize: result.splits.threeMatch },
              ].map(({ label, value, prize }) => (
                <div key={label} className="glass-light rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  <p className="text-xs text-green-400 mt-1">{formatCurrency(prize)}</p>
                </div>
              ))}
            </div>

            {result.rolloverAmount > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                🏆 Jackpot rolls over: <strong>{formatCurrency(result.rolloverAmount)}</strong> added to next draw
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
