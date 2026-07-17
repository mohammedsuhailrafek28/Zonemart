import { fulfillmentDatabaseError } from "@/lib/api/fulfillment";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  productIdSchema,
  vendorProductInputSchema,
} from "@/lib/validation/vendor";
import { NextResponse } from "next/server";

interface Context {
  params: Promise<{ productId: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireVendor();
    const { productId: rawProductId } = await context.params;
    const productId = productIdSchema.parse(rawProductId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, description, category, price, stock, image_url, active, archived_at, created_at, updated_at, store:stores!inner(id, owner_id)",
      )
      .eq("id", productId)
      .eq("stores.owner_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError("PRODUCT_NOT_FOUND", "Product not found.");
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireVendor();
    const { productId: rawProductId } = await context.params;
    const productId = productIdSchema.parse(rawProductId);
    const input = vendorProductInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("vendor_update_product", {
      p_product_id: productId,
      p_name: input.name,
      p_description: input.description,
      p_category: input.category,
      p_price: input.price,
      p_stock: input.stock,
      p_image_url: input.imageUrl ?? "",
      p_active: input.active,
    });
    if (error) throw fulfillmentDatabaseError(error);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireVendor();
    const { productId: rawProductId } = await context.params;
    const productId = productIdSchema.parse(rawProductId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("vendor_archive_product", {
      p_product_id: productId,
    });
    if (error) throw fulfillmentDatabaseError(error);
    return NextResponse.json({ data: { archived: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
