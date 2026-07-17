import {
  commerceDatabaseError,
  orderResponse,
  type CommerceRpcResult,
} from "@/lib/api/commerce";
import { errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productIdSchema, quantityInputSchema } from "@/lib/validation/commerce";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ productId: string }>;
}

export async function POST(request: Request, context: Context) {
  try {
    await requireCustomer();
    const { productId: rawProductId } = await context.params;
    const productId = productIdSchema.parse(rawProductId);
    const input = quantityInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reserve_product", {
      p_product_id: productId,
      p_quantity: input.quantity,
    });
    if (error) throw commerceDatabaseError(error);
    const row = (data as CommerceRpcResult[] | null)?.[0];
    if (!row) throw commerceDatabaseError({});
    return NextResponse.json({ data: orderResponse(row) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
