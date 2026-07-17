import {
  commerceDatabaseError,
  orderResponse,
  type CommerceRpcResult,
} from "@/lib/api/commerce";
import { errorResponse } from "@/lib/api/errors";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await requireCustomer();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("checkout_cart");
    if (error) throw commerceDatabaseError(error);
    const row = (data as CommerceRpcResult[] | null)?.[0];
    if (!row) throw commerceDatabaseError({});
    return NextResponse.json({ data: orderResponse(row) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
