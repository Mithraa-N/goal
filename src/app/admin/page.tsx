import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Shield, Users, Trophy, Heart, AlertCircle, TrendingUp } from "lucide-react";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Admin guard
  const { data: profile } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  // Parallel admin stats
  const [usersRes, activeSubsRes, pendingVerRes, drawsRes, winningsRes] = await Promise.all([
    supabase.from("users").select("id, full_name, email, subscriptions(status), created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("subscriptions").select("id", { count: "exact" }).eq("status", "active"),
    supabase.from("winnings").select("id, amount, match_tier, status, user_id, created_at, user:users(full_name, email)").eq("status", "unverified").order("created_at", { ascending: false }),
    supabase.from("draws").select("*").order("draw_date", { ascending: false }).limit(5),
    supabase.from("winnings").select("amount").eq("status", "paid"),
  ]);

  const users = usersRes.data ?? [];
  const activeCount = activeSubsRes.count ?? 0;
  const totalUsers = users.length;
  const pendingVerifications = pendingVerRes.data ?? [];
  const recentDraws = drawsRes.data ?? [];
  const totalPaid = (winningsRes.data ?? []).reduce((s: number, w: { amount: number }) => s + w.amount, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="text-purple-400" size={24} />
            Admin Panel
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Platform management and analytics</p>
        </div>
        <Link href="/admin/draw" className="btn btn-primary btn-sm">
          Run Draw Simulation
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: totalUsers, icon: Users, color: "text-blue-400", sub: "All registered" },
          { label: "Active Subscribers", value: activeCount, icon: TrendingUp, color: "text-green-400", sub: "Paying members" },
          { label: "Pending Verifications", value: pendingVerifications.length, icon: AlertCircle, color: "text-yellow-400", sub: "Awaiting review" },
          { label: "Total Paid Out", value: formatCurrency(totalPaid), icon: Trophy, color: "text-yellow-400", sub: "Across all draws" },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--text-muted)]">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending verifications */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <AlertCircle size={16} className="text-yellow-400" />
              Pending Verifications
            </h2>
            <Link href="/admin/verifications" className="text-xs text-blue-400 hover:text-blue-300">
              View all →
            </Link>
          </div>
          {pendingVerifications.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">All clear! No pending verifications.</p>
          ) : (
            <div className="space-y-3">
              {pendingVerifications.slice(0, 5).map((w: any) => (
                <div key={w.id} className="flex items-center justify-between px-4 py-3 glass-light rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-white">{Array.isArray(w.user) ? w.user[0]?.full_name : w.user?.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatCurrency(w.amount)} · {w.match_tier}-match</p>
                  </div>
                  <Link href={`/admin/verifications/${w.id}`} className="btn btn-sm btn-secondary">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent draws */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Trophy size={16} className="text-yellow-400" />
              Recent Draws
            </h2>
            <Link href="/admin/draw" className="text-xs text-blue-400 hover:text-blue-300">
              Manage →
            </Link>
          </div>
          {recentDraws.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">No draws yet.</p>
          ) : (
            <div className="space-y-3">
              {recentDraws.map((draw: { id: string; draw_date: string; status: string; total_pool: number; winning_numbers: number[] }) => (
                <div key={draw.id} className="flex items-center justify-between px-4 py-3 glass-light rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatDate(draw.draw_date)}</p>
                    <p className="text-xs text-[var(--text-muted)]">Pool: {formatCurrency(draw.total_pool)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {draw.winning_numbers?.slice(0, 5).map((n: number, i: number) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 text-[10px] font-bold">
                          {n}
                        </div>
                      ))}
                    </div>
                    <span className={`badge text-xs ${draw.status === "completed" ? "badge-success" : "badge-warning"}`}>
                      {draw.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User table */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Users size={16} className="text-blue-400" />
            Recent Users
          </h2>
          <Link href="/admin/users" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 10).map((u: any) => {
                const subStatus = Array.isArray(u.subscriptions) ? u.subscriptions[0]?.status : u.subscriptions?.status;
                const finalStatus = subStatus ?? "inactive";
                return (
                <tr key={u.id}>
                  <td className="font-medium text-white">{u.full_name ?? "—"}</td>
                  <td className="text-[var(--text-secondary)]">{u.email}</td>
                  <td>
                    <span className={`badge text-xs ${
                      finalStatus === "active" ? "badge-success" :
                      finalStatus === "past_due" ? "badge-warning" : "badge-accent"
                    }`}>
                      {finalStatus}
                    </span>
                  </td>
                  <td className="text-[var(--text-muted)] text-xs">{formatDate(u.created_at)}</td>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                      View
                    </Link>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
