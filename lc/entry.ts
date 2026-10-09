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
