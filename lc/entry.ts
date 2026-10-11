// Everything the Lessons area needs from the Life Competencies app, exposed as window.LC.
// Built by lc/build.mjs straight from ~/Codes/digital-literacy/src/lib - do not edit the output by hand.
export { LESSON_PLANS, CORE_COMPETENCIES, yearTheme, LESSON_SUBJECT, PROGRAMME } from "@lc/competencies";
export { noteFor } from "@lc/teachingNotes";
export { deepFor } from "@lc/teachDeep";
export { visualFor } from "@lc/teachVisual";
export { detailFor } from "@lc/detail";
export { quizTen, optionsForItem } from "@lc/weekQuiz";
export { doNowFor } from "@lc/doNow";
export { expandActivity } from "@lc/activityGuides";
export { weekCriteria } from "@lc/weekCriteria";
export { taskFor } from "@lc/studentTasks";
export { buildLesson, isRight, FACES } from "@lc/lessons";
export { gameFor, buildGameHtml, GAMES } from "@lc/game";
export { runThemeFor, buildPlatformerHtml } from "@lc/platformer";
export { runLevels } from "@lc/runLevels";
export const BUILT = { at: process.env.LC_BUILT_AT || "", commit: process.env.LC_COMMIT || "" };

// When each week is taught — the same schedule this app's Lesson Plans and Scheme of Work show, so Class Points
// calls each lesson by the same calendar week. Mirrors lessonUnits + fitToTerm in the LC app's src/app/page.tsx (spans only):
// a lesson whose class falls on a holiday moves to the next time the class meets; declared pairs
// (plan.combined) and anything the term has no date for are taught together.
import { scheduleTerm } from "@lc/timetable";
import { LESSON_PLANS as PLANS, type LessonPlan } from "@lc/competencies";
import { ACADEMIC_YEAR } from "@lc/schemeOfWork";
export { ACADEMIC_YEAR };
export type ScheduleRow = { cal: string; date: string; time: string; note: string; weeks: number[] };
export function termSchedule(planId: string): ScheduleRow[] {
  const plan = PLANS.find((p: LessonPlan) => p.id === planId);
  if (!plan) return [];
  const paired = new Map<number, number[]>();
  for (const g of plan.combined ?? []) for (const n of g) paired.set(n, g);
  const done = new Set<number>();
  let units: number[][] = [];
  for (const w of plan.weeks) {
    if (done.has(w.week)) continue;
    const g = (paired.get(w.week) ?? [w.week]).filter((n) => plan.weeks.some((x) => x.week === n));
    g.forEach((n) => done.add(n));
    units.push(g);
  }
  const dates = scheduleTerm(plan.term, plan.year, units).rows.filter((r) => r.item).length;
  if (dates < units.length && dates > 0) units = [...units.slice(0, dates - 1), units.slice(dates - 1).flat().sort((a, b) => a - b)];
  return scheduleTerm(plan.term, plan.year, units).rows.map((r) => ({
    cal: r.row.week || "",
    date: r.when.kind === "date" ? r.when.label : "",
    time: r.when.kind === "date" ? r.when.time : "",
    note: r.row.note || (r.when.kind === "none" ? r.when.label : ""),
    weeks: r.item ?? [],
  }));
}
