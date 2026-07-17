import { flashDatabaseError } from "@/lib/api/flash";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestIdSchema } from "@/lib/validation/flash";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ requestId: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireCustomer();
    const { requestId: rawRequestId } = await context.params;
    const requestId = requestIdSchema.parse(rawRequestId);
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_flash_marketplace");
    if (expiryError) throw flashDatabaseError(expiryError);

    const { data, error } = await supabase
      .from("flash_requests")
      .select(
        "id, item_name, description, category, quantity, zone, max_price, urgency_minutes, status, expires_at, created_at, offers:flash_offers(id, product_name, price, quantity, note, ready_minutes, status, expires_at, created_at, store:stores!inner(id, name, zone))",
      )
      .eq("id", requestId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError("REQUEST_NOT_FOUND", "Flash Request not found.");
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireCustomer();
    const { requestId: rawRequestId } = await context.params;
    const requestId = requestIdSchema.parse(rawRequestId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_flash_request", {
      p_request_id: requestId,
    });
    if (error) throw flashDatabaseError(error);
    return NextResponse.json({ data: { cancelled: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
