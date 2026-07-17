import {
  orderResponse,
  type CommerceRpcResult,
} from "@/lib/api/commerce";
import { flashDatabaseError } from "@/lib/api/flash";
import { errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { offerIdSchema, requestIdSchema } from "@/lib/validation/flash";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ requestId: string; offerId: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    await requireCustomer();
    const params = await context.params;
    const requestId = requestIdSchema.parse(params.requestId);
    const offerId = offerIdSchema.parse(params.offerId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("accept_flash_offer", {
      p_request_id: requestId,
      p_offer_id: offerId,
    });
    if (error) throw flashDatabaseError(error);
    const row = (data as CommerceRpcResult[] | null)?.[0];
    if (!row) throw flashDatabaseError({});
    return NextResponse.json({ data: orderResponse(row) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
