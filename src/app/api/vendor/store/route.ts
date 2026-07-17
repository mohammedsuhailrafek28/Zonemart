import { fulfillmentDatabaseError } from "@/lib/api/fulfillment";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vendorStoreInputSchema } from "@/lib/validation/vendor";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user } = await requireVendor();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stores")
      .select(
        "id, name, description, address, contact_display, operating_hours, zone, category_tags, active, verified, created_at",
      )
      .eq("owner_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError("STORE_NOT_FOUND", "Vendor store not found.");
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireVendor();
    const input = vendorStoreInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("vendor_update_store", {
      p_name: input.name,
      p_description: input.description ?? "",
      p_address: input.address ?? "",
      p_contact_display: input.contactDisplay ?? "",
      p_operating_hours: input.operatingHours ?? "",
    });
    if (error) throw fulfillmentDatabaseError(error);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
