import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getCurrentSessionUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
