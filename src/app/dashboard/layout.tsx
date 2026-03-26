import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/ui/Toaster";
import { User } from "@/lib/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  console.log('--- DASHBOARD LAYOUT AUTH DEBUG ---');
  console.log('User ID:', authUser?.id);
  console.log('Error:', authError?.message);

  if (!authUser) {
    console.log('Redirecting to /login from dashboard layout');
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={profile as User} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
