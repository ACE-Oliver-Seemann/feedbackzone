import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { InsetList, InsetRow } from "@/components/ui/surface";
import { FORWARD } from "@/lib/page-motion";
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
      <Notice tone="success" title={t.home.nothing}>
        {emptyText}
      </Notice>
    );
  }
  return (
    <InsetList role="list">
      {tasks.map((task, index) => {
        const { text, action } = describe(task);
        return (
          <InsetRow
            key={`${task.kind}-${task.href}-${index}`}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <p className="min-w-0 text-[0.9375rem] leading-relaxed font-medium text-ink">{text}</p>
            {/* The first task is the most urgent one, so only it gets the primary button. */}
            <ButtonLink
              href={task.href}
              transitionTypes={FORWARD}
              variant={index === 0 ? "primary" : "secondary"}
              className="shrink-0 self-start sm:self-auto"
            >
              {action}
            </ButtonLink>
          </InsetRow>
        );
      })}
    </InsetList>
  );
}
