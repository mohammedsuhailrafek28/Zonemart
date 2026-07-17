import { fulfillmentDatabaseError } from "@/lib/api/fulfillment";
import { errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orderIdSchema, pickupCodeSchema } from "@/lib/validation/vendor";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ orderId: string }>;
}

export async function POST(request: Request, context: Context) {
  try {
    await requireVendor();
    const { orderId: rawOrderId } = await context.params;
    const orderId = orderIdSchema.parse(rawOrderId);
    const input = pickupCodeSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("vendor_complete_order", {
      p_order_id: orderId,
      p_pickup_code: input.pickupCode,
    });
    if (error) throw fulfillmentDatabaseError(error);
    return NextResponse.json({ data: { orderId, completedAt: data } });
  } catch (error) {
    return errorResponse(error);
  }
}
