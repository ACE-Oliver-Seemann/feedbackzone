// Text quality – Slovak plural forms of the generated sentences (NFR-07).
// Evaluates the text generators of src/lib/texts.sk.ts directly with the counts 0, 1, 2, 5
// (the UI renders exactly these strings). Not a browser test; run from the project root:
//   npx tsx testing/scripts/frontend/06-plurals.ts
import fs from "node:fs";
import path from "node:path";
import { t } from "../../../src/lib/texts.sk";

const EVID =
  process.env.QA_EVID ??
  "./testing/reports/2026-11-12_001/evidence/frontend";

type Case = { desc: string; actual: string; expected: RegExp; shown: string };
const cases: Case[] = [
  // home tasks (IT-11)
  { desc: "home.fillSurvey with 3 questions", actual: t.home.tasks.fillSurvey("Kolo", 3), expected: /Má 3 otázky /, shown: "„Má 3 otázky“" },
  { desc: "home.fillSurvey with 5 questions", actual: t.home.tasks.fillSurvey("Kolo", 5), expected: /Má 5 otázok /, shown: "„Má 5 otázok“" },
  { desc: "home.roundAwaitingAction closed today (0 days)", actual: t.home.tasks.roundAwaitingAction("Kolo", 0), expected: /uzavreté od dnes /, shown: "„uzavreté od dnes“" },
  { desc: "home.roundAwaitingAction 1 day", actual: t.home.tasks.roundAwaitingAction("Kolo", 1), expected: /uzavreté 1 deň /, shown: "„1 deň“" },
  { desc: "home.roundAwaitingAction 2 days", actual: t.home.tasks.roundAwaitingAction("Kolo", 2), expected: /uzavreté 2 dni /, shown: "„2 dni“" },
  { desc: "home.roundAwaitingAction 4 days", actual: t.home.tasks.roundAwaitingAction("Kolo", 4), expected: /uzavreté 4 dni /, shown: "„4 dni“" },
  { desc: "home.roundAwaitingAction 5 days", actual: t.home.tasks.roundAwaitingAction("Kolo", 5), expected: /uzavreté 5 dní /, shown: "„5 dní“" },
  { desc: "home.actionsOverdue 1", actual: t.home.tasks.actionsOverdue(1), expected: /^1 krok je po termíne\. Dokonči ho/, shown: "„1 krok je … Dokonči ho“" },
  { desc: "home.actionsOverdue 2", actual: t.home.tasks.actionsOverdue(2), expected: /^2 kroky sú po termíne\. Dokonči ich/, shown: "„2 kroky sú … Dokonči ich“" },
  { desc: "home.actionsOverdue 5", actual: t.home.tasks.actionsOverdue(5), expected: /^5 krokov je po termíne/, shown: "„5 krokov je“" },
  { desc: "home.startRound after 14 days", actual: t.home.tasks.startRound(14), expected: /pred 14 dňami/, shown: "„pred 14 dňami“" },
  { desc: "home.startRound without any round", actual: t.home.tasks.startRound(null), expected: /^Tím ešte nemal žiadny prieskum/, shown: "first-round sentence" },
  { desc: "home.roundsAwaitingAction 1 round, 1 day", actual: t.home.tasks.roundsAwaitingAction(1, "Tím Alfa", 1), expected: /^1 uzavreté kolo čaká .* Tím Alfa, 1 deň\.$/, shown: "„1 uzavreté kolo čaká … 1 deň“" },
  { desc: "home.roundsAwaitingAction 2 rounds, 2 days", actual: t.home.tasks.roundsAwaitingAction(2, "Tím Alfa", 2), expected: /^2 uzavreté kolá čakajú .* Tím Alfa, 2 dni\.$/, shown: "„2 uzavreté kolá čakajú … 2 dni“" },
  { desc: "home.roundsAwaitingAction 5 rounds, 5 days", actual: t.home.tasks.roundsAwaitingAction(5, "Tím Alfa", 5), expected: /^5 uzavretých kôl čaká .* Tím Alfa, 5 dní\.$/, shown: "„5 uzavretých kôl čaká … 5 dní“" },
  { desc: "home.issuesOverdue 1", actual: t.home.tasks.issuesOverdue(1), expected: /^1 podnet je po termíne\.$/, shown: "„1 podnet je“" },
  { desc: "home.issuesOverdue 2", actual: t.home.tasks.issuesOverdue(2), expected: /^2 podnety sú po termíne\.$/, shown: "„2 podnety sú“" },
  { desc: "home.issuesOverdue 5", actual: t.home.tasks.issuesOverdue(5), expected: /^5 podnetov je po termíne\.$/, shown: "„5 podnetov je“" },
  { desc: "home.lowParticipation closes tomorrow, 1 of 6", actual: t.home.tasks.lowParticipation("Kolo", "Tím Alfa", 1, 6, 1), expected: /sa uzavrie do zajtra a odpovedalo? iba 1 z 6\./, shown: "„do zajtra … iba 1 z 6“" },
  { desc: "home.lowParticipation closes in 3 days, 2 of 6", actual: t.home.tasks.lowParticipation("Kolo", "Tím Alfa", 2, 6, 3), expected: /sa uzavrie o 3 dni a odpovedal[io] iba 2 z 6\./, shown: "„o 3 dni … iba 2 z 6“" },
  { desc: "home.lowParticipation nobody answered (0 of 6)", actual: t.home.tasks.lowParticipation("Kolo", "Tím Alfa", 0, 6, 2), expected: /o 2 dni a (zatiaľ neodpovedal nikto|neodpovedal nikto|odpovedalo iba 0 z 6)/, shown: "„o 2 dni“ and a sentence for nobody" },
  // rounds, results
  { desc: "rounds.questionCount 3 / 4 / 5", actual: [3, 4, 5].map((n) => t.rounds.questionCount(n)).join(" | "), expected: /^3 otázky \| 4 otázky \| 5 otázok$/, shown: "3 otázky | 4 otázky | 5 otázok" },
  { desc: "fill.introDuration 3 / 5", actual: [3, 5].map((n) => t.fill.introDuration(n)).join(" | "), expected: /^3 otázky, .* \| 5 otázok, /, shown: "3 otázky | 5 otázok" },
  { desc: "results.insufficientText 0", actual: t.results.insufficientText(0, 5), expected: /^Kolo má 0 odpovedí\./, shown: "„0 odpovedí“" },
  { desc: "results.insufficientText 1", actual: t.results.insufficientText(1, 5), expected: /^Kolo má 1 odpoveď\./, shown: "„1 odpoveď“" },
  { desc: "results.insufficientText 2", actual: t.results.insufficientText(2, 5), expected: /^Kolo má 2 odpovede\./, shown: "„2 odpovede“" },
  { desc: "results.participation 5 of 6", actual: t.results.participation(5, 6), expected: /^Odpovedalo 5 z 6 členov tímu$/, shown: "„Odpovedalo 5 z 6“" },
  // trend, heatmap
  { desc: "trend.fewRounds 1 / 2", actual: [1, 2].map((n) => t.trend.fewRounds(n)).join(" | "), expected: /iba z 1 kola\..*iba z 2 kôl\./, shown: "„z 1 kola“ | „z 2 kôl“" },
  { desc: "heatmap.roundsCounted 0 / 1 / 2 / 5", actual: [0, 1, 2, 5].map((n) => t.heatmap.roundsCounted(n)).join(" | "), expected: /^0 kôl \| 1 kolo \| 2 kolá \| 5 kôl$/, shown: "0 kôl | 1 kolo | 2 kolá | 5 kôl" },
  // HR overview (IT-05, IT-13)
  { desc: "hrOverview.headlineWaiting 1 of 8, 1 day", actual: t.hrOverview.headlineWaiting(1, 8, "Tím Alfa", 1), expected: /^1 z 8 uzavretých kôl čaká na krok\. Najdlhšie Tím Alfa, 1 deň\.$/, shown: "„1 z 8 … čaká … 1 deň“" },
  { desc: "hrOverview.headlineWaiting 2 of 8, 2 days", actual: t.hrOverview.headlineWaiting(2, 8, "Tím Alfa", 2), expected: /^2 z 8 uzavretých kôl čakajú na krok\. Najdlhšie Tím Alfa, 2 dni\.$/, shown: "„2 z 8 … čakajú … 2 dni“" },
  { desc: "hrOverview.headlineWaiting 5 of 8, 5 days", actual: t.hrOverview.headlineWaiting(5, 8, "Tím Alfa", 5), expected: /^5 z 8 uzavretých kôl čaká na krok\. Najdlhšie Tím Alfa, 5 dní\.$/, shown: "„5 z 8 … čaká“ (5+ takes the singular verb, as on the home page)" },
  { desc: "hrOverview.headlineWaiting 1 of 1", actual: t.hrOverview.headlineWaiting(1, 1, "Tím Alfa", 3), expected: /^1 z 1 uzavretého kola čaká na krok\. Najdlhšie Tím Alfa, 3 dni\.$/, shown: "„1 z 1 uzavretého kola … 3 dni“" },
  { desc: "hrOverview.headlineAllDone 1", actual: t.hrOverview.headlineAllDone(1), expected: /^(Jediné|1) uzavreté kolo má zapísaný krok\.$/, shown: "„1 uzavreté kolo má zapísaný krok.“" },
  { desc: "hrOverview.headlineAllDone 2", actual: t.hrOverview.headlineAllDone(2), expected: /^(Obe|Všetky 2) uzavreté kolá majú zapísaný krok\.$/, shown: "„Všetky 2 uzavreté kolá majú zapísaný krok.“" },
  { desc: "hrOverview.headlineAllDone 5", actual: t.hrOverview.headlineAllDone(5), expected: /^Všetkých 5 uzavretých kôl má zapísaný krok\.$/, shown: "„Všetkých 5 uzavretých kôl má“" },
  { desc: "hrOverview.teamLine 1 of 1", actual: t.hrOverview.teamLine(1, 1), expected: /^Krok má 1 z 1 uzavretého kola\.$/, shown: "„1 z 1 uzavretého kola“" },
  { desc: "hrOverview.teamLine 3 of 5 and 0 closed", actual: `${t.hrOverview.teamLine(3, 5)} | ${t.hrOverview.teamLine(0, 0)}`, expected: /^Krok má 3 z 5 uzavretých kôl\. \| Zatiaľ žiadne uzavreté kolo\.$/, shown: "„3 z 5 uzavretých kôl“ | empty state" },
  { desc: "hrOverview.days 0 / 1 / 2 / 5 / 2.5", actual: [0, 1, 2, 5, 2.5].map((n) => t.hrOverview.days(n)).join(" | "), expected: /^0 dní \| 1 deň \| 2 dni \| 5 dní \| 2,5 dňa$/, shown: "0 dní | 1 deň | 2 dni | 5 dní | 2,5 dňa" },
  { desc: "hrOverview.awaitingSince 0 (closed today)", actual: t.hrOverview.awaitingSince(0), expected: /^uzavreté dnes$/, shown: "„uzavreté dnes“" },
  { desc: "hrOverview.awaitingSince 1 / 2 / 5", actual: [1, 2, 5].map((n) => t.hrOverview.awaitingSince(n)).join(" | "), expected: /^uzavreté pred 1 dňom \| uzavreté pred 2 dňami \| uzavreté pred 5 dňami$/, shown: "pred 1 dňom | pred 2 dňami | pred 5 dňami" },
  { desc: "newRound.selected 2 / 4", actual: [2, 4].map((n) => t.newRound.selected(n)).join(" | "), expected: /^Otázok v kole: 2 \(treba 3 až 5\) \| Otázok v kole: 4 \(treba 3 až 5\)$/, shown: "neutral wording, no plural needed" },
];

const results = cases.map((item) => {
  const ok = item.expected.test(item.actual);
  console.log(`${ok ? "PASS" : "FAIL"}    [T-Text] ${item.desc} => ${item.actual}`);
  return {
    area: "T-Text",
    desc: `Plural form: ${item.desc}`,
    pre: "Text generator from src/lib/texts.sk.ts evaluated with tsx (the UI renders this string unchanged)",
    steps: "Call the generator with the given count",
    expected: `Grammatical Slovak: ${item.shown}`,
    req: "NFR-07",
    status: ok ? "PASS" : "FAIL",
    actual: item.actual,
    evidence: "results-06-plurals.json",
  };
});
fs.writeFileSync(path.join(EVID, "results-06-plurals.json"), JSON.stringify(results, null, 1));
