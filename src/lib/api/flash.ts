import { ApiError, type ErrorCode } from "@/lib/api/errors";

interface DatabaseErrorLike {
  message?: string;
  details?: string;
}

const codes = new Set<ErrorCode>([
  "INVALID_REQUEST",
  "INVALID_OFFER",
  "INVALID_QUANTITY",
  "REQUEST_NOT_FOUND",
  "REQUEST_EXPIRED",
  "REQUEST_CLOSED",
  "OFFER_NOT_FOUND",
  "OFFER_EXPIRED",
  "OFFER_NOT_ELIGIBLE",
  "OFFER_ALREADY_ACCEPTED",
  "VENDOR_NOT_ELIGIBLE",
  "UNAUTHENTICATED",
  "FORBIDDEN",
]);

const messages: Partial<Record<ErrorCode, string>> = {
  INVALID_REQUEST: "Invalid Flash Request data.",
  INVALID_OFFER: "Invalid merchant offer data.",
  INVALID_QUANTITY: "Quantity must be a positive integer.",
  REQUEST_NOT_FOUND: "Flash Request not found.",
  REQUEST_EXPIRED: "This Flash Request has expired.",
  REQUEST_CLOSED: "This Flash Request is no longer open.",
  OFFER_NOT_FOUND: "Offer not found.",
  OFFER_EXPIRED: "This offer has expired.",
  OFFER_NOT_ELIGIBLE: "This offer is not eligible for acceptance.",
  OFFER_ALREADY_ACCEPTED: "An offer has already been accepted for this request.",
  VENDOR_NOT_ELIGIBLE: "Your store is not eligible for this Flash Request.",
  UNAUTHENTICATED: "Authentication required.",
  FORBIDDEN: "You are not allowed to perform this action.",
};

export function flashDatabaseError(error: DatabaseErrorLike) {
  const candidate = (error.message ?? error.details ?? "").split("|", 1)[0] as ErrorCode;
  const code = codes.has(candidate) ? candidate : "INTERNAL_ERROR";
  return new ApiError(
    code,
    messages[code] ?? "The Flash marketplace operation could not be completed.",
  );
}
