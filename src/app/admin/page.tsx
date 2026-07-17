import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageProfile } from "@/lib/page-auth";

export default async function AdminDashboardPage() {
  const profile = await getPageProfile();
  if (!profile) redirect("/admin/login");
  return <div className="ops-shell">
    <aside className="ops-sidebar"><Link className="ops-brand" href="/">ZoneMart</Link><small>Administration</small><nav><b>Platform Overview</b><span>Orders</span><span>Inventory</span><span>Flash Requests</span><span>Analytics</span></nav></aside>
    <section className="ops-content"><span className="eyebrow">Protected operations shell</span><h1>Platform Overview</h1>
      <div className="notice"><strong>Admin backend unavailable.</strong> The current authoritative profile model supports only customer and vendor roles. This account is signed in as <b>{profile.role}</b>, so no platform data or actions are exposed.</div>
      <div className="ops-metrics"><article><small>Merchants</small><strong>Not connected</strong></article><article><small>Inventory</small><strong>Not connected</strong></article><article><small>Platform GMV</small><strong>Not connected</strong></article><article><small>Open requests</small><strong>Not connected</strong></article></div>
      <section className="card"><h2 className="editorial">Demand Radar: supply gaps</h2><p className="muted">An admin-wide aggregation endpoint and admin role do not exist in the current backend. No figures are fabricated.</p></section>
    </section>
  </div>;
}
