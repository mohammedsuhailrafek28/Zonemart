import { flashDatabaseError } from "@/lib/api/flash";
import { errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { paginationSchema } from "@/lib/validation/flash";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireVendor();
    const url = new URL(request.url);
    const input = paginationSchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
    });
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_flash_marketplace");
    if (expiryError) throw flashDatabaseError(expiryError);

    const from = (input.page - 1) * input.limit;
    let query = supabase
      .from("flash_requests")
      .select(
        "id, item_name, description, category, quantity, zone, max_price, urgency_minutes, expires_at, created_at",
        { count: "exact" },
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .range(from, from + input.limit - 1);
    if (input.category) query = query.eq("category", input.category);

    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({
      data: {
        requests: data ?? [],
        page: input.page,
        limit: input.limit,
        total: count ?? 0,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
