import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Countdown } from "@/components/countdown";
import { ReservationConfirmation } from "@/components/reservation-confirmation";
import { StatusBadge, orderStatus } from "@/components/status-badge";
import { api, money } from "@/lib/client-api";

afterEach(() => vi.restoreAllMocks());

describe("customer presentation models", () => {
  it("maps every customer order state", () => {
    expect(orderStatus("reserved")).toBe("Reserved");
    expect(orderStatus("reserved", "2026-01-01")).toBe("Ready for pickup");
    expect(orderStatus("completed")).toBe("Completed");
    expect(orderStatus("cancelled")).toBe("Cancelled");
    expect(orderStatus("expired")).toBe("Expired");
  });

  it("renders the ready-for-pickup operational state", () => {
    render(<StatusBadge status="reserved" readyAt="2026-01-01T00:00:00Z" />);
    expect(screen.getByText("Ready for pickup")).toBeInTheDocument();
  });

  it("formats Indian Rupee prices", () => {
    expect(money(1499)).toContain("1,499");
  });
});

describe("reservation truth", () => {
  it("renders pickup code, authoritative total and order link", () => {
    render(<ReservationConfirmation reservation={{ orderId: "one", status: "reserved", total: 1499, pickupCode: "K7X2QF", expiresAt: new Date(Date.now() + 1_800_000).toISOString() }} />);
    expect(screen.getByText("K7X2QF")).toBeInTheDocument();
    expect(screen.getByText(/1,499/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View my orders" })).toHaveAttribute("href", "/orders");
  });

  it("shows expiration without claiming the client controls it", () => {
    render(<Countdown expiresAt={new Date(Date.now() - 1000).toISOString()} />);
    expect(screen.getByText("Hold expired")).toBeInTheDocument();
  });

  it("updates a live countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    render(<Countdown expiresAt="2026-01-01T00:01:00Z" />);
    expect(screen.getByText("1:00 remaining")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("0:59 remaining")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("typed API client used by cart, checkout and Flash flows", () => {
  it("returns the success data envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items: [] } }) }));
    await expect(api("/api/cart")).resolves.toEqual({ items: [] });
  });

  it("surfaces stable backend conflict messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { code: "DIFFERENT_STORE", message: "Choose products from one store." } }) }));
    await expect(api("/api/cart", { method: "POST" })).rejects.toThrow("Choose products from one store.");
  });

  it("sends mutation JSON to the real route contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { productId: "p1", quantity: 2 } }) });
    vi.stubGlobal("fetch", fetchMock);
    await api("/api/cart", { method: "PATCH", body: JSON.stringify({ quantity: 2 }) });
    expect(fetchMock).toHaveBeenCalledWith("/api/cart", expect.objectContaining({ method: "PATCH", body: "{\"quantity\":2}" }));
  });
});
