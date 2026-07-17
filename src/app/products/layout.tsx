import { requirePageRole } from "@/lib/page-auth";
export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("customer", "/shop"); return children;
}
