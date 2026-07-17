import { fulfillmentDatabaseError } from "@/lib/api/fulfillment";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orderIdSchema } from "@/lib/validation/vendor";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ orderId: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    await requireVendor();
    const { orderId: rawOrderId } = await context.params;
    const orderId = orderIdSchema.parse(rawOrderId);
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_reservations");
    if (expiryError) throw fulfillmentDatabaseError(expiryError);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, total, ready_at, completed_at, cancelled_at, cancelled_by, expires_at, created_at, flash_request_id, store:stores!inner(id, name), items:order_items(id, product_id, product_name, quantity, unit_price)",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError("ORDER_NOT_FOUND", "Order not found.");
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
