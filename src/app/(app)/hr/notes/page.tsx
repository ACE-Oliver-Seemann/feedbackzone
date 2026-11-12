import Link from "next/link";
import { NoteForm } from "@/components/note-form";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { listNotes } from "@/server/hr-issues";

// Screen "Poznámky zo stretnutí" for HR (IT-10).
export default async function HrNotesPage() {
  const user = await requirePageUser("HR");
  const notes = await pageData(() => listNotes(user));

  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-semibold">{t.notes.pageTitle}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.notes.intro}</p>

      <h2 className="mt-6 text-lg font-semibold">{t.notes.newTitle}</h2>
      <NoteForm />

      <h2 className="mt-8 text-lg font-semibold">{t.notes.listTitle}</h2>
      {notes.length === 0 ? (
        <p className="mt-3 text-slate-600">{t.notes.empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium">{note.title}</h3>
              <p className="text-xs text-slate-600">{t.notes.heldOn(formatDate(note.meetingDate))}</p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{note.text}</p>
              {note.issues.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-600">{t.notes.issuesTitle}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {note.issues.map((issue) => (
                      <li key={issue.id}>
                        {issue.title} ({t.issueStatuses[issue.status]})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Link
                href={`/hr/issues?note=${note.id}#new`}
                className="mt-3 inline-block rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
              >
                {t.notes.createIssue}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
