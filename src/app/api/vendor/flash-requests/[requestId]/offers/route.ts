import { flashDatabaseError } from "@/lib/api/flash";
import { errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { flashOfferInputSchema, requestIdSchema } from "@/lib/validation/flash";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ requestId: string }>;
}

export async function POST(request: Request, context: Context) {
  try {
    await requireVendor();
    const { requestId: rawRequestId } = await context.params;
    const requestId = requestIdSchema.parse(rawRequestId);
    const input = flashOfferInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("upsert_flash_offer", {
      p_request_id: requestId,
      p_product_name: input.productName,
      p_quantity: input.quantityAvailable,
      p_unit_price: input.unitPrice,
      p_note: input.note ?? "",
      p_ready_minutes: input.readyMinutes,
      p_expiration_minutes: input.expirationMinutes,
    });
    if (error) throw flashDatabaseError(error);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
