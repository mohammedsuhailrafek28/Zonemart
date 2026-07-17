import { flashDatabaseError } from "@/lib/api/flash";
import { errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireVendor();
    const supabase = await createClient();
    const { error: expiryError } = await supabase.rpc("expire_flash_marketplace");
    if (expiryError) throw flashDatabaseError(expiryError);
    const { data, error } = await supabase
      .from("flash_offers")
      .select(
        "id, product_name, price, quantity, note, ready_minutes, status, expires_at, created_at, store:stores!inner(id, name), request:flash_requests!inner(id, item_name, category, quantity, zone, status, expires_at)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: { offers: data ?? [] } });
  } catch (error) {
    return errorResponse(error);
  }
}
