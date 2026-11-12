import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/page-auth";

// Old "Moje kudos" route (MVP-17), kept for links and bookmarks.
export default async function MyKudosPage() {
  await requirePageUser();
  redirect("/kudos");
}
