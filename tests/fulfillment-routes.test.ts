import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const { requireVendor, requireCustomer, createClient } = vi.hoisted(() => ({
  requireVendor: vi.fn(),
  requireCustomer: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireVendor, requireCustomer }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import * as storeRoute from "@/app/api/vendor/store/route";
import * as productsRoute from "@/app/api/vendor/products/route";
import * as productRoute from "@/app/api/vendor/products/[productId]/route";
import * as orderDetailRoute from "@/app/api/vendor/orders/[orderId]/route";
import * as readyRoute from "@/app/api/vendor/orders/[orderId]/ready/route";
import * as completeRoute from "@/app/api/vendor/orders/[orderId]/complete/route";
import * as customerCancelRoute from "@/app/api/orders/[orderId]/cancel/route";

const PRODUCT_ID = "20000000-0000-4000-8000-000000000001";
const ORDER_ID = "60000000-0000-4000-8000-000000000001";
const VENDOR_ID = "70000000-0000-4000-8000-000000000001";

function request(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireVendor.mockResolvedValue({ user: { id: VENDOR_ID }, profile: {} });
  requireCustomer.mockResolvedValue({ user: { id: "customer-1" }, profile: {} });
});

describe("vendor authentication and safe store updates", () => {
  it("rejects unauthenticated vendor access", async () => {
    requireVendor.mockRejectedValueOnce(
      new ApiError("UNAUTHENTICATED", "Authentication required"),
    );
    const response = await storeRoute.GET();
    expect(response.status).toBe(401);
  });

  it("rejects verification and owner fields", async () => {
    const response = await storeRoute.PATCH(
      request(
        "http://localhost/api/vendor/store",
        { name: "Store", verified: true, ownerId: "attacker" },
        "PATCH",
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("vendor products", () => {
  it.each([
    { price: -1, stock: 1 },
    { price: 10, stock: -1 },
  ])("rejects invalid product values: %o", async ({ price, stock }) => {
    const response = await productsRoute.POST(
      request("http://localhost/api/vendor/products", {
        name: "Test Product",
        description: "",
        category: "Electronics",
        price,
        stock,
        active: true,
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
  });

  it("filters product detail by vendor ownership", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    createClient.mockResolvedValueOnce({ from: vi.fn().mockReturnValue(query) });
    const response = await productRoute.GET(new Request("http://localhost"), {
      params: Promise.resolve({ productId: PRODUCT_ID }),
    });
    expect(query.eq).toHaveBeenCalledWith("stores.owner_id", VENDOR_ID);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("order isolation and fulfilment", () => {
  it("returns not found for another store's order", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
      from: vi.fn().mockReturnValue(query),
    });
    const response = await orderDetailRoute.GET(new Request("http://localhost"), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("ORDER_NOT_FOUND");
  });

  it("maps customer cancellation ownership failure", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "ORDER_NOT_FOUND" },
      }),
    });
    const response = await customerCancelRoute.POST(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("ORDER_NOT_FOUND");
  });

  it("maps an incorrect pickup code", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "INVALID_PICKUP_CODE" },
      }),
    });
    const response = await completeRoute.POST(
      request("http://localhost", { pickupCode: "BAD123" }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_PICKUP_CODE");
  });

  it("returns successful ready and completion shapes", async () => {
    createClient
      .mockResolvedValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: "2026-07-17T12:00:00Z",
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: "2026-07-17T12:05:00Z",
          error: null,
        }),
      });
    const ready = await readyRoute.POST(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );
    const complete = await completeRoute.POST(
      request("http://localhost", { pickupCode: "ABC123" }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );
    expect(await ready.json()).toEqual({
      data: { orderId: ORDER_ID, readyAt: "2026-07-17T12:00:00Z" },
    });
    expect(await complete.json()).toEqual({
      data: { orderId: ORDER_ID, completedAt: "2026-07-17T12:05:00Z" },
    });
  });

  it.each([
    ["ORDER_ALREADY_COMPLETED", 409],
    ["ORDER_ALREADY_CANCELLED", 409],
    ["ORDER_EXPIRED", 409],
  ])("maps stable lifecycle error %s", async (code, status) => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: code } }),
    });
    const response = await customerCancelRoute.POST(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ orderId: ORDER_ID }) },
    );
    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(code);
  });
});
