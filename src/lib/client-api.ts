export interface ApiFailure { error: { code: string; message: string } }

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({ error: { code: "UNKNOWN", message: "Something went wrong." } }));
  if (!response.ok) {
    const failure = payload as ApiFailure;
    throw new Error(failure.error?.message || "Something went wrong.");
  }
  return payload.data as T;
}

export const money = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));

export const displayError = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again.";
