import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const { requireCustomer, createClient } = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireCustomer }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import * as cartRoute from "@/app/api/cart/route";
import * as checkoutRoute from "@/app/api/checkout/route";
import * as ordersRoute from "@/app/api/orders/route";

const PRODUCT_ID = "20000000-0000-4000-8000-000000000001";
const USER_ID = "30000000-0000-4000-8000-000000000001";

function request(body: unknown) {
  return new Request("http://localhost/api/cart", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function selectQuery(data: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data, error: null });
  return query;
}

beforeEach(() => {
  requireCustomer.mockResolvedValue({ user: { id: USER_ID }, profile: {} });
});

describe("authentication", () => {
  it.each([
    ["cart", () => cartRoute.GET()],
    ["checkout", () => checkoutRoute.POST()],
  ])("rejects unauthenticated %s requests", async (_name, invoke) => {
    requireCustomer.mockRejectedValueOnce(
      new ApiError("UNAUTHENTICATED", "Authentication required"),
    );
    const response = await invoke();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  });
});

describe("cart", () => {
  it("rejects invalid quantities before database mutation", async () => {
    const response = await cartRoute.POST(request({ productId: PRODUCT_ID, quantity: 0 }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns a stable different-store conflict", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DIFFERENT_STORE" },
      }),
    });
    const response = await cartRoute.POST(request({ productId: PRODUCT_ID, quantity: 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "DIFFERENT_STORE",
        message: "Your cart already contains items from another store.",
      },
    });
  });

  it("returns item, store, line total and cart total", async () => {
    const query = selectQuery([
      {
        product_id: PRODUCT_ID,
        quantity: 2,
        product: {
          name: "65W USB-C GaN Charger",
          image_url: null,
          price: 2499,
          stock: 2,
          active: true,
          store: { id: "store-1", name: "Circuit Corner" },
        },
      },
    ]);
    createClient.mockResolvedValueOnce({ from: vi.fn().mockReturnValue(query) });

    const response = await cartRoute.GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      store: { id: "store-1", name: "Circuit Corner" },
      total: 4998,
      items: [
        {
          productId: PRODUCT_ID,
          quantity: 2,
          price: 2499,
          lineTotal: 4998,
        },
      ],
    });
  });
});

describe("checkout error mapping", () => {
  it("maps EMPTY_CART to HTTP 400", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "EMPTY_CART" } }),
    });
    const response = await checkoutRoute.POST();
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("EMPTY_CART");
  });

  it("maps product-bearing OUT_OF_STOCK to HTTP 409", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "OUT_OF_STOCK|65W USB-C GaN Charger" },
      }),
    });
    const response = await checkoutRoute.POST();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "OUT_OF_STOCK",
        message: "65W USB-C GaN Charger just sold out.",
      },
    });
  });
});

describe("orders", () => {
  it("filters order retrieval by the authenticated customer", async () => {
    const query = selectQuery([]);
    const from = vi.fn().mockReturnValue(query);
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
      from,
    });

    const response = await ordersRoute.GET();
    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(await response.json()).toEqual({ data: { orders: [] } });
  });
});
