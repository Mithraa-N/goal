"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function updateCharityPreference(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const charity_id = formData.get("charity_id") as string;
  const contribution_percentage = parseInt(formData.get("contribution_percentage") as string, 10);

  if (!charity_id) return { error: "Please select a charity." };
  if (isNaN(contribution_percentage) || contribution_percentage < 10) {
    return { error: "Minimum contribution is 10%." };
  }

  const { error } = await supabase
    .from("user_charity_preferences")
    .upsert({
      user_id: user.id,
      charity_id,
      contribution_percentage,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/charity");
  revalidatePath("/dashboard");
  return { success: true };
}
