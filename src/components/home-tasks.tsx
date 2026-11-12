import Link from "next/link";
import { t } from "@/lib/texts.sk";
import type { HomeTask } from "@/server/home";

/** One sentence and one button per task (IT-11). */
function describe(task: HomeTask): { text: string; action: string } {
  switch (task.kind) {
    case "fill_survey":
      return {
        text: t.home.tasks.fillSurvey(task.roundName, task.questionCount),
        action: t.home.actions.fill,
      };
    case "round_awaiting_action":
      return {
        text: t.home.tasks.roundAwaitingAction(task.roundName, task.daysWaiting),
        action: t.home.actions.results,
      };
    case "actions_overdue":
      return { text: t.home.tasks.actionsOverdue(task.count), action: t.home.actions.actions };
    case "start_round":
      return { text: t.home.tasks.startRound(task.daysSinceLast), action: t.home.actions.newRound };
    case "rounds_awaiting_action":
      return {
        text: t.home.tasks.roundsAwaitingAction(task.count, task.longestTeam, task.longestDays),
        action: t.home.actions.overview,
      };
    case "issues_overdue":
      return { text: t.home.tasks.issuesOverdue(task.count), action: t.home.actions.issues };
    case "low_participation":
      return {
        text: t.home.tasks.lowParticipation(
          task.roundName,
          task.teamName,
          task.responded,
          task.teamSize,
          task.daysLeft,
        ),
        action: t.home.actions.participation,
      };
  }
}

export function HomeTasks({ tasks, emptyText }: { tasks: HomeTask[]; emptyText: string }) {
  if (tasks.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <span className="font-semibold">{t.home.nothing}</span> {emptyText}
      </p>
    );
  }
  return (
    <ol className="mt-3 space-y-3">
      {tasks.map((task, index) => {
        const { text, action } = describe(task);
        return (
          <li
            key={`${task.kind}-${task.href}-${index}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-white p-4"
          >
            <p className="min-w-0 flex-1 basis-48 font-medium">{text}</p>
            <Link
              href={task.href}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              {action}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
