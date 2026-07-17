import { ApiError } from "@/lib/api/errors";

interface DatabaseErrorLike {
  message?: string;
  details?: string;
}

const stableCodes = new Set([
  "EMPTY_CART",
  "OUT_OF_STOCK",
  "MULTI_STORE_CART",
  "DIFFERENT_STORE",
  "INACTIVE_PRODUCT",
  "INVALID_QUANTITY",
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "FORBIDDEN",
]);

export function commerceDatabaseError(error: DatabaseErrorLike): ApiError {
  const message = error.message ?? error.details ?? "Database operation failed";
  const [candidate, productName] = message.split("|", 2);
  const code = stableCodes.has(candidate) ? candidate : "INTERNAL_ERROR";

  if (code === "OUT_OF_STOCK") {
    return new ApiError(
      "OUT_OF_STOCK",
      productName ? `${productName} just sold out.` : "Requested stock is unavailable.",
    );
  }

  const messages: Record<string, string> = {
    EMPTY_CART: "Your cart is empty.",
    MULTI_STORE_CART: "Checkout supports items from one store only.",
    DIFFERENT_STORE: "Your cart already contains items from another store.",
    INACTIVE_PRODUCT: "This product is no longer available.",
    INVALID_QUANTITY: "Quantity must be a positive integer.",
    NOT_FOUND: "Product not found.",
    UNAUTHENTICATED: "Authentication required.",
    FORBIDDEN: "Customer role required.",
    INTERNAL_ERROR: "The commerce operation could not be completed.",
  };

  return new ApiError(
    code as ConstructorParameters<typeof ApiError>[0],
    messages[code],
  );
}

export interface CommerceRpcResult {
  order_id: string;
  total: number | string;
  pickup_code: string;
  expires_at: string;
}

export function orderResponse(row: CommerceRpcResult) {
  return {
    orderId: row.order_id,
    status: "reserved" as const,
    total: Number(row.total),
    pickupCode: row.pickup_code,
    expiresAt: row.expires_at,
  };
}
