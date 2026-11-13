import type { Metadata } from "next";
import { NoteForm } from "@/components/note-form";
import { StatusBadge } from "@/components/responsibility-meta";
import { ResponsibilitySubNav } from "@/components/responsibility-sub-nav";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { IconCalendar, IconClipboard, IconPlus } from "@/components/ui/icons";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { InsetList, InsetRow, Section } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import { listNotes } from "@/server/hr-issues";

// Screen "Poznámky zo stretnutí" for HR (IT-10), a tab of "Zodpovednosti" (IT-14).
export const metadata: Metadata = { title: t.notes.pageTitle };

export default async function HrNotesPage() {
  const user = await requirePageUser("HR");
  const notes = await pageData(() => listNotes(user));

  return (
    <Page>
      <ResponsibilitySubNav current="/hr/notes" />
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
                            <Link
                              href={`/responsibilities/${issue.id}`}
                              transitionTypes={FORWARD}
                              className="min-w-0 rounded font-medium break-words text-brand-700 underline underline-offset-2 hover:text-brand-900"
                            >
                              {issue.title}
                            </Link>
                            <StatusBadge status={issue.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ButtonLink
                    href={`/responsibilities/new?note=${note.id}`}
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
