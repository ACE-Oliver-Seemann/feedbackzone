// Prints the ids and states of the rounds in the QA database (helper for the other scripts).
import { launch, discover, session, USERS, api } from "./s2-lib.mjs";
const browser = await launch();
const d = await discover(browser);
console.log("teamA", d.teamA, "teamB", d.teamB);
const hr = await session(browser, USERS.hr);
for (const r of d.rounds) {
  const res = await api(hr, `/api/rounds/${r.id}/results`);
  console.log(r.id, r.teamId === d.teamA ? "A" : "B", r.status, JSON.stringify(r.name), Object.keys(r).join(","), "->", res.status ?? Object.keys(res).join(","), res.responseCount ?? res.count ?? "");
}
await browser.close();
