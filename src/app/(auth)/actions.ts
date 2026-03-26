"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const ip = "unknown-ip"; 
  if (!(await checkRateLimit(`login_${ip}`, 5, 60 * 1000))) {
    redirect("/login?error=" + encodeURIComponent("Too many login attempts. Please wait a minute."));
  }

  const supabase = await createClient();
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const ip = "unknown-ip";
  if (!(await checkRateLimit(`signup_${ip}`, 5, 60 * 1000))) {
    redirect("/signup?error=" + encodeURIComponent("Too many signup attempts. Please wait a minute."));
  }

  const supabase = await createClient();
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        full_name: formData.get("full_name") as string,
      },
    },
  };

  const { error } = await supabase.auth.signUp(data);
  if (error) redirect("/signup?error=" + encodeURIComponent(error.message));

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
