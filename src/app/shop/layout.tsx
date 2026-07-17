import { requirePageRole } from "@/lib/page-auth";
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("customer", "/shop"); return children;
}
