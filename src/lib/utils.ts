import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatDateRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(dateStr);
}

export function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

// Draw algorithm helpers
export function countMatches(submitted: number[], winning: number[]): number {
  const winningSet = new Set(winning);
  return submitted.filter((n) => winningSet.has(n)).length;
}

// Calculate prize pool splits
export function calculatePrizeSplits(pool: number) {
  return {
    fiveMatch: pool * 0.4, // 40% — rollover if no winner
    fourMatch: pool * 0.35, // 35%
    threeMatch: pool * 0.25, // 25%
  };
}

// Generate random draw numbers (1–45, 5 unique)
export function generateRandomDraw(): number[] {
  const numbers = new Set<number>();
  while (numbers.size < 5) {
    numbers.add(Math.floor(Math.random() * 45) + 1);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

// Score-frequency based draw (weighted random from frequency map)
export function generateFrequencyDraw(scores: number[][]): number[] {
  const freq: Record<number, number> = {};
  scores.flat().forEach((value) => {
    freq[value] = (freq[value] ?? 0) + 1;
  });
  const pool: number[] = [];
  for (const [num, count] of Object.entries(freq)) {
    for (let i = 0; i < count; i++) pool.push(Number(num));
  }
  // Weighted random selection
  const selected = new Set<number>();
  const shuffled = pool.sort(() => Math.random() - 0.5);
  for (const n of shuffled) {
    if (selected.size >= 5) break;
    selected.add(n);
  }
  // Pad with random if needed
  while (selected.size < 5) {
    const r = Math.floor(Math.random() * 45) + 1;
    selected.add(r);
  }
  return Array.from(selected).sort((a, b) => a - b);
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
