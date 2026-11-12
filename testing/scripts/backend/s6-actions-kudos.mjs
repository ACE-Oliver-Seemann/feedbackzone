// Suite 6: actions ("kroky", MVP-13..15) and kudos (MVP-16, MVP-17, IT-06).
import { ctx, dateStr, db, is, keysOf, req, reset, suite, t } from "./lib.mjs";

export default async function run() {
  suite("S6 Actions and kudos", "fresh seed + demo data");
  await reset(true);
  const closed = ctx.round(ctx.teamA, "46. týždeň"); // closed, no action
  const openA = ctx.round(ctx.teamA, "48. týždeň");
  const A = (body, round = closed.id, as = "mA") => req("POST", `/api/rounds/${round}/actions`, { as, body });
  const ok = () => ({ topic: "QA téma", description: "QA opis kroku", dueDate: dateStr(14) });
  const field = (r, f, code) => r.status === 400 && r.json?.fields?.[f] === code;

  await t("ACTION", "round without action is awaitingAction before the first action", "awaitingAction=true in manager's and HR's list (MVP-15)", async () => {
    const m = (await req("GET", "/api/rounds", { as: "mA" })).json.rounds.find((x) => x.id === closed.id);
    const h = (await req("GET", "/api/rounds", { as: "hr" })).json.rounds.find((x) => x.id === closed.id);
    return m.awaitingAction === true && h.awaitingAction === true;
  });
  let created;
  await t("ACTION", "manager adds an action to a closed round", "201 action{id,roundId,topic,description,dueDate,status=PLANNED} (MVP-13)", async () => {
    const r = await A(ok());
    created = r.json.action;
    return r.status === 201 && keysOf(created) === "description,dueDate,id,roundId,status,topic" && created.status === "PLANNED" && created.roundId === closed.id;
  });
  await t("ACTION", "awaitingAction flips to false after the first action", "awaitingAction=false for manager and HR", async () => {
    const m = (await req("GET", "/api/rounds", { as: "mA" })).json.rounds.find((x) => x.id === closed.id);
    const h = (await req("GET", "/api/rounds", { as: "hr" })).json.rounds.find((x) => x.id === closed.id);
    return m.awaitingAction === false && h.awaitingAction === false;
  });
  await t("ACTION", "employee sees the action on the team page", "summary round.actions contains the new action (MVP-14)", async () => {
    const r = await req("GET", `/api/teams/${ctx.teamA}/summary`, { as: "a1" });
    return r.json.rounds.find((x) => x.id === closed.id).actions.some((a) => a.id === created.id && a.status === "PLANNED");
  });
  await t("ACTION", "several actions per round, explicit status at creation", "201 with status DONE; round then has 2 actions", async () => {
    const r = await A({ ...ok(), topic: "QA druhý", status: "DONE" });
    return r.status === 201 && r.json.action.status === "DONE" && (await db.action.count({ where: { roundId: closed.id } })) === 2;
  });
  for (const [label, body, f, code] of [
    ["topic missing", { description: "x", dueDate: dateStr(1) }, "topic", "required"], ["topic whitespace", { ...ok(), topic: "  " }, "topic", "required"], ["topic 121 chars", { ...ok(), topic: "t".repeat(121) }, "topic", "too_long"],
    ["topic number", { ...ok(), topic: 7 }, "topic", "required"], ["description missing", { topic: "x", dueDate: dateStr(1) }, "description", "required"], ["description 1001 chars", { ...ok(), description: "d".repeat(1001) }, "description", "too_long"],
    ["dueDate missing", { topic: "x", description: "y" }, "dueDate", "invalid"], ["dueDate 2027-02-30", { ...ok(), dueDate: "2027-02-30" }, "dueDate", "invalid"], ["dueDate ISO datetime", { ...ok(), dueDate: new Date().toISOString() }, "dueDate", "invalid"],
    ["status unknown", { ...ok(), status: "CANCELLED" }, "status", "invalid"], ["status lower case", { ...ok(), status: "done" }, "status", "invalid"], ["status null", { ...ok(), status: null }, "status", "invalid"], ["status number", { ...ok(), status: 1 }, "status", "invalid"],
  ]) {
    await t("ACTION-VALID", `create action: ${label}`, `400 fields.${f}=${code}`, async () => field(await A(body), f, code));
  }
  await t("ACTION-VALID", "create action: topic 120 and description 1000 chars (upper bounds)", "201", async () => is(await A({ ...ok(), topic: "t".repeat(120), description: "d".repeat(1000) }), 201));
  await t("ACTION-VALID", "create action with a due date in the past", "informational: requirements are silent; record behaviour", async () => {
    const r = await A({ ...ok(), dueDate: "2020-01-01" });
    return { ok: [201, 400].includes(r.status), actual: `${r.status} (past due date accepted: ${r.status === 201})` };
  });
  await t("ACTION-VALID", "create action: HTML/script in topic and description", "201, stored verbatim (escaped by the UI)", async () => {
    const r = await A({ ...ok(), topic: "<b>tučné</b><script>alert(1)</script>", description: '"><img src=x onerror=alert(1)>' });
    return r.status === 201 && r.json.action.topic.includes("<script>");
  });
  await t("ACTION-VALID", "create action: mass assignment roundId (Beta round), id, createdAt", "201; action stays on the URL's round, generated id, createdAt ~ now", async () => {
    const betaRound = ctx.round(ctx.teamB, "44. týždeň");
    const r = await A({ ...ok(), roundId: betaRound.id, id: "qa-action-id", createdAt: "2020-01-01T00:00:00Z" });
    const row = await db.action.findUnique({ where: { id: r.json.action.id } });
    return r.status === 201 && row.roundId === closed.id && row.id !== "qa-action-id" && Math.abs(row.createdAt.getTime() - Date.now()) < 15000 && (await db.action.count({ where: { roundId: betaRound.id } })) === 0;
  });
  await t("ACTION", "add an action to an OPEN round", "409 round_not_closed (MVP-13: 'pri uzavretom kole')", async () => is(await A(ok(), openA.id), 409, "round_not_closed"));
  await t("ACTION", "add an action to an unknown round", "403 (existence not revealed)", async () => is(await A(ok(), "cmnope000000000000000000"), 403));
  await t("ACTION", "manager Beta adds an action to an Alfa round whose id he knows (IDOR)", "403, nothing stored", async () => {
    const before = await db.action.count();
    const r = await A(ok(), closed.id, "mB");
    return r.status === 403 && before === (await db.action.count());
  });
  await t("ACTION", "action body: non-JSON", "400 invalid_json", async () => is(await req("POST", `/api/rounds/${closed.id}/actions`, { as: "mA", raw: "topic=x" }), 400, "invalid_json"));

  const P = (body, id = created.id, as = "mA") => req("PATCH", `/api/actions/${id}`, { as, body });
  for (const s of ["IN_PROGRESS", "DONE", "PLANNED"]) {
    await t("ACTION", `change status to ${s}`, `200 action.status=${s}, persisted`, async () => {
      const r = await P({ status: s });
      return r.status === 200 && r.json.action.status === s && (await db.action.findUnique({ where: { id: created.id } })).status === s;
    });
  }
  for (const [label, body] of [["unknown status", { status: "ARCHIVED" }], ["status missing", {}], ["status null", { status: null }], ["status array", { status: ["DONE"] }], ["status with spaces", { status: " DONE " }]]) {
    await t("ACTION-VALID", `PATCH action: ${label}`, "400 fields.status=invalid", async () => field(await P(body), "status", "invalid"));
  }
  await t("ACTION", "PATCH action: attempt to change topic, description, dueDate, roundId along with status", "200; only status changes", async () => {
    const before = await db.action.findUnique({ where: { id: created.id } });
    const r = await P({ status: "DONE", topic: "ZMENENÉ", description: "ZMENENÉ", dueDate: "2030-01-01", roundId: ctx.round(ctx.teamB, "44. týždeň").id });
    const after = await db.action.findUnique({ where: { id: created.id } });
    return r.status === 200 && after.status === "DONE" && after.topic === before.topic && after.description === before.description && after.roundId === before.roundId && after.dueDate.getTime() === before.dueDate.getTime();
  });
  await t("ACTION", "PATCH unknown action id", "403", async () => is(await P({ status: "DONE" }, "cmnope000000000000000000"), 403));
  await t("ACTION", "manager Beta changes an Alfa action (IDOR)", "403 and status unchanged", async () => {
    const r = await P({ status: "PLANNED" }, created.id, "mB");
    return r.status === 403 && (await db.action.findUnique({ where: { id: created.id } })).status === "DONE";
  });
  await t("ACTION", "DELETE / PUT / GET on /api/actions/:id", "405 (no such operations in the API)", async () => {
    const codes = [];
    for (const m of ["DELETE", "PUT", "GET"]) codes.push((await req(m, `/api/actions/${created.id}`, { as: "mA" })).status);
    return { ok: codes.every((c) => c === 405), actual: `statuses ${codes}` };
  });
  await t("ACTION", "summary action list is sorted by due date", "actions of each round ascending by dueDate", async () => {
    const r = (await req("GET", `/api/teams/${ctx.teamA}/summary`, { as: "mA" })).json;
    return r.rounds.every((x) => x.actions.every((a, i) => i === 0 || Date.parse(x.actions[i - 1].dueDate) <= Date.parse(a.dueDate)));
  });

  // ================= KUDOS =================
  const K = (body, as = "a1") => req("POST", "/api/kudos", { as, body });
  const kb = (o = {}) => ({ toUserId: ctx.users.a2.id, text: "Ďakujem za pomoc s testovaním!", value: "HELPING", visibility: "TEAM", ...o });
  const mine = async (as) => (await req("GET", "/api/kudos/me", { as })).json.kudos;
  const feed = async (teamId, as) => (await req("GET", `/api/teams/${teamId}/summary`, { as })).json.kudos;

  let pub;
  await t("KUDOS", "send public kudos to a team-mate", "201 kudos{id,fromName,toName,text,emoji:null,value,visibility,createdAt}; signed with sender's name (MVP-16)", async () => {
    const r = await K(kb());
    pub = r.json.kudos;
    return r.status === 201 && keysOf(pub) === "createdAt,emoji,fromName,id,text,toName,value,visibility" && pub.fromName === ctx.users.a1.name && pub.toName === ctx.users.a2.name && pub.emoji === null;
  });
  await t("KUDOS", "public kudos appears in the team feed (first) and in recipient's 'my kudos'", "summary.kudos[0].id = new id; recipient's /api/kudos/me contains it (MVP-17)", async () => (await feed(ctx.teamA, "a3"))[0].id === pub.id && (await mine("a2")).some((k) => k.id === pub.id));
  await t("KUDOS", "kudos does not appear in the sender's 'my kudos'", "sender's /api/kudos/me does not contain it (only received)", async () => !(await mine("a1")).some((k) => k.id === pub.id));
  let priv;
  await t("KUDOS", "send private kudos", "201 visibility PRIVATE", async () => { const r = await K(kb({ visibility: "PRIVATE", text: "Súkromné poďakovanie za pomoc QA." })); priv = r.json.kudos; return r.status === 201 && priv.visibility === "PRIVATE"; });
  await t("KUDOS", "private kudos is visible only to the recipient", "in recipient's /api/kudos/me; NOT in team feed for employee, manager, HR (MVP-17)", async () => {
    const inMine = (await mine("a2")).some((k) => k.id === priv.id);
    const leaks = [];
    for (const who of ["a1", "a2", "a3", "mA", "hr"]) if ((await feed(ctx.teamA, who)).some((k) => k.id === priv.id || k.visibility === "PRIVATE")) leaks.push(who);
    for (const who of ["a3", "mA", "hr", "a1"]) if ((await mine(who)).some((k) => k.id === priv.id)) leaks.push("me:" + who);
    return { ok: inMine && leaks.length === 0, actual: `recipient sees it: ${inMine}; leaks: ${leaks.join(",") || "none"}` };
  });
  await t("KUDOS", "team feed contains only TEAM kudos for members of that team, newest first", "all visibility TEAM; sorted by createdAt desc", async () => {
    const f = await feed(ctx.teamA, "hr");
    const names = new Set(Object.values(ctx.users).filter((u) => u.teamId === ctx.teamA).map((u) => u.name));
    return f.every((k) => k.visibility === "TEAM" && names.has(k.toName)) && f.every((k, i) => i === 0 || Date.parse(f[i - 1].createdAt) >= Date.parse(k.createdAt));
  });
  await t("KUDOS", "kudos items carry names only – no user ids or e-mails", "no user id / e-mail in /api/kudos/me and feed", async () => {
    const txt = JSON.stringify(await mine("a2")) + JSON.stringify(await feed(ctx.teamA, "a2"));
    return !Object.values(ctx.users).some((u) => txt.includes(u.id) || txt.includes(u.email));
  });
  await t("KUDOS", "kudos to yourself", "400 fields.toUserId=self (MVP-16)", async () => field(await K(kb({ toUserId: ctx.users.a1.id })), "toUserId", "self"));
  await t("KUDOS", "kudos to unknown user", "400 fields.toUserId=unknown", async () => field(await K(kb({ toUserId: "cmnope000000000000000000" })), "toUserId", "unknown"));
  await t("KUDOS", "toUserId missing / number / array", "400 fields.toUserId=required for each", async () => {
    const rs = [await K(kb({ toUserId: undefined })), await K(kb({ toUserId: 5 })), await K(kb({ toUserId: [ctx.users.a2.id] }))];
    return rs.every((r) => field(r, "toUserId", "required"));
  });
  for (const [label, text, want] of [["19 characters", "x".repeat(19), "too_short"], ["empty", "", "too_short"], ["missing", undefined, "too_short"], ["20 spaces", " ".repeat(20), "too_short"], ["19 chars padded with spaces to 30", "  " + "x".repeat(19) + "         ", "too_short"], ["501 characters", "x".repeat(501), "too_long"], ["number", 12345678901234567890, "invalid"], ["array", ["x".repeat(30)], "invalid"]]) {
    await t("KUDOS-VALID", `text without emoji: ${label}`, `400 fields.text=${want} (MVP-16: 20–500)`, async () => field(await K(kb({ text })), "text", want));
  }
  await t("KUDOS-VALID", "text exactly 20 characters", "201", async () => is(await K(kb({ text: "y".repeat(20) })), 201));
  await t("KUDOS-VALID", "text exactly 500 characters", "201", async () => is(await K(kb({ text: "y".repeat(500) })), 201));
  await t("KUDOS-VALID", "text of 20 zero-width spaces (U+200B), no emoji", "400 too_short – text has no visible content", async () => {
    const r = await K(kb({ text: "​".repeat(20) }));
    return { ok: r.status === 400, actual: `${r.status} (invisible text accepted: ${r.status === 201})` };
  });
  for (const v of [["value unknown", { value: "FUN" }, "value"], ["value Slovak label", { value: "Spolupráca" }, "value"], ["value lower case", { value: "helping" }, "value"], ["value missing", { value: undefined }, "value"], ["visibility unknown", { visibility: "PUBLIC" }, "visibility"], ["visibility missing", { visibility: undefined }, "visibility"], ["visibility lower case", { visibility: "team" }, "visibility"]]) {
    await t("KUDOS-VALID", v[0], `400 fields.${v[2]}=invalid`, async () => field(await K(kb(v[1])), v[2], "invalid"));
  }
  await t("KUDOS-VALID", "all five values are accepted", "201 for COLLABORATION, QUALITY, HELPING, INNOVATION, CUSTOMER", async () => {
    const codes = [];
    for (const value of ["COLLABORATION", "QUALITY", "HELPING", "INNOVATION", "CUSTOMER"]) codes.push((await K(kb({ value, visibility: "PRIVATE" }))).status);
    return { ok: codes.every((c) => c === 201), actual: `statuses ${codes}` };
  });
  // IT-06 emoji
  await t("KUDOS-EMOJI", "emoji only, no text", "201 text '' emoji 👏 (IT-06)", async () => { const r = await K({ toUserId: ctx.users.a2.id, emoji: "👏", value: "QUALITY", visibility: "TEAM" }); return r.status === 201 && r.json.kudos.text === "" && r.json.kudos.emoji === "👏"; });
  await t("KUDOS-EMOJI", "all six emoji of the fixed set are accepted", "201 for each of 👏 🙌 💪 🎉 ❤️ ⭐", async () => {
    const codes = [];
    for (const emoji of ["👏", "🙌", "💪", "🎉", "❤️", "⭐"]) codes.push((await K({ toUserId: ctx.users.a2.id, emoji, value: "QUALITY", visibility: "PRIVATE" })).status);
    return { ok: codes.every((c) => c === 201), actual: `statuses ${codes}` };
  });
  await t("KUDOS-EMOJI", "emoji with a short text (5 chars)", "201 (with emoji text is 0–500)", async () => is(await K(kb({ emoji: "🎉", text: "Super" })), 201));
  await t("KUDOS-EMOJI", "emoji with a 501-character text", "400 fields.text=too_long", async () => field(await K(kb({ emoji: "🎉", text: "x".repeat(501) })), "text", "too_long"));
  for (const [label, emoji] of [["unknown emoji 😀", "😀"], ["two emoji 👏👏", "👏👏"], ["text 'clap'", "clap"], ["number", 1], ["array", ["👏"]], ["object", { e: "👏" }], ["heart without variation selector ❤", "❤"], ["emoji with trailing space", "👏 "]]) {
    await t("KUDOS-EMOJI", `invalid emoji: ${label}`, "400 fields.emoji=invalid (IT-06)", async () => field(await K(kb({ emoji })), "emoji", "invalid"));
  }
  await t("KUDOS-EMOJI", "emoji '' or null with short text falls back to the 20-character rule", "400 fields.text=too_short for both", async () => field(await K(kb({ emoji: "", text: "krátke" })), "text", "too_short") && field(await K(kb({ emoji: null, text: "krátke" })), "text", "too_short"));
  await t("KUDOS-EMOJI", "emoji is shown in the team feed and in 'my kudos'", "item with emoji present in both (IT-06)", async () => (await feed(ctx.teamA, "a3")).some((k) => k.emoji === "👏") && (await mine("a2")).some((k) => k.emoji === "👏"));

  await t("KUDOS", "mass assignment: fromUserId, id, createdAt, fromName", "201; sender is the session user, id generated, createdAt ~ now", async () => {
    const r = await K(kb({ fromUserId: ctx.users.mA.id, fromUser: { connect: { id: ctx.users.mA.id } }, id: "qa-kudos-id", createdAt: "2020-01-01T00:00:00Z", fromName: "Niekto Iný" }));
    const row = await db.kudos.findUnique({ where: { id: r.json.kudos.id } });
    return { ok: r.status === 201 && row.fromUserId === ctx.users.a1.id && row.id !== "qa-kudos-id" && Math.abs(row.createdAt.getTime() - Date.now()) < 15000 && r.json.kudos.fromName === ctx.users.a1.name, actual: `${r.status}; fromUserId is sender: ${row.fromUserId === ctx.users.a1.id}; fromName=${r.json.kudos.fromName}` };
  });
  await t("KUDOS", "cross-team public kudos (Beta employee → Alfa employee)", "201; shown in Alfa's feed, not in Beta's (feed = recipient's team)", async () => {
    const r = await K(kb({ text: "Medzitímové poďakovanie od Bety." }), "b1");
    const id = r.json.kudos.id;
    return r.status === 201 && (await feed(ctx.teamA, "a1")).some((k) => k.id === id) && !(await feed(ctx.teamB, "b1")).some((k) => k.id === id);
  });
  // Updated in session 2026-11-12_002: since the BUG-024 fix a public kudos for a recipient without a team is refused.
  await t("KUDOS", "HR sends kudos; public kudos to HR (no team) is refused, private one is visible only in HR's 'my kudos'", "201 from HR; public to HR 400 visibility=no_team; private to HR 201 and in no team feed (BUG-024 fix)", async () => {
    const a = await K(kb({ text: "Poďakovanie od HR za spoluprácu." }), "hr");
    const b = await K(kb({ toUserId: ctx.users.hr.id, text: "Verejné poďakovanie pre HR tím." }), "a1");
    const c = await K(kb({ toUserId: ctx.users.hr.id, text: "Súkromné poďakovanie pre HR tím.", visibility: "PRIVATE" }), "a1");
    const id = c.json?.kudos?.id;
    const inFeeds = (await feed(ctx.teamA, "hr")).some((k) => k.id === id) || (await feed(ctx.teamB, "hr")).some((k) => k.id === id);
    return { ok: a.status === 201 && b.status === 400 && b.json.fields?.visibility === "no_team" && c.status === 201 && !inFeeds && (await mine("hr")).some((k) => k.id === id), actual: `${a.status}/${b.status} ${b.text}/${c.status}; in a team feed: ${inFeeds}` };
  });
  await t("KUDOS", "text with HTML/script and SQL is stored verbatim", "201; same text returned", async () => {
    const text = `<script>alert('k')</script> '; DELETE FROM "Kudos";-- ok`;
    const r = await K(kb({ text }));
    return r.status === 201 && r.json.kudos.text === text && (await db.kudos.count()) > 5;
  });
  await t("KUDOS", "text is trimmed", "stored without surrounding whitespace", async () => (await K(kb({ text: "   Ďakujem veľmi pekne za všetko.   " }))).json.kudos.text === "Ďakujem veľmi pekne za všetko.");
  await t("KUDOS", "10 kudos sent in parallel", "all 201, 10 rows added", async () => {
    const before = await db.kudos.count();
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => K(kb({ text: `Paralelné kudos číslo ${i} – ďakujem!`, visibility: "PRIVATE" }), i % 2 ? "a3" : "a4")));
    return { ok: rs.every((r) => r.status === 201) && (await db.kudos.count()) === before + 10, actual: `statuses ${rs.map((r) => r.status)}` };
  });
  await t("KUDOS", "GET /api/kudos (no list endpoint) and DELETE /api/kudos/me", "405", async () => (await req("GET", "/api/kudos", { as: "a1" })).status === 405 && (await req("DELETE", "/api/kudos/me", { as: "a1" })).status === 405);
  await t("KUDOS", "/api/kudos/me ignores a userId query parameter (IDOR)", "returns only kudos received by the caller", async () => {
    const r = await req("GET", `/api/kudos/me?userId=${ctx.users.a2.id}&toUserId=${ctx.users.a2.id}`, { as: "a3" });
    return r.status === 200 && r.json.kudos.every((k) => k.toName === ctx.users.a3.name);
  });
}
