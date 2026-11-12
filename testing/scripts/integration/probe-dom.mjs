// Dumps a simplified DOM (no classes, no SVG) of the main pages per role. Used to derive selectors
// for the redesigned markup; not a test. Output: evidence/integration/dom/<name>.html
import { BASE, U, db, resetDb, session, closeBrowser, EVIDENCE } from "./lib.mjs";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(EVIDENCE, "dom");
fs.mkdirSync(OUT, { recursive: true });
export async function dump(page, name, selector = "body") {
  const html = await page.evaluate((sel) => {
    const root = document.querySelector(sel).cloneNode(true);
    root.querySelectorAll("svg, script, style, link, noscript, template").forEach((n) => n.remove());
    root.querySelectorAll("*").forEach((n) => {
      for (const a of [...n.attributes]) {
        if (["class", "style"].includes(a.name) || a.name.startsWith("data-motion")) n.removeAttribute(a.name);
      }
    });
    return root.innerHTML.replace(/<!--.*?-->/g, "").replace(/>\s+</g, "><").replace(/></g, ">\n<");
  }, selector);
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
}

if (process.argv[1].endsWith("probe-dom.mjs")) {
  resetDb(true);
  const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
  const rounds = await db.round.findMany({ include: { _count: { select: { participations: true } } } });
  const closedA = rounds.find((r) => r.teamId === teamA.id && r.status === "CLOSED" && r._count.participations >= 5);
  const openA = rounds.find((r) => r.teamId === teamA.id && r.status === "OPEN");
  console.log("rounds", rounds.map((r) => `${r.name}|${r.status}|${r._count.participations}|${r.teamId === teamA.id ? "A" : "B"}`).join("\n"));
  const go = async (page, url, name) => {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await dump(page, name);
  };
  const hr = await session(U.hr);
  await go(hr, "/", "hr-home");
  await go(hr, "/hr/rounds", "hr-rounds");
  await go(hr, "/rounds/new", "hr-new-round");
  await go(hr, "/hr/overview", "hr-overview");
  await go(hr, "/hr/heatmap", "hr-heatmap");
  await go(hr, "/hr/issues", "hr-issues");
  await go(hr, "/hr/notes", "hr-notes");
  await go(hr, `/rounds/${closedA.id}/results`, "hr-results");
  await go(hr, `/team/${teamA.id}`, "hr-team");
  await go(hr, "/kudos", "hr-kudos");
  const mgr = await session(U.mgrA);
  await go(mgr, "/", "mgr-home");
  await go(mgr, "/rounds", "mgr-rounds");
  await go(mgr, "/rounds/new", "mgr-new-round");
  await go(mgr, `/rounds/${closedA.id}/results`, "mgr-results");
  await go(mgr, `/rounds/${closedA.id}/report`, "mgr-report");
  await go(mgr, `/team/${teamA.id}`, "mgr-team");
  await go(mgr, `/team/${teamA.id}/trend`, "mgr-trend");
  await go(mgr, "/kudos", "mgr-kudos");
  await go(mgr, "/kudos?tab=send", "mgr-kudos-send");
  const emp = await session(U.alfa[0]);
  await go(emp, "/", "emp-home");
  await go(emp, `/team/${teamA.id}`, "emp-team");
  await go(emp, "/kudos", "emp-kudos");
  if (openA) {
    await go(emp, `/rounds/${openA.id}/fill`, "emp-fill-intro");
    const start = emp.getByRole("button", { name: "Začať" });
    if (await start.count()) {
      await start.click();
      await emp.waitForTimeout(600);
      await dump(emp, "emp-fill-q1", "main");
    }
  }
  await go(emp, "/hr/rounds", "emp-403");
  await go(emp, "/nope", "emp-404");
  await closeBrowser();
}
