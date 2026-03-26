"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const scoreSchema = z.object({
  value: z.number().int().min(1).max(45),
  score_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addScore(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RATE LIMITING: max 10 requests per minute per user
  if (!(await checkRateLimit(`add_score_${user.id}`, 10, 60 * 1000))) {
    return { error: "Rate limit exceeded. Please wait a moment before trying again." };
  }

  // Check subscription and enforce database constraints strictly server-side
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .single();

  if (sub?.status !== "active") {
    return { error: "Active subscription required to submit scores." };
  }

  const parsed = scoreSchema.safeParse({
    value: parseInt(formData.get("value") as string, 10),
    score_date: formData.get("score_date") as string,
  });

  if (!parsed.success) {
    return { error: "Invalid score or date format. Enter a number between 1 and 45." };
  }

  // Postgres triggering the 5-score logic, but we still ensure the row matches the DB schema constraints explicitly 
  const { error } = await supabase.from("scores").insert({
    user_id: user.id,
    value: parsed.data.value,
    score_date: parsed.data.score_date,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/scores");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteScore(scoreId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RATE LIMITING: max 20 requests per minute
  if (!(await checkRateLimit(`del_score_${user.id}`, 20, 60 * 1000))) {
    return { error: "Rate limit exceeded." };
  }

  const { error } = await supabase
    .from("scores")
    .delete()
    .eq("id", scoreId)
    .eq("user_id", user.id); // Ensures DB explicitly enforces deletion only for owning user

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/scores");
  revalidatePath("/dashboard");
  return { success: true };
}
