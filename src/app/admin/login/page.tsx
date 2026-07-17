import { redirect } from "next/navigation";

export default function AdminLoginPage() {
  redirect("/auth/sign-in?portal=admin&next=/admin");
}
