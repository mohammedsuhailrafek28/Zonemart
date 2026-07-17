import { requirePageRole } from "@/lib/page-auth";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("vendor", "/vendor");
  return children;
}
