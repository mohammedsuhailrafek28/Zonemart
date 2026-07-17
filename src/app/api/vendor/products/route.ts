import { fulfillmentDatabaseError } from "@/lib/api/fulfillment";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vendorProductInputSchema } from "@/lib/validation/vendor";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user } = await requireVendor();
    const supabase = await createClient();
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (storeError) throw storeError;
    if (!store) throw new ApiError("STORE_NOT_FOUND", "Vendor store not found.");
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, description, category, price, stock, image_url, active, archived_at, created_at, updated_at",
      )
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: { products: data ?? [] } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireVendor();
    const input = vendorProductInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("vendor_create_product", {
      p_name: input.name,
      p_description: input.description,
      p_category: input.category,
      p_price: input.price,
      p_stock: input.stock,
      p_image_url: input.imageUrl ?? "",
      p_active: input.active,
    });
    if (error) throw fulfillmentDatabaseError(error);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
