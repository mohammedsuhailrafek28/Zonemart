import { redirect } from "next/navigation";

export default function VendorLoginPage() {
  redirect("/auth/sign-in?portal=vendor&next=/vendor");
}
