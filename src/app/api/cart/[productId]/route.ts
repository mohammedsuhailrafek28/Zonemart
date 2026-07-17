import { commerceDatabaseError } from "@/lib/api/commerce";
import { errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productIdSchema, quantityInputSchema } from "@/lib/validation/commerce";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ productId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireCustomer();
    const { productId: rawProductId } = await context.params;
    const productId = productIdSchema.parse(rawProductId);
    const input = quantityInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_cart_item", {
      p_product_id: productId,
      p_quantity: input.quantity,
      p_replace_cart: false,
    });
    if (error) throw commerceDatabaseError(error);
    return NextResponse.json({ data: { productId, quantity: input.quantity } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireCustomer();
    const { productId: rawProductId } = await context.params;
    const productId = productIdSchema.parse(rawProductId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_cart_item", {
      p_product_id: productId,
    });
    if (error) throw commerceDatabaseError(error);
    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
