import { flashDatabaseError } from "@/lib/api/flash";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { flashOfferInputSchema, offerIdSchema } from "@/lib/validation/flash";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ offerId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireVendor();
    const { offerId: rawOfferId } = await context.params;
    const offerId = offerIdSchema.parse(rawOfferId);
    const input = flashOfferInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: existing, error: lookupError } = await supabase
      .from("flash_offers")
      .select("request_id")
      .eq("id", offerId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new ApiError("OFFER_NOT_FOUND", "Offer not found.");

    const { data, error } = await supabase.rpc("upsert_flash_offer", {
      p_request_id: existing.request_id,
      p_product_name: input.productName,
      p_quantity: input.quantityAvailable,
      p_unit_price: input.unitPrice,
      p_note: input.note ?? "",
      p_ready_minutes: input.readyMinutes,
      p_expiration_minutes: input.expirationMinutes,
    });
    if (error) throw flashDatabaseError(error);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireVendor();
    const { offerId: rawOfferId } = await context.params;
    const offerId = offerIdSchema.parse(rawOfferId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("withdraw_flash_offer", {
      p_offer_id: offerId,
    });
    if (error) throw flashDatabaseError(error);
    return NextResponse.json({ data: { withdrawn: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
