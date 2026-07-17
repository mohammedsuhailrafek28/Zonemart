import { errorResponse } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { profileInputSchema } from "@/lib/validation/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = profileInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: input.fullName,
          role: input.role,
          zone: input.zone,
        },
        { onConflict: "id" },
      )
      .select("id, full_name, role, zone, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
