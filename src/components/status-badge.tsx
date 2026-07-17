export function orderStatus(status: string, readyAt?: string | null) {
  if (status === "reserved" && readyAt) return "Ready for pickup";
  return ({ reserved: "Reserved", completed: "Completed", cancelled: "Cancelled", expired: "Expired" } as Record<string, string>)[status] ?? status;
}
export function StatusBadge({ status, readyAt }: { status: string; readyAt?: string | null }) {
  const label = orderStatus(status, readyAt);
  const tone = status === "expired" || status === "cancelled" ? "danger" : status === "reserved" && !readyAt ? "warning" : "";
  return <span className={`badge ${tone}`}>{label}</span>;
}
