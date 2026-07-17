import "server-only";

import type { User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type { ZoneMartRole } from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/server";

export interface AuthProfile {
  id: string;
  full_name: string;
  role: ZoneMartRole;
  zone: string;
  created_at: string;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError("UNAUTHENTICATED", "Authentication required");
  }
  return user;
}

export async function requireRole(
  expectedRole: ZoneMartRole,
): Promise<{ user: User; profile: AuthProfile }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, zone, created_at")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    throw new ApiError("FORBIDDEN", "A completed ZoneMart profile is required");
  }
  const profile = data as AuthProfile;
  if (profile.role !== expectedRole) {
    throw new ApiError("FORBIDDEN", `${expectedRole} role required`);
  }
  return { user, profile };
}

export const requireCustomer = () => requireRole("customer");
export const requireVendor = () => requireRole("vendor");

/**
 * Use before every service-role mutation. Authentication alone is insufficient:
 * the route must also compare the target row's user_id/owner_id with this user.
 */
export async function authenticateAdminMutation() {
  return requireUser();
}
