import { requirePageRole } from "@/lib/page-auth";
export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("customer", "/orders"); return children;
}
