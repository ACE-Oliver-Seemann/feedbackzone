import type { Metadata } from "next";
import { NoteForm } from "@/components/note-form";
import { SubNav } from "@/components/sub-nav";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { IconCalendar, IconClipboard, IconPlus } from "@/components/ui/icons";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { InsetList, InsetRow, Section } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import { listNotes } from "@/server/hr-issues";

// Screen "Poznámky zo stretnutí" for HR (IT-10).
export const metadata: Metadata = { title: t.notes.pageTitle };

// Same tones as the action statuses elsewhere (neutral, info, success).
const STATUS_TONE: Record<keyof typeof t.issueStatuses, BadgeTone> = {
  OPEN: "neutral",
  IN_PROGRESS: "info",
  DONE: "success",
};

export default async function HrNotesPage() {
  const user = await requirePageUser("HR");
  const notes = await pageData(() => listNotes(user));

  return (
    <Page>
      <SubNav
        label={t.nav.hrIssues}
        current="/hr/notes"
        items={[
          { href: "/hr/issues", label: t.nav.hrIssues },
          { href: "/hr/notes", label: t.nav.hrNotes },
        ]}
      />
      <PageHeader title={t.notes.pageTitle} description={t.notes.intro} />

      <div>
        <Section title={t.notes.newTitle}>
          <NoteForm />
        </Section>

        <Section title={t.notes.listTitle}>
          {notes.length === 0 ? (
            <EmptyState icon={<IconClipboard size={20} />} title={t.notes.empty} />
          ) : (
            <InsetList>
              {notes.map((note) => (
                <InsetRow key={note.id} className="py-5">
                  <h3 className="text-[0.9375rem] leading-snug font-semibold break-words text-ink">
                    {note.title}
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
                    <IconCalendar size={14} />
                    {t.notes.heldOn(formatDate(note.meetingDate))}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-line text-ink-soft">
                    {note.text}
                  </p>
                  {note.issues.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-muted">{t.notes.issuesTitle}</p>
                      <ul className="mt-1.5 space-y-1.5 text-sm text-ink">
                        {note.issues.map((issue) => (
                          <li key={issue.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="min-w-0 break-words">{issue.title}</span>
                            <Badge tone={STATUS_TONE[issue.status]}>
                              {t.issueStatuses[issue.status]}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ButtonLink
                    href={`/hr/issues?note=${note.id}#new`}
                    transitionTypes={FORWARD}
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                  >
                    <IconPlus size={16} className="-ml-0.5" />
                    {t.notes.createIssue}
                  </ButtonLink>
                </InsetRow>
              ))}
            </InsetList>
          )}
        </Section>
      </div>
    </Page>
  );
}
