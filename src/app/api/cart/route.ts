import { errorResponse } from "@/lib/api/errors";
import { commerceDatabaseError } from "@/lib/api/commerce";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cartItemSchema } from "@/lib/validation/commerce";
import { NextResponse } from "next/server";

interface CartRow {
  product_id: string;
  quantity: number;
  product: {
    name: string;
    image_url: string | null;
    price: number | string;
    stock: number;
    active: boolean;
    store: { id: string; name: string };
  };
}

export async function GET() {
  try {
    const { user } = await requireCustomer();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cart_items")
      .select(
        "product_id, quantity, product:products!inner(name, image_url, price, stock, active, store:stores!inner(id, name))",
      )
      .eq("user_id", user.id)
      .order("created_at");

    if (error) throw error;
    const rows = (data ?? []) as unknown as CartRow[];
    const items = rows.map((row) => ({
      productId: row.product_id,
      name: row.product.name,
      imageUrl: row.product.image_url,
      price: Number(row.product.price),
      quantity: row.quantity,
      stock: row.product.stock,
      active: row.product.active,
      lineTotal: Number(row.product.price) * row.quantity,
      store: row.product.store,
    }));

    return NextResponse.json({
      data: {
        items,
        store: items[0]?.store ?? null,
        total: items.reduce((sum, item) => sum + item.lineTotal, 0),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireCustomer();
    const input = cartItemSchema.parse(await request.json());
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_cart_item", {
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_replace_cart: input.replaceCart,
    });
    if (error) throw commerceDatabaseError(error);
    return NextResponse.json({ data: { productId: input.productId, quantity: input.quantity } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    await requireCustomer();
    const supabase = await createClient();
    const { error } = await supabase.rpc("clear_cart");
    if (error) throw commerceDatabaseError(error);
    return NextResponse.json({ data: { cleared: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
