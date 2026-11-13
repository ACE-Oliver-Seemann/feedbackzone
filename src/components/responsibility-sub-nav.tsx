import { SubNav } from "@/components/sub-nav";
import { t } from "@/lib/texts.sk";

/** HR's tabs of the area "Zodpovednosti" (IT-12, IT-14). */
export function ResponsibilitySubNav({ current }: { current: "/responsibilities" | "/hr/notes" }) {
  return (
    <SubNav
      label={t.nav.responsibilities}
      current={current}
      items={[
        { href: "/responsibilities", label: t.nav.responsibilities },
        { href: "/hr/notes", label: t.nav.hrNotes },
      ]}
    />
  );
}
