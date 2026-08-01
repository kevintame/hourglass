import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  redirect(anyUser.length ? "/login" : "/setup");
}
