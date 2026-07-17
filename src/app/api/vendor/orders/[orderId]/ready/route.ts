import { fulfillmentDatabaseError } from "@/lib/api/fulfillment";
import { errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orderIdSchema } from "@/lib/validation/vendor";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ orderId: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    await requireVendor();
    const { orderId: rawOrderId } = await context.params;
    const orderId = orderIdSchema.parse(rawOrderId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("vendor_mark_order_ready", {
      p_order_id: orderId,
    });
    if (error) throw fulfillmentDatabaseError(error);
    return NextResponse.json({ data: { orderId, readyAt: data } });
  } catch (error) {
    return errorResponse(error);
  }
}
