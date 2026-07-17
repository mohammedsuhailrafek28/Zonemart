import { fulfillmentDatabaseError } from "@/lib/api/fulfillment";
import { errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vendorOrderFilterSchema } from "@/lib/validation/vendor";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireVendor();
    const url = new URL(request.url);
    const input = vendorOrderFilterSchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
    });
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_reservations");
    if (expiryError) throw fulfillmentDatabaseError(expiryError);
    const from = (input.page - 1) * input.limit;
    let query = supabase
      .from("orders")
      .select(
        "id, status, total, ready_at, completed_at, cancelled_at, cancelled_by, expires_at, created_at, flash_request_id, items:order_items(id, product_id, product_name, quantity, unit_price)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + input.limit - 1);
    if (input.status === "ready") {
      query = query.eq("status", "reserved").not("ready_at", "is", null);
    } else if (input.status === "reserved") {
      query = query.eq("status", "reserved").is("ready_at", null);
    } else if (input.status) {
      query = query.eq("status", input.status);
    }
    if (input.source === "flash") query = query.not("flash_request_id", "is", null);
    if (input.source === "listed") query = query.is("flash_request_id", null);
    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({
      data: {
        orders: data ?? [],
        page: input.page,
        limit: input.limit,
        total: count ?? 0,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
