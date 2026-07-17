import { commerceDatabaseError } from "@/lib/api/commerce";
import { errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user } = await requireCustomer();
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_reservations");
    if (expiryError) throw commerceDatabaseError(expiryError);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, total, pickup_code, created_at, expires_at, store:stores!inner(id, name), items:order_items(id, product_id, product_name, quantity, unit_price)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ data: { orders: data ?? [] } });
  } catch (error) {
    return errorResponse(error);
  }
}
