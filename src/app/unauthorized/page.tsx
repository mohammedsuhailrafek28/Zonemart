import Link from "next/link";
import { getPageProfile } from "@/lib/page-auth";

export default async function UnauthorizedPage() {
  const profile = await getPageProfile();
  return <div className="container page"><section className="empty">
    <span className="eyebrow">Access restricted</span>
    <h2>This workspace is not available to this account.</h2>
    <p className="muted">ZoneMart checks your saved profile role on the server before opening customer or vendor operations.</p>
    <Link className="button" href={profile?.role === "vendor" ? "/vendor" : profile?.role === "customer" ? "/shop" : "/auth/sign-in"}>Return to your workspace</Link>
  </section></div>;
}
