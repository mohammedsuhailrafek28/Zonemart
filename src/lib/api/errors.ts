import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "BAD_REQUEST"
  | "EMPTY_CART"
  | "OUT_OF_STOCK"
  | "MULTI_STORE_CART"
  | "DIFFERENT_STORE"
  | "INACTIVE_PRODUCT"
  | "INVALID_QUANTITY"
  | "INVALID_REQUEST"
  | "INVALID_OFFER"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_EXPIRED"
  | "REQUEST_CLOSED"
  | "OFFER_NOT_FOUND"
  | "OFFER_EXPIRED"
  | "OFFER_NOT_ELIGIBLE"
  | "OFFER_ALREADY_ACCEPTED"
  | "VENDOR_NOT_ELIGIBLE"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const statusByCode: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  EMPTY_CART: 400,
  OUT_OF_STOCK: 409,
  MULTI_STORE_CART: 409,
  DIFFERENT_STORE: 409,
  INACTIVE_PRODUCT: 400,
  INVALID_QUANTITY: 400,
  INVALID_REQUEST: 400,
  INVALID_OFFER: 400,
  REQUEST_NOT_FOUND: 404,
  REQUEST_EXPIRED: 409,
  REQUEST_CLOSED: 409,
  OFFER_NOT_FOUND: 404,
  OFFER_EXPIRED: 409,
  OFFER_NOT_ELIGIBLE: 409,
  OFFER_ALREADY_ACCEPTED: 409,
  VENDOR_NOT_ELIGIBLE: 403,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid request input",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: statusByCode[error.code] },
    );
  }

  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
    { status: 500 },
  );
}
