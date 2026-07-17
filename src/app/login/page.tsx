import Link from "next/link";

export default function PortalSelectionPage() {
  return <div className="portal-select">
    <section><span className="eyebrow">ZoneMart operational ecosystem</span><h1>Choose your portal.</h1><p className="lead">One marketplace, with access separated by the role stored in your authoritative ZoneMart profile.</p></section>
    <div className="portal-options">
      <Link href="/auth/sign-in?next=/shop"><strong>Customer</strong><span>Search, reserve, order and create Flash Requests.</span></Link>
      <Link href="/vendor/login"><strong>Vendor</strong><span>Manage inventory, reservations and nearby demand.</span></Link>
      <Link href="/admin/login"><strong>Admin</strong><span>Protected operations shell. No admin backend is provisioned.</span></Link>
    </div>
  </div>;
}
