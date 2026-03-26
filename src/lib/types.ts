// Database types aligned with Supabase schema

export type SubscriptionStatus = "active" | "inactive" | "past_due" | "canceled" | "incomplete";
export type PlanType = "monthly" | "yearly";
export type WinningStatus = "unverified" | "verified" | "paid";
export type PayoutType = "winning" | "charity_disbursement";
export type PayoutStatus = "pending" | "success" | "failed";
export type DrawStatus = "pending" | "completed";
export type MatchTier = 3 | 4 | 5;

export interface User {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  // subscription_status removed - use subscriptions table status for SSOT
  stripe_customer_id: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  plan_type: PlanType;
  status: string;
  current_period_end: string;
  created_at: string;
}

export interface Score {
  id: string;
  user_id: string;
  value: number;
  score_date: string;
  created_at: string;
}

export interface Charity {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserCharityPreference {
  user_id: string;
  charity_id: string;
  contribution_percentage: number;
  updated_at: string;
  charity?: Charity;
}

export interface Draw {
  id: string;
  draw_date: string;
  winning_numbers: number[];
  total_pool: number;
  rollover_amount: number;
  status: DrawStatus;
  created_at: string;
}

export interface DrawEntry {
  id: string;
  draw_id: string;
  user_id: string;
  submitted_scores: number[];
  match_count: number;
  created_at: string;
  draw?: Draw;
}

export interface Winning {
  id: string;
  draw_id: string;
  user_id: string;
  amount: number;
  match_tier: MatchTier;
  status: WinningStatus;
  proof_url: string | null;
  created_at: string;
  user?: Pick<User, "id" | "full_name" | "email">;
  draw?: Draw;
}

export interface Payout {
  id: string;
  user_id: string;
  amount: number;
  type: PayoutType;
  status: PayoutStatus;
  stripe_transfer_id: string | null;
  created_at: string;
}

// Dashboard summary types
export interface DashboardStats {
  subscriptionStatus: SubscriptionStatus;
  planType: PlanType | null;
  periodEnd: string | null;
  scores: Score[];
  currentDraw: Draw | null;
  recentWinnings: Winning[];
  charityPreference: UserCharityPreference | null;
  totalWon: number;
}

export interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  totalPool: number;
  charityContributions: number;
  pendingVerifications: number;
}
