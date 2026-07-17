import { commerceDatabaseError } from "@/lib/api/commerce";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productIdSchema } from "@/lib/validation/commerce";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    await requireCustomer();
    const productId = productIdSchema.parse((await context.params).productId);
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_reservations");
    if (expiryError) throw commerceDatabaseError(expiryError);
    const { data, error } = await supabase.from("products")
      .select("id, name, description, category, price, stock, image_url, store:stores!inner(id, name, zone)")
      .eq("id", productId).eq("active", true).maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError("PRODUCT_NOT_FOUND", "Product not found.");
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
