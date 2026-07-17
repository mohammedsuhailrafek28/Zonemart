import { requirePageRole } from "@/lib/page-auth";
export default async function FlashLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("customer", "/flash-requests"); return children;
}
