import { ApiError, type ErrorCode } from "@/lib/api/errors";

interface DatabaseErrorLike {
  message?: string;
  details?: string;
}

const stableCodes = new Set<ErrorCode>([
  "INVALID_STORE",
  "INVALID_PRODUCT",
  "STORE_NOT_FOUND",
  "STORE_NOT_VERIFIED",
  "PRODUCT_NOT_FOUND",
  "PRODUCT_INACTIVE",
  "ORDER_NOT_FOUND",
  "ORDER_EXPIRED",
  "INVALID_ORDER_STATUS",
  "INVALID_PICKUP_CODE",
  "ORDER_ALREADY_COMPLETED",
  "ORDER_ALREADY_CANCELLED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
]);

const messages: Partial<Record<ErrorCode, string>> = {
  INVALID_STORE: "Invalid storefront data.",
  INVALID_PRODUCT: "Invalid product data.",
  STORE_NOT_FOUND: "Vendor store not found.",
  STORE_NOT_VERIFIED: "An active verified store is required.",
  PRODUCT_NOT_FOUND: "Product not found.",
  PRODUCT_INACTIVE: "This product is inactive.",
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_EXPIRED: "This reservation has expired.",
  INVALID_ORDER_STATUS: "This order cannot make that transition.",
  INVALID_PICKUP_CODE: "The pickup code is incorrect.",
  ORDER_ALREADY_COMPLETED: "This order is already completed.",
  ORDER_ALREADY_CANCELLED: "This order is already cancelled.",
  UNAUTHENTICATED: "Authentication required.",
  FORBIDDEN: "You are not allowed to perform this action.",
};

export function fulfillmentDatabaseError(error: DatabaseErrorLike) {
  const candidate = (error.message ?? error.details ?? "").split("|", 1)[0] as ErrorCode;
  const code = stableCodes.has(candidate) ? candidate : "INTERNAL_ERROR";
  return new ApiError(
    code,
    messages[code] ?? "The fulfilment operation could not be completed.",
  );
}
