import { commerceDatabaseError } from "@/lib/api/commerce";
import { errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireCustomer();
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_reservations");
    if (expiryError) throw commerceDatabaseError(expiryError);

    const url = new URL(request.url);
    const search = url.searchParams.get("q")?.trim();
    const category = url.searchParams.get("category")?.trim();
    const zone = url.searchParams.get("zone")?.trim();

    let query = supabase
      .from("products")
      .select(
        "id, name, description, category, price, stock, image_url, store:stores!inner(id, name, zone)",
      )
      .eq("active", true)
      .order("name");
    if (search) query = query.ilike("name", `%${search}%`);
    if (category) query = query.eq("category", category);
    if (zone) query = query.eq("stores.zone", zone);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: { products: data ?? [] } });
  } catch (error) {
    return errorResponse(error);
  }
}
