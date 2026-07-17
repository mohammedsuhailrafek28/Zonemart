import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const { requireCustomer, requireVendor, createClient } = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  requireVendor: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireCustomer, requireVendor }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import * as requestsRoute from "@/app/api/flash-requests/route";
import * as requestDetailRoute from "@/app/api/flash-requests/[requestId]/route";
import * as vendorOfferRoute from "@/app/api/vendor/flash-requests/[requestId]/offers/route";
import * as acceptRoute from "@/app/api/flash-requests/[requestId]/offers/[offerId]/accept/route";

const USER_ID = "30000000-0000-4000-8000-000000000001";
const REQUEST_ID = "40000000-0000-4000-8000-000000000001";
const OFFER_ID = "50000000-0000-4000-8000-000000000001";

const context = {
  params: Promise.resolve({ requestId: REQUEST_ID, offerId: OFFER_ID }),
};

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireCustomer.mockResolvedValue({ user: { id: USER_ID }, profile: {} });
  requireVendor.mockResolvedValue({ user: { id: "vendor-1" }, profile: {} });
});

describe("Flash Request route security", () => {
  it("rejects unauthenticated request creation", async () => {
    requireCustomer.mockRejectedValueOnce(
      new ApiError("UNAUTHENTICATED", "Authentication required"),
    );
    const response = await requestsRoute.POST(
      jsonRequest("http://localhost/api/flash-requests", {
        itemName: "HDMI to VGA Adapter",
        category: "Electronics",
        quantity: 1,
        urgencyMinutes: 30,
      }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("filters detail retrieval by authenticated ownership", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue(query),
    });
    const response = await requestDetailRoute.GET(
      new Request(`http://localhost/api/flash-requests/${REQUEST_ID}`),
      { params: Promise.resolve({ requestId: REQUEST_ID }) },
    );
    expect(query.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("REQUEST_NOT_FOUND");
  });
});

describe("Flash input validation and eligibility", () => {
  it("rejects invalid request quantity", async () => {
    const response = await requestsRoute.POST(
      jsonRequest("http://localhost/api/flash-requests", {
        itemName: "HDMI to VGA Adapter",
        category: "Electronics",
        quantity: 0,
        urgencyMinutes: 30,
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects invalid offer data", async () => {
    const response = await vendorOfferRoute.POST(
      jsonRequest("http://localhost/api/vendor/flash-requests/x/offers", {
        productName: "Adapter",
        quantityAvailable: 1,
        unitPrice: -1,
        readyMinutes: 10,
      }),
      { params: Promise.resolve({ requestId: REQUEST_ID }) },
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
  });

  it("maps vendor ineligibility to HTTP 403", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "VENDOR_NOT_ELIGIBLE" },
      }),
    });
    const response = await vendorOfferRoute.POST(
      jsonRequest("http://localhost/api/vendor/flash-requests/x/offers", {
        productName: "Adapter",
        quantityAvailable: 1,
        unitPrice: 500,
        readyMinutes: 10,
      }),
      { params: Promise.resolve({ requestId: REQUEST_ID }) },
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("VENDOR_NOT_ELIGIBLE");
  });

  it.each(["REQUEST_EXPIRED", "REQUEST_CLOSED"] as const)(
    "maps %s offer rejection to HTTP 409",
    async (code) => {
      createClient.mockResolvedValueOnce({
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: code } }),
      });
      const response = await vendorOfferRoute.POST(
        jsonRequest("http://localhost/api/vendor/flash-requests/x/offers", {
          productName: "Adapter",
          quantityAvailable: 1,
          unitPrice: 500,
          readyMinutes: 10,
        }),
        { params: Promise.resolve({ requestId: REQUEST_ID }) },
      );
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe(code);
    },
  );
});

describe("atomic acceptance route", () => {
  it("does not reveal another customer's request", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "REQUEST_NOT_FOUND" },
      }),
    });
    const response = await acceptRoute.POST(
      new Request("http://localhost/accept", { method: "POST" }),
      context,
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("REQUEST_NOT_FOUND");
  });

  it("returns the reserved order response after acceptance", async () => {
    createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            order_id: "60000000-0000-4000-8000-000000000001",
            total: 1200,
            pickup_code: "AB12CD",
            expires_at: "2026-07-17T12:00:00Z",
          },
        ],
        error: null,
      }),
    });
    const response = await acceptRoute.POST(
      new Request("http://localhost/accept", { method: "POST" }),
      context,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        orderId: "60000000-0000-4000-8000-000000000001",
        status: "reserved",
        total: 1200,
        pickupCode: "AB12CD",
        expiresAt: "2026-07-17T12:00:00Z",
      },
    });
  });
});
