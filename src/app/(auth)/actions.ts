"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const ip = "unknown-ip"; // In a real edge environment, get IP from headers e.g., headers().get('x-forwarded-for')
  // Basic rate limiting: 5 attempts per minute per pseudo-IP
  if (!(await checkRateLimit(`login_${ip}`, 5, 60 * 1000))) {
    return { error: "Too many login attempts. Please wait a minute." };
  }

  const supabase = await createClient();
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const ip = "unknown-ip";
  if (!(await checkRateLimit(`signup_${ip}`, 5, 60 * 1000))) {
    return { error: "Too many signup attempts. Please wait a minute." };
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
  if (error) return { error: error.message };

  // Wait for session and manually upsert user data just in case trigger takes time, but Supabase handles Auth users 
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
