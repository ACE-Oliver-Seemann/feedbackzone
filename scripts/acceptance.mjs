// Acceptance scenario from mvp.md (steps 1–6) against a running server.
// Usage: npm run setup && npm run dev, then in another terminal: npm run acceptance
// Needs a freshly seeded database; it creates a round, responses, an action and kudos.
const BASE = process.argv[2] ?? "http://localhost:3000";
const PASSWORD = "Heslo123";
let failures = 0;

function check(label, condition, detail = "") {
  if (!condition) failures++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? `  [${detail}]` : ""}`);
}

async function login(email) {
  const response = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`login failed for ${email}`);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const call = async (path, method = "GET", body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: "manual",
      headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, location: res.headers.get("location"), json, text };
  };
  return call;
}

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

const hr = await login("hr@example.test");
const mgrA = await login("manazer.alfa@example.test");
const mgrB = await login("manazer.beta@example.test");
const alfa = await Promise.all(
  ["adam", "barbora", "cyril", "dana", "emil"].map((n) => login(`${n}.alfa@example.test`)),
);

// 1. HR creates a round with 4 questions for team A.
const questions = (await hr("/api/questions")).json.questions;
const teamA = (await mgrA("/api/me")).json.user.teamId;
const deadline = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
const created = await hr("/api/rounds", "POST", {
  name: "Pulse – 46. týždeň",
  teamId: teamA,
  closesAt: deadline,
  // The fixed trend question is added by the server (IT-04): 1 fixed + 3 picked = 4.
  questionIds: questions.filter((q) => !q.fixed).slice(0, 3).map((q) => q.id),
});
check("1  HR creates a round with 4 questions for team A", created.status === 201);
const roundId = created.json.round.id;
check("1  HR opens the round", (await hr(`/api/rounds/${roundId}/open`, "POST")).status === 200);

// 2. Five members fill it in; a second attempt is rejected.
const home = await alfa[0]("/");
check("2  employee sees the round with a 'Vyplniť' link", text(home.text).includes("Vyplniť") && home.text.includes(`/rounds/${roundId}/fill`));
const fillPage = await alfa[0](`/rounds/${roundId}/fill`);
check("2  fill page shows the confidentiality text", text(fillPage.text).includes("Tvoje odpovede sú dôverné."), `HTTP ${fillPage.status}`);
const answers = [[4, 3, 5, 4], [2, 3, 4, 4], [5, 4, 4, 3], [3, 3, 5, 5], [4, 2, 4, 4]];
const comments = ["Tento týždeň to šlo dobre.", null, "Privítal by som menej porád.", null, "Vďaka za podporu."];
for (const [i, member] of alfa.entries()) {
  const res = await member(`/api/rounds/${roundId}/responses`, "POST", { answers: answers[i], comment: comments[i] });
  check(`2  member ${i + 1} submits`, res.status === 201);
}
const second = await alfa[0](`/api/rounds/${roundId}/responses`, "POST", { answers: [1, 1, 1, 1] });
check("2  second attempt is rejected with 409", second.status === 409, second.json?.error);
check("2  fill page now says already submitted", text((await alfa[0](`/rounds/${roundId}/fill`)).text).includes("Toto kolo už máš vyplnené"));
check("2  home shows 'Odoslané'", text((await alfa[0]("/")).text).includes("Odoslané"));

// Open round: participation only.
const openResults = await mgrA(`/api/rounds/${roundId}/results`);
check("   open round shows participation only", openResults.json.status === "not_closed" && openResults.json.participation.responded === 5);
check("   HR closes the round", (await hr(`/api/rounds/${roundId}/close`, "POST")).status === 200);
check("   response to a closed round is rejected", (await mgrA(`/api/rounds/${roundId}/responses`, "POST", { answers: [3, 3, 3, 3] })).status === 409);

// 3. Manager A sees averages and comments; manager B does not.
const results = await mgrA(`/api/rounds/${roundId}/results`);
check("3  manager A gets averages", results.json.status === "ok" && results.json.questions[0].average === 3.6, JSON.stringify(results.json.questions?.map((q) => q.average)));
check("3  manager A gets 3 comments", results.json.comments?.length === 3);
const page = text((await mgrA(`/rounds/${roundId}/results`)).text);
check("3  results page renders averages and comments", page.includes("3,6") && page.includes("Privítal by som menej porád.") && page.includes("Odpovedalo 5 z 6"));
check("3  results page marks the round 'Čaká na krok'", page.includes("Čaká na krok"));
check("3  manager B gets 403 from the API", (await mgrB(`/api/rounds/${roundId}/results`)).status === 403);
const pageB = await mgrB(`/rounds/${roundId}/results`);
check("3  manager B gets 403 from the page", pageB.status === 403 && !pageB.text.includes("Privítal by som"), `HTTP ${pageB.status}`);
check("3  employee gets 403 from the page", (await alfa[0](`/rounds/${roundId}/results`)).status === 403);

// 4. Team B round with 4 responses: only "Nedostatok odpovedí".
const betaRound = (await mgrB("/api/rounds")).json.rounds.find((r) => r.status === "CLOSED");
const beta = await mgrB(`/api/rounds/${betaRound.id}/results`);
check("4  API returns insufficient_responses and the count", beta.json.status === "insufficient_responses" && beta.json.responseCount === 4 && !("questions" in beta.json) && !("comments" in beta.json));
const betaPage = text((await mgrB(`/rounds/${betaRound.id}/results`)).text);
check("4  page shows 'Nedostatok odpovedí' and no comments", betaPage.includes("Nedostatok odpovedí") && !betaPage.includes("Posledný šprint") && !betaPage.includes("Priemer"));

// 5. Manager A writes an action; the employee sees it.
const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
const action = await mgrA(`/api/rounds/${roundId}/actions`, "POST", {
  topic: "Porady",
  description: "Zrušíme stredajšiu poradu a nahradíme ju písomným statusom.",
  dueDate: due,
});
check("5  manager A adds an action", action.status === 201);
check("5  HR cannot add an action", (await hr(`/api/rounds/${roundId}/actions`, "POST", { topic: "x", description: "y", dueDate: due })).status === 403);
check("5  manager changes the status", (await mgrA(`/api/actions/${action.json.action.id}`, "PATCH", { status: "IN_PROGRESS" })).json?.action?.status === "IN_PROGRESS");
const after = text((await mgrA(`/rounds/${roundId}/results`)).text);
check("5  results page shows the action and no 'Čaká na krok'", after.includes("Zrušíme stredajšiu poradu") && !after.includes("Čaká na krok"));
check("5  HR sees the action on the results page", text((await hr(`/rounds/${roundId}/results`)).text).includes("Zrušíme stredajšiu poradu"));


// 5 (cont.) The employee sees the action in "Povedali ste, urobili sme".
const teamPage = await alfa[0](`/team/${teamA}`);
const teamText = text(teamPage.text);
check("5  employee sees the action on the team page", teamPage.status === 200 && teamText.includes("Povedali ste, urobili sme") && teamText.includes("Zrušíme stredajšiu poradu") && teamText.includes("Prebieha"));
check("5  team page shows averages but no comments", teamText.includes("3,6") && !teamText.includes("Privítal by som menej porád."));
check("5  member of team B gets 403 on team A page", (await mgrB(`/team/${teamA}`)).status === 403);
const teamB = (await mgrB("/api/me")).json.user.teamId;
const teamBText = text((await mgrB(`/team/${teamB}`)).text);
check("5  team B page hides averages below the threshold", teamBText.includes("Nedostatok odpovedí") && !teamBText.includes("Posledný šprint"));
check("5  HR can open the team page", (await hr(`/team/${teamA}`)).status === 200);
const menuHtml = (await alfa[0]("/")).text;
check("5  menu has team and kudos links", menuHtml.includes(`/team/${teamA}`) && menuHtml.includes('href="/kudos"') && !menuHtml.includes('href="/kudos/me"') && !menuHtml.includes('href="/kudos/new"'));

// 6. An employee sends public kudos to a colleague; it shows in the team feed.
const barboraId = (await alfa[1]("/api/me")).json.user.id;
const kudos = await alfa[0]("/api/kudos", "POST", { toUserId: barboraId, text: "Ďakujem za pomoc s nasadením novej verzie.", value: "HELPING", visibility: "TEAM" });
check("6  employee sends public kudos", kudos.status === 201);
check("6  kudos to oneself is rejected", (await alfa[1]("/api/kudos", "POST", { toUserId: barboraId, text: "Ďakujem sám sebe za všetko.", value: "QUALITY", visibility: "TEAM" })).status === 400);
const feed = text((await alfa[2](`/team/${teamA}`)).text);
check("6  kudos shows in the team feed with the sender name", feed.includes("Ďakujem za pomoc s nasadením novej verzie.") && feed.includes("Adam Vzorový → Barbora Skúšobná") && feed.includes("Pomoc kolegom"));
await mgrA("/api/kudos", "POST", { toUserId: barboraId, text: "Súkromné poďakovanie za prácu navyše.", value: "QUALITY", visibility: "PRIVATE" });
check("6  private kudos is not in the feed (manager, HR, colleague)", ![await mgrA(`/team/${teamA}`), await hr(`/team/${teamA}`), await alfa[2](`/team/${teamA}`)].some((p) => p.text.includes("Súkromné poďakovanie")));
// /kudos renders both tabs (the inactive one hidden), so received kudos and
// the send form are both in the HTML. The old routes redirect to it.
const kudosHub = await alfa[1]("/kudos");
const myKudos = text(kudosHub.text);
check("6  /kudos renders for an employee", kudosHub.status === 200);
check("6  recipient sees both on /kudos", myKudos.includes("Súkromné poďakovanie za prácu navyše.") && myKudos.includes("Ďakujem za pomoc s nasadením"));
const hrKudos = await hr("/kudos");
const hrKudosText = text(hrKudos.text);
check("6  /kudos renders for HR", hrKudos.status === 200);
check("6  another user does not see them on /kudos", !hrKudosText.includes("Súkromné poďakovanie") && !hrKudosText.includes("Ďakujem za pomoc s nasadením"));
const kudosSend = await alfa[0]("/kudos?tab=send");
check("6  kudos form renders on /kudos?tab=send", kudosSend.status === 200 && text(kudosSend.text).includes("Kudos je podpísané tvojím menom."));
// redirect() answers 307 + Location (or a meta refresh if the response already streams).
const redirectsTo = (res, target) => {
  if (res.status >= 300 && res.status < 400 && res.location) {
    const url = new URL(res.location, BASE);
    return url.pathname + url.search === target;
  }
  return res.text.includes(`url=${target}`);
};
check("6  /kudos/me redirects to /kudos", redirectsTo(await alfa[1]("/kudos/me"), "/kudos"));
check("6  /kudos/new redirects to /kudos?tab=send", redirectsTo(await alfa[0]("/kudos/new"), "/kudos?tab=send"));

// NFR-04 on every rendered page.
const pages = [await alfa[0]("/"), fillPage, teamPage, await mgrA(`/rounds/${roundId}/results`), await hr("/hr/rounds"), await hr("/rounds/new"), kudosHub, hrKudos, kudosSend];
check("NFR-04  no rendered page contains the forbidden word", !pages.some((p) => /anonym/i.test(p.text)));

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
