import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/page-auth";

// Old "Poslať kudos" route (MVP-16), kept for links and bookmarks.
export default async function NewKudosPage() {
  await requirePageUser();
  redirect("/kudos?tab=send");
}
