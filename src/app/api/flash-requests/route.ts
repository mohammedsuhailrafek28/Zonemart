import { flashDatabaseError } from "@/lib/api/flash";
import { errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { flashRequestInputSchema } from "@/lib/validation/flash";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    await requireCustomer();
    const input = flashRequestInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_flash_request", {
      p_item_name: input.itemName,
      p_description: input.description ?? "",
      p_category: input.category,
      p_quantity: input.quantity,
      // Generated RPC arguments do not express nullable PostgreSQL parameters.
      p_max_price: input.maxPrice ?? (null as never),
      p_urgency_minutes: input.urgencyMinutes,
    });
    if (error) throw flashDatabaseError(error);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const { user } = await requireCustomer();
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_flash_marketplace");
    if (expiryError) throw flashDatabaseError(expiryError);

    const { data, error } = await supabase
      .from("flash_requests")
      .select(
        "id, item_name, description, category, quantity, zone, max_price, urgency_minutes, status, expires_at, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: { requests: data ?? [] } });
  } catch (error) {
    return errorResponse(error);
  }
}
