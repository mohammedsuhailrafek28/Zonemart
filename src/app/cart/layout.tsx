import { requirePageRole } from "@/lib/page-auth";
export default async function CartLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("customer", "/cart"); return children;
}
