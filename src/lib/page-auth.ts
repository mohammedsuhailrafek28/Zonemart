import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requirePageRole(role: "customer" | "vendor", next: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, zone")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== role) redirect("/unauthorized");
  return { user, profile };
}

export async function getPageProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, zone")
    .eq("id", user.id)
    .maybeSingle();
  return profile;
}
