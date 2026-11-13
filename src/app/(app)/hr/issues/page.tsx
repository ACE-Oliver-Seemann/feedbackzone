import { redirect } from "next/navigation";

// IT-14: "Podnety" became "Zodpovednosti". Old links keep working: a link that
// opened the issue form for a round or a note goes to the new form, the rest to the list.
export default async function HrIssuesRedirect({ searchParams }: PageProps<"/hr/issues">) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, entry);
    }
  }
  const search = params.size > 0 ? `?${params}` : "";
  const target = params.has("round") || params.has("note") ? "/responsibilities/new" : "/responsibilities";
  redirect(`${target}${search}`);
}
