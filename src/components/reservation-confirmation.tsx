import Link from "next/link";
import { money } from "@/lib/client-api";
import type { Reservation } from "@/lib/ui-models";
import { Countdown } from "./countdown";

export function ReservationConfirmation({ reservation, title = "Your pickup hold is confirmed" }: { reservation: Reservation; title?: string }) {
  return <section className="card" aria-live="polite"><span className="eyebrow">Reserved for 30 minutes</span><h2>{title}</h2><p className="muted">Show this code at the store. The server—not this countdown—determines the hold status.</p>
    <div className="pickup"><div className="muted">Pickup code</div><div className="pickup-code">{reservation.pickupCode}</div><Countdown expiresAt={reservation.expiresAt} /></div>
    <div className="summary-line total"><span>Total</span><span>{money(reservation.total)}</span></div>
    <div className="actions"><Link className="button" href="/orders">View my orders</Link><Link className="button secondary" href="/shop">Keep shopping</Link></div>
  </section>;
}
