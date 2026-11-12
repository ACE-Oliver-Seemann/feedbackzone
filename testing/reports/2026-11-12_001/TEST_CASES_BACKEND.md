# Backend test cases – Agent 1 (session 2026-11-12_001)

Environment: worktree feedback-zona-betest @ 8dfeeb1, http://localhost:3002 (next dev), SQLite betest.db, fresh seed before the run. Harness: qa/run.mjs, qa/run2.mjs, qa/run3.mjs (throwaway); raw results qa/results.json.

Status: PASS / FAIL / BLOCKED / VOID (tester error, superseded). Tests whose expected column starts with "Observation" record behaviour without a pass/fail requirement in mvp.md; they are counted as PASS (executed, recorded) and analysed in BACKEND_REPORT.md under risks.

Areas: A-API, B-DB, C-Auth / C-Authz (authentication / authorization), D-Logic (business logic), E-Sec (security).

| Test ID | Area | Description | Preconditions | Steps | Expected | Actual | Status | Evidence ref |
|---|---|---|---|---|---|---|---|---|
| BE-T001 | C-Auth | Login HR with valid credentials | fresh seed | POST /api/login hr | 200, user.role HR, home /hr/rounds, Set-Cookie fz_session | HTTP 200 {"user":{"id":"cmwdpq6af000gplo470iqvqhw","name":"Hana Personálna","role":"HR","teamId":null},"home":"/hr/rounds"} | PASS | qa/results.json#BE-T001 |
| BE-T002 | C-Auth | Login employee → home '/' | – | POST /api/login adam | 200, role EMPLOYEE, home / | HTTP 200 {"user":{"id":"cmwdpq6c5000lplo4aedxsohq","name":"Adam Vzorový","role":"EMPLOYEE","teamId":"cmwdpq6ba000jplo4qz1il5dx"},"home":"/"} | PASS | qa/results.json#BE-T002 |
| BE-T003 | C-Auth | Login manager → home '/' | – | POST /api/login manazer.alfa | 200, role MANAGER, teamId set | HTTP 200 {"user":{"id":"cmwdpq6aw000hplo4ts9sj5or","name":"Alena Testová","role":"MANAGER","teamId":"cmwdpq6ba000jplo4qz1il5dx"},"home":"/"} | PASS | qa/results.json#BE-T003 |
| BE-T004 | C-Auth | Login response does not leak passwordHash/email | – | inspect login JSON | no passwordHash, no email | HTTP 200 {"user":{"id":"cmwdpq6c5000lplo4aedxsohq","name":"Adam Vzorový","role":"EMPLOYEE","teamId":"cmwdpq6ba000jplo4qz1il5dx"},"home":"/"} | PASS | qa/results.json#BE-T004 |
| BE-T005 | C-Auth | Login email is case/whitespace-insensitive | – | email '  ADAM.Alfa@Example.TEST ' | 200 | HTTP 200 {"user":{"id":"cmwdpq6c5000lplo4aedxsohq","name":"Adam Vzorový","role":"EMPLOYEE","teamId":"cmwdpq6ba000jplo4qz1il5dx"},"home":"/"} | PASS | qa/results.json#BE-T005 |
| BE-T006 | C-Auth | Wrong password → generic 401 | – | adam + 'zle' | 401 invalid_credentials | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T006 |
| BE-T007 | C-Auth | Unknown e-mail → identical generic 401 (no enumeration) | – | nobody@example.test | same body as wrong password | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T007 |
| BE-T008 | C-Auth | Timing: unknown e-mail vs wrong password similar (dummy bcrypt) | – | 5× each, compare mean ms | difference &lt; 60 ms | wrong pw mean 204 ms, unknown mean 155 ms | PASS | qa/results.json#BE-T008 |
| BE-T009 | C-Auth | Wrong password with valid prefix 'Heslo1234' | – | – | 401 | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T009 |
| BE-T010 | C-Auth | Password case-sensitive 'heslo123' | – | – | 401 | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T010 |
| BE-T011 | C-Auth | Login empty object {} | – | – | 401 invalid_credentials (no 500) | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T011 |
| BE-T012 | C-Auth | Login missing password | – | {email} | 401 | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T012 |
| BE-T013 | C-Auth | Login email as number | – | {email:123} | 401, no 500 | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T013 |
| BE-T014 | C-Auth | Login password as object | – | {password:{}} | 401, no 500 | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T014 |
| BE-T015 | C-Auth | Login email as array (type confusion) | – | {email:[adam]} | 401 | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T015 |
| BE-T016 | C-Auth | Login malformed JSON | – | body '{email:' | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T016 |
| BE-T017 | C-Auth | Login JSON array body | – | [] | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T017 |
| BE-T018 | C-Auth | Login JSON null body | – | null | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T018 |
| BE-T019 | C-Auth | Login empty request body | – | no body | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T019 |
| BE-T020 | C-Auth | GET /api/login (wrong method) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T020 |
| BE-T021 | E-Sec | SQL-injection-like e-mail on login | – | email "' OR 1=1 --" | 401, no 500 | HTTP 401 {"error":"invalid_credentials"} | PASS | qa/results.json#BE-T021 |
| BE-T022 | E-Sec | Login with 1 MB password (no DoS / 500) | – | password 1e6 chars | 401 within 3 s | HTTP 401 {"error":"invalid_credentials"} in 201 ms | PASS | qa/results.json#BE-T022 |
| BE-T023 | C-Auth | Session cookie flags | – | inspect Set-Cookie | HttpOnly; SameSite=lax; Path=/; Max-Age=28800 | fz_session=&lt;token>; Path=/; Expires=Thu, 12 Nov 2026 23:38:42 GMT; Max-Age=28800; HttpOnly; SameSite=lax | PASS | qa/results.json#BE-T023 |
| BE-T024 | C-Auth | Secure cookie flag (dev server) | server runs `next dev` | inspect Set-Cookie | Secure absent in dev, set only when NODE_ENV=production (by design) | Secure present: false (dev); code sets secure iff production | PASS | qa/results.json#BE-T024 |
| BE-T025 | C-Auth | GET /api/me with valid session | logged in adam | – | 200 {user:{id,name,role,teamId}} only | HTTP 200 {"user":{"id":"cmwdpq6c5000lplo4aedxsohq","name":"Adam Vzorový","role":"EMPLOYEE","teamId":"cmwdpq6ba000jplo4qz1il5dx"}} keys=id,name,role,teamId | PASS | qa/results.json#BE-T025 |
| BE-T026 | C-Auth | GET /api/me without cookie | – | – | 401 unauthorized | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T026 |
| BE-T027 | C-Auth | Tampered signature | – | flip last char of signature | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T027 |
| BE-T028 | C-Auth | Forged payload (uid of HR) with adam's signature | – | swap payload | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T028 |
| BE-T029 | C-Auth | Unsigned token (payload only) | – | cookie=&lt;payload> | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T029 |
| BE-T030 | C-Auth | Expired token (validly signed, exp in past) | secret from .env | exp = now-60 | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T030 |
| BE-T031 | C-Auth | Token with exp as string | – | exp:'9999999999' | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T031 |
| BE-T032 | C-Auth | Validly signed token for non-existent user | – | uid 'ghost' | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T032 |
| BE-T033 | C-Auth | Token signed with wrong secret | – | HMAC with other key | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T033 |
| BE-T034 | C-Auth | Token with 3 dot-separated parts | – | token + '.x' | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T034 |
| BE-T035 | C-Auth | Garbage cookie value | – | fz_session=%%% | 401, no 500 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T035 |
| BE-T036 | C-Auth | Token with non-JSON payload but valid signature | – | payload='notjson' | 401, no 500 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T036 |
| BE-T037 | C-Auth | Token with uid as object | – | uid:{} | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T037 |
| BE-T038 | C-Auth | Logout clears cookie | cyril logged in | POST /api/logout | 200 {ok:true}, Set-Cookie fz_session=; Max-Age=0 | HTTP 200 {"ok":true} | fz_session=; Path=/; Max-Age=0; HttpOnly; SameSite=lax | PASS | qa/results.json#BE-T038 |
| BE-T039 | C-Auth | Token still valid after logout (server-side revocation) | token captured before logout | GET /api/me with old token | 401 (MVP-01 'Odhlásenie zruší reláciu') | HTTP 200 {"user":{"id":"cmwdpq6cx000pplo461aftd93","name":"Cyril Ukážkový","role":"EMPLOYEE","teamId":"cmwdpq6ba000jplo4qz1il5dx"}} | FAIL | BE-001; qa/results.json#BE-T039 |
| BE-T040 | C-Auth | Logout without session | – | POST /api/logout no cookie | 401 (requires session) | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T040 |
| BE-T041 | C-Auth | GET /api/logout wrong method | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T041 |
| BE-T042 | E-Sec | Login CSRF: text/plain body accepted by /api/login | – | POST with content-type text/plain + JSON body | Observation: accepted → login CSRF possible from a cross-site form | HTTP 200 (text/plain accepted: true) | PASS | qa/results.json#BE-T042 |
| BE-T043 | A-API | HR GET /api/questions | – | – | 200, 17 questions, keys id,text,type,topic | HTTP 200, 16 questions, keys id,text,topic,type â€” VOID: test expectation (17) was wrong; seed defines 16 questions (spec 7.2 minus 'DĂ´vody odchodu'). Re-run as BE-T315 â†’ PASS. | VOID | qa/results.json#BE-T043 |
| BE-T044 | C-Authz | Manager GET /api/questions | – | – | 200 | HTTP 200 | PASS | qa/results.json#BE-T044 |
| BE-T045 | C-Authz | Employee GET /api/questions | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T045 |
| BE-T046 | C-Authz | Anonymous GET /api/questions | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T046 |
| BE-T047 | A-API | POST /api/questions (no such method) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T047 |
| BE-T048 | A-API | HR GET /api/rounds sees seed Beta round | fresh seed | – | 200, 1 round, participation 4/6, awaitingAction true | HTTP 200 {"rounds":[{"id":"cmwdpq6gw0018plo48wn9g1bs","name":"Pulse – vyťaženosť a tím","teamId":"cmwdpq6ei000wplo41pd3i730","teamName":"Tím Beta","status":"CLOSED","closesAt":"2026-11-09T15:38:36.985Z","questionCount":4,"participation":{"responded":4,"teamSize":6},"awaitingAction":true}]} | PASS | qa/results.json#BE-T048 |
| BE-T049 | C-Authz | Manager Alfa GET /api/rounds does not see Beta round | – | – | 200, [] | HTTP 200 {"rounds":[]} | PASS | qa/results.json#BE-T049 |
| BE-T050 | A-API | Manager Beta GET /api/rounds | – | – | Beta round with submitted, participation, awaitingAction | HTTP 200 {"rounds":[{"id":"cmwdpq6gw0018plo48wn9g1bs","name":"Pulse – vyťaženosť a tím","teamId":"cmwdpq6ei000wplo41pd3i730","teamName":"Tím Beta","status":"CLOSED","closesAt":"2026-11-09T15:38:36.985Z","questionCount":4,"submitted":false,"participation":{"responded":4,"teamSize":6},"awaitingAction":true}]} | PASS | qa/results.json#BE-T050 |
| BE-T051 | A-API | Employee Beta (filip) GET /api/rounds hides CLOSED rounds and management fields | – | – | [] (only OPEN rounds) | HTTP 200 {"rounds":[]} | PASS | qa/results.json#BE-T051 |
| BE-T052 | C-Authz | Anonymous GET /api/rounds | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T052 |
| BE-T053 | A-API | Pagination / filtering / sorting parameters | – | GET /api/rounds?page=2&limit=1&sort=name | N/A in MVP – params ignored, full list returned | HTTP 200 {"rounds":[{"id":"cmwdpq6gw0018plo48wn9g1bs","name":"Pulse – vyťaženosť a tím","teamId":"cmwdpq6ei000wplo41pd3i730","teamName":"Tím Beta","status":"CLOSED","closesAt":"2026-11-09T15:38:36.985Z","questionCount":4,"participation":{"responded":4,"teamSize":6},"awaitingAction":true}]} (N/A – not a requirement) | PASS | qa/results.json#BE-T053 |
| BE-T054 | D-Logic | HR creates Alfa round with 4 questions | – | POST /api/rounds | 201 {round:{id}}; DB DRAFT, positions 1..4 | HTTP 201 {"round":{"id":"cmwdpqedj0001pls0b2tnbs2o"}}; DB status=DRAFT, positions=1,2,3,4 | PASS | qa/results.json#BE-T054 |
| BE-T055 | D-Logic | Mass assignment: status OPEN in body ignored | – | POST with status:'OPEN', startsAt | 201 and DB status DRAFT | HTTP 201 {"round":{"id":"cmwdpqei50003pls0yslk4bh4"}}; DB status=DRAFT | PASS | qa/results.json#BE-T055 |
| BE-T056 | D-Logic | Manager Alfa creates round without teamId (defaults own team) | – | – | 201, DB teamId = Alfa | HTTP 201 {"round":{"id":"cmwdpqen00005pls0c75lsgub"}}; teamId ok=true | PASS | qa/results.json#BE-T056 |
| BE-T057 | C-Authz | Manager Alfa creates round for team Beta | – | teamId=Beta | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T057 |
| BE-T058 | C-Authz | Manager Alfa creates round for Beta with invalid body (permission checked first) | – | teamId=Beta, no questions | 403, not 400 with field details | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T058 |
| BE-T059 | C-Authz | Employee creates round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T059 |
| BE-T060 | C-Authz | Anonymous creates round | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T060 |
| BE-T061 | D-Logic | Round with 2 questions | – | – | 400 questionIds too_few | HTTP 400 {"error":"validation_error","fields":{"questionIds":"too_few"}} | PASS | qa/results.json#BE-T061 |
| BE-T062 | D-Logic | Round with 6 questions | – | – | 400 questionIds too_many | HTTP 400 {"error":"validation_error","fields":{"questionIds":"too_many"}} | PASS | qa/results.json#BE-T062 |
| BE-T063 | D-Logic | Round with 0 questions (empty array) | – | – | 400 too_few | HTTP 400 {"error":"validation_error","fields":{"questionIds":"too_few"}} | PASS | qa/results.json#BE-T063 |
| BE-T064 | D-Logic | Round with exactly 3 questions (lower bound) | – | – | 201 | HTTP 201 {"round":{"id":"cmwdpqewz0007pls0bzkwk6rh"}} | PASS | qa/results.json#BE-T064 |
| BE-T065 | D-Logic | Round with exactly 5 questions (upper bound) | – | – | 201 | HTTP 201 {"round":{"id":"cmwdpqeyk0009pls02qkpjuj6"}} | PASS | qa/results.json#BE-T065 |
| BE-T066 | D-Logic | Duplicate question ids | – | [q1,q1,q2] | 400 duplicate | HTTP 400 {"error":"validation_error","fields":{"questionIds":"duplicate"}} | PASS | qa/results.json#BE-T066 |
| BE-T067 | D-Logic | Unknown question id | – | – | 400 unknown | HTTP 400 {"error":"validation_error","fields":{"questionIds":"unknown"}} | PASS | qa/results.json#BE-T067 |
| BE-T068 | A-API | questionIds as string | – | – | 400 invalid | HTTP 400 {"error":"validation_error","fields":{"questionIds":"invalid"}} | PASS | qa/results.json#BE-T068 |
| BE-T069 | A-API | questionIds containing numbers | – | [1,2,3] | 400 invalid | HTTP 400 {"error":"validation_error","fields":{"questionIds":"invalid"}} | PASS | qa/results.json#BE-T069 |
| BE-T070 | A-API | questionIds missing | – | – | 400 invalid | HTTP 400 {"error":"validation_error","fields":{"questionIds":"invalid"}} | PASS | qa/results.json#BE-T070 |
| BE-T071 | D-Logic | Empty name | – | – | 400 name required | HTTP 400 {"error":"validation_error","fields":{"name":"required"}} | PASS | qa/results.json#BE-T071 |
| BE-T072 | D-Logic | Whitespace-only name | – | – | 400 name required | HTTP 400 {"error":"validation_error","fields":{"name":"required"}} | PASS | qa/results.json#BE-T072 |
| BE-T073 | A-API | name as number | – | – | 400 name required | HTTP 400 {"error":"validation_error","fields":{"name":"required"}} | PASS | qa/results.json#BE-T073 |
| BE-T074 | D-Logic | Name 120 chars (boundary) | – | – | 201 | HTTP 201 {"round":{"id":"cmwdpqfa3000bpls0w9womwdn"}} | PASS | qa/results.json#BE-T074 |
| BE-T075 | D-Logic | Name 121 chars | – | – | 400 too_long | HTTP 400 {"error":"validation_error","fields":{"name":"too_long"}} | PASS | qa/results.json#BE-T075 |
| BE-T076 | D-Logic | closesAt yesterday | – | – | 400 in_past | HTTP 400 {"error":"validation_error","fields":{"closesAt":"in_past"}} | PASS | qa/results.json#BE-T076 |
| BE-T077 | D-Logic | closesAt today (end of day) | – | – | 201 | HTTP 201 {"round":{"id":"cmwdpqffg000dpls0pvj36ixo"}} | PASS | qa/results.json#BE-T077 |
| BE-T078 | A-API | closesAt in Slovak format 12.11.2026 | – | – | 400 invalid | HTTP 400 {"error":"validation_error","fields":{"closesAt":"invalid"}} | PASS | qa/results.json#BE-T078 |
| BE-T079 | A-API | closesAt impossible date 2027-02-30 | – | – | 400 invalid | HTTP 400 {"error":"validation_error","fields":{"closesAt":"invalid"}} | PASS | qa/results.json#BE-T079 |
| BE-T080 | A-API | closesAt ISO datetime with time | – | 2027-01-01T10:00:00Z | 400 invalid | HTTP 400 {"error":"validation_error","fields":{"closesAt":"invalid"}} | PASS | qa/results.json#BE-T080 |
| BE-T081 | A-API | closesAt as number (epoch) | – | – | 400 invalid | HTTP 400 {"error":"validation_error","fields":{"closesAt":"invalid"}} | PASS | qa/results.json#BE-T081 |
| BE-T082 | D-Logic | closesAt far future 9999-12-31 | – | – | Observation: accepted (no upper bound in mvp.md) | HTTP 201 {"round":{"id":"cmwdpqfmo000fpls05r41afgj"}} | PASS | qa/results.json#BE-T082 |
| BE-T083 | D-Logic | HR omits teamId | – | – | 400 teamId required | HTTP 400 {"error":"validation_error","fields":{"teamId":"required"}} | PASS | qa/results.json#BE-T083 |
| BE-T084 | D-Logic | HR unknown teamId | – | – | 400 teamId unknown | HTTP 400 {"error":"validation_error","fields":{"teamId":"unknown"}} | PASS | qa/results.json#BE-T084 |
| BE-T085 | C-Authz | Manager unknown teamId (no existence oracle) | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T085 |
| BE-T086 | A-API | Create round malformed JSON | – | – | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T086 |
| BE-T087 | A-API | Multiple validation errors reported together | – | empty name, bad date, 1 question | 400 with fields name, closesAt, questionIds | HTTP 400 {"error":"validation_error","fields":{"name":"required","closesAt":"invalid","questionIds":"too_few"}} | PASS | qa/results.json#BE-T087 |
| BE-T088 | E-Sec | XSS payload in round name stored verbatim, JSON content-type | – | name '&lt;img src=x onerror=alert(1)>' | 201; returned as JSON string (escaping is UI's job) | stored+returned raw, content-type application/json | PASS | qa/results.json#BE-T088 |
| BE-T089 | E-Sec | SQL-injection-like round name stored literally | – | name "x'); DROP TABLE Round;--" | 201, tables intact | HTTP 201 {"round":{"id":"cmwdpqfyt000jpls0uudueo26"}}; Round count 11 | PASS | qa/results.json#BE-T089 |
| BE-T090 | E-Sec | Unicode/emoji round name | – | name 'Kolo 🚀 ľščťžýáíé' | 201, round-trips intact | stored 'Kolo 🚀 ľščťžýáíé 中文' | PASS | qa/results.json#BE-T090 |
| BE-T091 | D-Logic | Close a DRAFT round | rA DRAFT | POST close | 409 invalid_state | HTTP 409 {"error":"invalid_state"} | PASS | qa/results.json#BE-T091 |
| BE-T092 | C-Authz | Manager Beta opens Alfa draft | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T092 |
| BE-T093 | C-Authz | Employee Alfa opens Alfa draft | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T093 |
| BE-T094 | C-Authz | Anonymous open | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T094 |
| BE-T095 | D-Logic | Employee GET draft round of own team | rA DRAFT | GET /api/rounds/:id | 404 (draft not visible) | HTTP 404 {"error":"not_found"} | PASS | qa/results.json#BE-T095 |
| BE-T096 | D-Logic | Employee submits to draft | – | – | 404, nothing stored | HTTP 404 {"error":"not_found"}; participations 0 | PASS | qa/results.json#BE-T096 |
| BE-T097 | D-Logic | Employee list does not show drafts | – | GET /api/rounds adam | no DRAFT rounds | HTTP 200 {"rounds":[]} | PASS | qa/results.json#BE-T097 |
| BE-T098 | D-Logic | Concurrent double open of same draft | – | 2× POST open in parallel | one 200, one 409 | statuses 200,409; DB status OPEN, startsAt set true | PASS | qa/results.json#BE-T098 |
| BE-T099 | D-Logic | Open an already OPEN round | – | – | 409 invalid_state | HTTP 409 {"error":"invalid_state"} | PASS | qa/results.json#BE-T099 |
| BE-T100 | C-Authz | HR open non-existent round | – | – | 404 | HTTP 404 {"error":"not_found"} | PASS | qa/results.json#BE-T100 |
| BE-T101 | C-Authz | Manager open non-existent round | – | – | 403 (no existence oracle) | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T101 |
| BE-T102 | A-API | GET /api/rounds/:id/open (wrong method) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T102 |
| BE-T103 | D-Logic | Edit endpoint for launched round | – | PATCH/PUT /api/rounds/:id | 405 (no editing; MVP-05 'Spustené kolo sa nedá upravovať') | PATCH 405, PUT 405 | PASS | qa/results.json#BE-T103 |
| BE-T104 | A-API | DELETE /api/rounds/:id | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T104 |
| BE-T105 | D-Logic | Open a draft whose deadline has passed | draft r5, closesAt set to past in DB | POST open | 409 deadline_passed | HTTP 409 {"error":"deadline_passed"} | PASS | qa/results.json#BE-T105 |
| BE-T106 | A-API | Employee GET open own-team round | rA OPEN | GET /api/rounds/:id | 200 questions with position+text, submitted false | HTTP 200 {"round":{"id":"cmwdpqedj0001pls0b2tnbs2o","name":"QA hlavné kolo Alfa","teamId":"cmwdpq6ba000jplo4qz1il5dx","status":"OPEN","closesAt":"2026-11-19T22:59:59.999Z","submitted":false,"questions":[{"position":1,"text":"Priority tímu sú mi jasné."},{"position":2,"text":"Viem, čo sa odo mňa tento týždeň … | PASS | qa/results.json#BE-T106 |
| BE-T107 | C-Authz | Employee Beta GET Alfa round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T107 |
| BE-T108 | C-Authz | HR GET round for filling | – | – | 403 (HR does not fill) | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T108 |
| BE-T109 | C-Authz | Manager Beta GET Alfa round for filling | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T109 |
| BE-T110 | C-Authz | GET non-existent round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T110 |
| BE-T111 | A-API | Employee list shows the OPEN round with submitted false | – | – | rA present, submitted false, no participation key | {"id":"cmwdpqedj0001pls0b2tnbs2o","name":"QA hlavné kolo Alfa","teamId":"cmwdpq6ba000jplo4qz1il5dx","teamName":"Tím Alfa","status":"OPEN","closesAt":"2026-11-19T22:59:59.999Z","questionCount":4,"submitted":false} | PASS | qa/results.json#BE-T111 |
| BE-T112 | D-Logic | Answers too short (3 for 4 questions) | – | – | 400 answers invalid, nothing stored | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T112 |
| BE-T113 | D-Logic | Answers too long (5 for 4 questions) | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T113 |
| BE-T114 | D-Logic | Answer value 0 | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T114 |
| BE-T115 | D-Logic | Answer value 6 | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T115 |
| BE-T116 | D-Logic | Answer value -1 | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T116 |
| BE-T117 | A-API | Answer value 3.5 (non-integer) | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T117 |
| BE-T118 | A-API | Answer value as string '3' | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T118 |
| BE-T119 | A-API | Answer value null | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T119 |
| BE-T120 | A-API | Answer value boolean true | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T120 |
| BE-T121 | A-API | answers missing | – | {comment} | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T121 |
| BE-T122 | A-API | answers as object | – | {answers:{0:1,...}} | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T122 |
| BE-T123 | A-API | answers huge array (100 000 items) | – | – | 400, no 500 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}}; participation rows=0 | PASS | qa/results.json#BE-T123 |
| BE-T124 | A-API | comment as number | – | – | 400 comment invalid | HTTP 400 {"error":"validation_error","fields":{"comment":"invalid"}} | PASS | qa/results.json#BE-T124 |
| BE-T125 | D-Logic | comment 1001 chars | – | – | 400 too_long | HTTP 400 {"error":"validation_error","fields":{"comment":"too_long"}} | PASS | qa/results.json#BE-T125 |
| BE-T126 | A-API | Submit malformed JSON | – | – | 400 invalid_json, nothing stored | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T126 |
| BE-T127 | C-Authz | HR submits a response | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T127 |
| BE-T128 | C-Authz | Employee Beta submits to Alfa round (IDOR) | – | – | 403, nothing stored | HTTP 403 {"error":"forbidden"}; rows 0 | PASS | qa/results.json#BE-T128 |
| BE-T129 | C-Authz | Manager Beta submits to Alfa round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T129 |
| BE-T130 | C-Authz | Anonymous submit | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T130 |
| BE-T131 | D-Logic | Valid submit with comment (adam) | rA OPEN | answers [5,4,3,2] + XSS-ish comment | 201 {ok:true}, no response id in body | HTTP 201 {"ok":true} | PASS | qa/results.json#BE-T131 |
| BE-T132 | B-DB | Participation + Response persisted in DB after submit | – | count rows | 1 participation (adam), 1 response with v1..v4 | participations 1, responses 1, values 5,4,3,2, | PASS | qa/results.json#BE-T132 |
| BE-T133 | D-Logic | Second submission by same user | adam already submitted | POST again | 409 already_submitted | HTTP 409 {"error":"already_submitted"} | PASS | qa/results.json#BE-T133 |
| BE-T134 | B-DB | Rollback: rejected 2nd submission leaves no orphan Response | – | count Response rows for rA | still 1 | Response rows 1 | PASS | qa/results.json#BE-T134 |
| BE-T135 | A-API | GET round after submit shows submitted true | – | – | submitted true | detail true, list true | PASS | qa/results.json#BE-T135 |
| BE-T136 | D-Logic | Comment exactly 1000 chars (barbora) | – | – | 201 | HTTP 201 {"ok":true} | PASS | qa/results.json#BE-T136 |
| BE-T137 | D-Logic | Comment null (cyril) | – | – | 201, comment NULL in DB | HTTP 201 {"ok":true} | PASS | qa/results.json#BE-T137 |
| BE-T138 | D-Logic | Whitespace-only comment (dana) normalised to NULL | – | – | 201; stored NULL | HTTP 201 {"ok":true}; NULL comments now 2 | PASS | qa/results.json#BE-T138 |
| BE-T139 | D-Logic | Comment trimmed before storage (emil) | – | – | stored 'Komentár s medzerami' | HTTP 201 {"ok":true}; trimmed rows 1 | PASS | qa/results.json#BE-T139 |
| BE-T140 | C-Authz | Results of OPEN round for manager Alfa | rA OPEN, 5 responses | GET results | 200 status not_closed, participation 5/6, no questions/comments | HTTP 200 {"round":{"id":"cmwdpqedj0001pls0b2tnbs2o","name":"QA hlavné kolo Alfa","teamId":"cmwdpq6ba000jplo4qz1il5dx","teamName":"Tím Alfa","status":"OPEN","closesAt":"2026-11-19T22:59:59.999Z"},"participation":{"responded":5,"teamSize":6},"status":"not_closed"} | PASS | qa/results.json#BE-T140 |
| BE-T141 | C-Authz | Results of OPEN Alfa round for manager Beta | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T141 |
| BE-T142 | D-Logic | Manager closes OPEN round | – | POST close by manager Alfa | 200; DB CLOSED | HTTP 200 {"ok":true}; DB CLOSED | PASS | qa/results.json#BE-T142 |
| BE-T143 | D-Logic | Close already CLOSED round | – | – | 409 | HTTP 409 {"error":"invalid_state"} | PASS | qa/results.json#BE-T143 |
| BE-T144 | D-Logic | Re-open a CLOSED round | – | – | 409 invalid_state | HTTP 409 {"error":"invalid_state"} | PASS | qa/results.json#BE-T144 |
| BE-T145 | D-Logic | Submit to CLOSED round (manager, not yet answered) | – | – | 409 round_closed | HTTP 409 {"error":"round_closed"} | PASS | qa/results.json#BE-T145 |
| BE-T146 | A-API | Employee GET closed round | – | – | 200 status CLOSED, submitted true | {"id":"cmwdpqedj0001pls0b2tnbs2o","name":"QA hlavné kolo Alfa","teamId":"cmwdpq6ba000jplo4qz1il5dx","status":"CLOSED","closesAt":"2026-11-19T22:59:59.999Z","submitted":true,"questions":[{"position":1,"text":"Priority tímu sú mi jasné."},{"position":2,"text":"V… | PASS | qa/results.json#BE-T146 |
| BE-T147 | A-API | Employee list after close hides CLOSED round | – | – | rA absent | HTTP 200 {"rounds":[]} | PASS | qa/results.json#BE-T147 |
| BE-T148 | D-Logic | Results with exactly 5 responses (threshold boundary) – manager Alfa | rA CLOSED, 5 responses | GET results | status ok, 4 questions, comments | {"round":{"id":"cmwdpqedj0001pls0b2tnbs2o","name":"QA hlavné kolo Alfa","teamId":"cmwdpq6ba000jplo4qz1il5dx","teamName":"Tím Alfa","status":"CLOSED","closesAt":"2026-11-19T22:59:59.999Z"},"participation":{"responded":5,"teamSize":6},"status":"ok","responseCount":5,"questions":[{"position":1,"text":"Priority tímu sú mi jasné.","average":3,"distribution":[1,1,1,1,1]},{"position":2,"text":"Viem, čo s… | PASS | qa/results.json#BE-T148 |
| BE-T149 | D-Logic | Averages correct | – | compare with submitted values | q1 3, q2 3.2, q3 3, q4 3 | expected 3,3.2,3,3 got 3,3.2,3,3 | PASS | qa/results.json#BE-T149 |
| BE-T150 | D-Logic | Distribution correct and sums to responseCount | – | – | per question counts of 1..5 | 1/1/1/1/1 | 1/1/0/2/1 | 1/1/1/1/1 | 1/1/1/1/1 | PASS | qa/results.json#BE-T150 |
| BE-T151 | D-Logic | Comments: only non-empty, trimmed, count 3 | – | – | 3 comments incl. 1000-char one; XSS string returned raw | 3 comments: Komentár s medzerami | Komentár A &lt;script>alert('x')&lt;/script> | cccccccccccccccccccccccccccccccccccccccc… | PASS | qa/results.json#BE-T151 |
| BE-T152 | D-Logic | Comments order randomised | – | fetch results 8× | more than one distinct order | 3 distinct orders in 8 calls | PASS | qa/results.json#BE-T152 |
| BE-T153 | E-Sec | NFR-01: results JSON contains no user id, name or e-mail | – | scan JSON for all 13 user ids/names | none present | hits: none | PASS | qa/results.json#BE-T153 |
| BE-T154 | E-Sec | NFR-01: results JSON contains no Response ids | – | compare with DB response ids | none present | response ids leaked: 0 | PASS | qa/results.json#BE-T154 |
| BE-T155 | C-Authz | NFR-03: manager Beta GET results of Alfa round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T155 |
| BE-T156 | C-Authz | Employee GET results of own team round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T156 |
| BE-T157 | C-Authz | Employee Beta GET results of Alfa round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T157 |
| BE-T158 | C-Authz | HR GET results of Alfa round | – | – | 200 ok | HTTP 200 ok | PASS | qa/results.json#BE-T158 |
| BE-T159 | C-Authz | Anonymous GET results | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T159 |
| BE-T160 | C-Authz | HR results of non-existent round | – | – | 404 | HTTP 404 {"error":"not_found"} | PASS | qa/results.json#BE-T160 |
| BE-T161 | C-Authz | Manager results of non-existent round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T161 |
| BE-T162 | D-Logic | NFR-02: seed Beta round with 4 responses – manager Beta | – | – | insufficient_responses, responseCount 4, no questions/comments/distribution | HTTP 200 {"round":{"id":"cmwdpq6gw0018plo48wn9g1bs","name":"Pulse – vyťaženosť a tím","teamId":"cmwdpq6ei000wplo41pd3i730","teamName":"Tím Beta","status":"CLOSED","closesAt":"2026-11-09T15:38:36.985Z"},"participation":{"responded":4,"teamSize":6},"status":"insufficient_responses","responseCount":4} | PASS | qa/results.json#BE-T162 |
| BE-T163 | D-Logic | NFR-02: seed Beta round with 4 responses – HR | – | – | insufficient_responses | HTTP 200 {"round":{"id":"cmwdpq6gw0018plo48wn9g1bs","name":"Pulse – vyťaženosť a tím","teamId":"cmwdpq6ei000wplo41pd3i730","teamName":"Tím Beta","status":"CLOSED","closesAt":"2026-11-09T15:38:36.985Z"},"participation":{"responded":4,"teamSize":6},"status":"insufficient_responses","responseCount":4} | PASS | qa/results.json#BE-T163 |
| BE-T164 | D-Logic | Results of DRAFT round | r3 DRAFT | – | not_closed | HTTP 200 {"round":{"id":"cmwdpqewz0007pls0bzkwk6rh","name":"QA 3 otázky","teamId":"cmwdpq6ba000jplo4qz1il5dx","teamName":"Tím Alfa","status":"DRAFT","closesAt":"2026-11-19T22:59:59.999Z"},"participation":{"responded":0,"teamSize":6},"status":"not_closed"} | PASS | qa/results.json#BE-T164 |
| BE-T165 | A-API | POST /api/rounds/:id/results (wrong method) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T165 |
| BE-T166 | D-Logic | 3-question round: open + 5 submissions with 3 answers | r3 DRAFT | open, adam..emil submit | all 201; DB v4,v5 NULL | statuses 201,201,201,201,201; rows with v4/v5 not null: 0 | PASS | qa/results.json#BE-T166 |
| BE-T167 | D-Logic | 3-question round: 4 answers rejected | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}} | PASS | qa/results.json#BE-T167 |
| BE-T168 | D-Logic | Averages rounded to 2 decimals (3-question round) | r3 closed | close + results | q1 3, q2 3.2, q3 3.2; 3 questions | averages 3,3.2,3.2, comments 0 | PASS | qa/results.json#BE-T168 |
| BE-T169 | D-Logic | NFR-02 boundary: Alfa round with 4 responses (fresh) | new Alfa round | 4 submit, close, results | insufficient_responses, count 4 | HTTP 200 {"round":{"id":"cmwdpqpow000ppls054ixzy3v","name":"QA 4 odpovede","teamId":"cmwdpq6ba000jplo4qz1il5dx","teamName":"Tím Alfa","status":"CLOSED","closesAt":"2026-11-19T22:59:59.999Z"},"participation":{"responded":4,"teamSize":6},"status":"insufficient_responses","responseCount":4} | PASS | qa/results.json#BE-T169 |
| BE-T170 | D-Logic | NFR-02: team summary hides averages of 4-response round | – | GET team summary Alfa as adam | round r4 results.status insufficient_responses, no questions | {"id":"cmwdpqpow000ppls054ixzy3v","name":"QA 4 odpovede","closesAt":"2026-11-19T22:59:59.999Z","participation":{"responded":4,"teamSize":6},"results":{"status":"insufficient_responses"},"actions":[]} | PASS | qa/results.json#BE-T170 |
| BE-T171 | D-Logic | Manager Alfa adds action to closed round | rA CLOSED | POST /api/rounds/:id/actions | 201, status PLANNED default | HTTP 201 {"action":{"id":"cmwdpqsrz000rpls0yslsna87","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"Menej porád","description":"Zrušíme piatkovú poradu.","dueDate":"2026-11-26T22:59:59.999Z","status":"PLANNED"}} | PASS | qa/results.json#BE-T171 |
| BE-T172 | B-DB | Action persisted in DB | – | – | row with same topic/status | {"id":"cmwdpqsrz000rpls0yslsna87","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"Menej porád","description":"Zrušíme piatkovú poradu.","dueDate":"2026-11-26T22:59:59.999Z","status":"PLANNED"} | PASS | qa/results.json#BE-T172 |
| BE-T173 | D-Logic | MVP-15 awaitingAction false after action added | – | GET /api/rounds as HR | rA awaitingAction false; r3 true | rA false, r3 true | PASS | qa/results.json#BE-T173 |
| BE-T174 | D-Logic | Add action to OPEN/DRAFT round | r5 DRAFT | – | 409 round_not_closed | HTTP 409 {"error":"round_not_closed"} | PASS | qa/results.json#BE-T174 |
| BE-T175 | C-Authz | HR adds action | – | – | 403 (matrix: HR nie) | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T175 |
| BE-T176 | C-Authz | Employee adds action | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T176 |
| BE-T177 | C-Authz | Manager Beta adds action to Alfa round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T177 |
| BE-T178 | C-Authz | Manager adds action to non-existent round | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T178 |
| BE-T179 | D-Logic | Action without topic | – | – | 400 topic required | HTTP 400 {"error":"validation_error","fields":{"topic":"required"}} | PASS | qa/results.json#BE-T179 |
| BE-T180 | D-Logic | Action topic 121 chars | – | – | 400 too_long | HTTP 400 {"error":"validation_error","fields":{"topic":"too_long"}} | PASS | qa/results.json#BE-T180 |
| BE-T181 | D-Logic | Action without description | – | – | 400 required | HTTP 400 {"error":"validation_error","fields":{"description":"required"}} | PASS | qa/results.json#BE-T181 |
| BE-T182 | D-Logic | Action description 1001 chars | – | – | 400 too_long | HTTP 400 {"error":"validation_error","fields":{"description":"too_long"}} | PASS | qa/results.json#BE-T182 |
| BE-T183 | A-API | Action dueDate invalid | – | 'zajtra' | 400 dueDate invalid | HTTP 400 {"error":"validation_error","fields":{"dueDate":"invalid"}} | PASS | qa/results.json#BE-T183 |
| BE-T184 | A-API | Action dueDate missing | – | – | 400 dueDate invalid | HTTP 400 {"error":"validation_error","fields":{"dueDate":"invalid"}} | PASS | qa/results.json#BE-T184 |
| BE-T185 | A-API | Action status invalid 'FOO' | – | – | 400 status invalid | HTTP 400 {"error":"validation_error","fields":{"status":"invalid"}} | PASS | qa/results.json#BE-T185 |
| BE-T186 | A-API | Action status lowercase 'done' | – | – | 400 status invalid | HTTP 400 {"error":"validation_error","fields":{"status":"invalid"}} | PASS | qa/results.json#BE-T186 |
| BE-T187 | A-API | Action status null | – | – | 400 status invalid | HTTP 400 {"error":"validation_error","fields":{"status":"invalid"}} | PASS | qa/results.json#BE-T187 |
| BE-T188 | D-Logic | Action created directly as DONE | – | – | 201 status DONE | HTTP 201 {"action":{"id":"cmwdpqtls000tpls0azryle8j","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"Hotový krok","description":"Zrušíme piatkovú poradu.","dueDate":"2026-11-26T22:59:59.999Z","status":"DONE"}} | PASS | qa/results.json#BE-T188 |
| BE-T189 | D-Logic | Action with dueDate in the past | – | dueDate yesterday | Observation: accepted (mvp.md sets no rule) | HTTP 201 {"action":{"id":"cmwdpqtsa000vpls0st7pddh4","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"Spätný krok","description":"Zrušíme piatkovú poradu.","dueDate":"2026-10-13T21:59:59.999Z","status":"PLANNED"}} | PASS | qa/results.json#BE-T189 |
| BE-T190 | E-Sec | XSS payload in action topic stored raw | – | topic '&lt;svg onload=alert(1)>' | 201; JSON returns raw string | HTTP 201 {"action":{"id":"cmwdpqtuc000xpls07518f0og","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"&lt;svg onload=alert(1)>","description":"Zrušíme piatkovú poradu.","dueDate":"2026-11-26T22:59:59.999Z","status":"PLANNED"}} | PASS | qa/results.json#BE-T190 |
| BE-T191 | A-API | Action malformed JSON | – | – | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T191 |
| BE-T192 | A-API | GET /api/rounds/:id/actions (no handler) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T192 |
| BE-T193 | D-Logic | PATCH action status → IN_PROGRESS | – | – | 200, DB updated | HTTP 200 {"action":{"id":"cmwdpqsrz000rpls0yslsna87","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"Menej porád","description":"Zrušíme piatkovú poradu.","dueDate":"2026-11-26T22:59:59.999Z","status":"IN_PROGRESS"}}; DB IN_PROGRESS | PASS | qa/results.json#BE-T193 |
| BE-T194 | D-Logic | PATCH action back to PLANNED (any transition allowed) | – | – | 200 | HTTP 200 {"action":{"id":"cmwdpqsrz000rpls0yslsna87","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"Menej porád","description":"Zrušíme piatkovú poradu.","dueDate":"2026-11-26T22:59:59.999Z","status":"PLANNED"}} | PASS | qa/results.json#BE-T194 |
| BE-T195 | D-Logic | PATCH ignores other fields (topic, roundId) | – | {status:'DONE', topic:'hack', roundId:r3} | 200, topic and roundId unchanged | DB topic 'Menej porád', round ok true | PASS | qa/results.json#BE-T195 |
| BE-T196 | A-API | PATCH invalid status | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"status":"invalid"}} | PASS | qa/results.json#BE-T196 |
| BE-T197 | A-API | PATCH empty body {} | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"status":"invalid"}} | PASS | qa/results.json#BE-T197 |
| BE-T198 | A-API | PATCH malformed JSON | – | – | 400 | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T198 |
| BE-T199 | C-Authz | PATCH action by manager Beta (IDOR) | – | – | 403, DB unchanged | HTTP 403 {"error":"forbidden"}; DB DONE | PASS | qa/results.json#BE-T199 |
| BE-T200 | C-Authz | PATCH action by HR | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T200 |
| BE-T201 | C-Authz | PATCH action by employee of same team | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T201 |
| BE-T202 | C-Authz | PATCH non-existent action | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T202 |
| BE-T203 | C-Authz | PATCH action anonymous | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T203 |
| BE-T204 | A-API | GET /api/actions/:id (no handler) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T204 |
| BE-T205 | A-API | DELETE /api/actions/:id | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T205 |
| BE-T206 | A-API | Employee GET own team summary | rA, r3, r4 closed | GET /api/teams/:alfa/summary | 200 team, rounds, kudos | {"team":{"id":"cmwdpq6ba000jplo4qz1il5dx","name":"Tím Alfa"},"rounds":[{"id":"cmwdpqedj0001pls0b2tnbs2o","name":"QA hlavné kolo Alfa","closesAt":"2026-11-19T22:59:59.999Z","participation":{"responded":5,"teamSize":6},"results":{"status":"ok","questions":[{"position":1,"text":"Priority tímu sú mi jas… | PASS | qa/results.json#BE-T206 |
| BE-T207 | D-Logic | Team summary shows only CLOSED rounds | – | – | rA, r3, r4 present; open/draft absent | 3 rounds | PASS | qa/results.json#BE-T207 |
| BE-T208 | E-Sec | Team summary never contains comments or distributions | – | – | no 'comments', 'distribution', comment text | contains comments key: false, distribution: false | PASS | qa/results.json#BE-T208 |
| BE-T209 | D-Logic | Team summary averages match results endpoint | – | – | same averages for rA | 3,3.2,3,3 vs 3,3.2,3,3 | PASS | qa/results.json#BE-T209 |
| BE-T210 | D-Logic | Team summary includes actions with statuses | – | – | rA has ≥4 actions incl. DONE | Spätný krok:PLANNED; Menej porád:DONE; Hotový krok:DONE; &lt;svg onload=alert(1)>:PLANNED | PASS | qa/results.json#BE-T210 |
| BE-T211 | D-Logic | Team summary rounds newest first | – | – | closesAt desc | 2026-11-19T22:59:59.999Z, 2026-11-19T22:59:59.999Z, 2026-11-19T22:59:59.999Z | PASS | qa/results.json#BE-T211 |
| BE-T212 | C-Authz | Employee Alfa GET Beta team summary | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T212 |
| BE-T213 | C-Authz | Manager Beta GET Alfa team summary | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T213 |
| BE-T214 | C-Authz | Manager Alfa GET own team summary | – | – | 200 | HTTP 200 | PASS | qa/results.json#BE-T214 |
| BE-T215 | C-Authz | HR GET Alfa and Beta summary | – | – | 200 both | 200/200 | PASS | qa/results.json#BE-T215 |
| BE-T216 | C-Authz | HR GET non-existent team summary | – | – | 404 | HTTP 404 {"error":"not_found"} | PASS | qa/results.json#BE-T216 |
| BE-T217 | C-Authz | Employee GET non-existent team summary | – | – | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T217 |
| BE-T218 | C-Authz | Anonymous team summary | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T218 |
| BE-T219 | D-Logic | Beta summary: seed round below threshold | – | HR GET beta summary | insufficient_responses, participation 4/6 | {"id":"cmwdpq6gw0018plo48wn9g1bs","name":"Pulse – vyťaženosť a tím","closesAt":"2026-11-09T15:38:36.985Z","participation":{"responded":4,"teamSize":6},"results":{"status":"insufficient_responses"},"actions":[]} | PASS | qa/results.json#BE-T219 |
| BE-T220 | E-Sec | Path traversal / SQLi-like team id | – | id "..%2F..%2Fx" and "' OR '1'='1" | 403 for employee, no 500 | 403/403/HR 404 | PASS | qa/results.json#BE-T220 |
| BE-T221 | E-Sec | SQLi-like round id on results (HR) | – | – | 404, no 500 | HTTP 404 {"error":"not_found"} | PASS | qa/results.json#BE-T221 |
| BE-T222 | E-Sec | Malformed percent-encoding in path | – | /api/rounds/%E0%A4%A/results | 4xx, no stack trace | HTTP 400 &lt;!DOCTYPE html>&lt;html>&lt;head>&lt;meta charSet="utf-8" data-next-head=""/>&lt;meta name="viewport" content="width=device-width" data-next-head=""/>&lt;title data-next-head="">400: Bad Request&lt;/title>&lt;style data-next-hide-fouc="true">body{display:none}&lt;/style>&lt;noscript data-next-hide-fouc="true">&lt;style>body{disp… | PASS | qa/results.json#BE-T222 |
| BE-T223 | D-Logic | Send public kudos adam → barbora | – | – | 201, fromName Adam, toName Barbora | HTTP 201 {"kudos":{"id":"cmwdpqyxj000zpls0xqmd4n01","fromName":"Adam Vzorový","toName":"Barbora Skúšobná","text":"Ďakujem za pomoc s nasadením!","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:13.879Z"}} | PASS | qa/results.json#BE-T223 |
| BE-T224 | B-DB | Kudos persisted with fromUserId/toUserId | – | – | DB row matches | {"id":"cmwdpqyxj000zpls0xqmd4n01","fromUserId":"cmwdpq6c5000lplo4aedxsohq","toUserId":"cmwdpq6cj000nplo4uvv7dpqs","text":"Ďakujem za pomoc s nasadením!","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:13.879Z"} | PASS | qa/results.json#BE-T224 |
| BE-T225 | D-Logic | Self-kudos | – | toUserId = own id | 400 toUserId self | HTTP 400 {"error":"validation_error","fields":{"toUserId":"self"}} | PASS | qa/results.json#BE-T225 |
| BE-T226 | D-Logic | Kudos text 19 chars | – | – | 400 too_short | HTTP 400 {"error":"validation_error","fields":{"text":"too_short"}} | PASS | qa/results.json#BE-T226 |
| BE-T227 | D-Logic | Kudos text 20 chars (boundary) | – | – | 201 | HTTP 201 {"kudos":{"id":"cmwdpqz2p0011pls0jnbl8y39","fromName":"Adam Vzorový","toName":"Barbora Skúšobná","text":"xxxxxxxxxxxxxxxxxxxx","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:14.066Z"}} | PASS | qa/results.json#BE-T227 |
| BE-T228 | D-Logic | Kudos text 500 chars (boundary) | – | – | 201 | HTTP 201 | PASS | qa/results.json#BE-T228 |
| BE-T229 | D-Logic | Kudos text 501 chars | – | – | 400 too_long | HTTP 400 {"error":"validation_error","fields":{"text":"too_long"}} | PASS | qa/results.json#BE-T229 |
| BE-T230 | D-Logic | Kudos 19 chars padded with spaces to 30 | – | – | 400 too_short (trim) | HTTP 400 {"error":"validation_error","fields":{"text":"too_short"}} | PASS | qa/results.json#BE-T230 |
| BE-T231 | D-Logic | Kudos 20 zero-width spaces (visually empty) | – | text '\u200B'×20 | 400 (visually empty text must not pass the 20-char minimum) | HTTP 201 {"kudos":{"id":"cmwdpqzec0015pls06wvessvj","fromName":"Adam Vzorový","toName":"Barbora Skúšobná","text":"​​​​​​​​​​​​​​​​​​​​","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:14.484Z"}} | FAIL | BE-003; qa/results.json#BE-T231 |
| BE-T232 | D-Logic | Kudos 10 emoji (10 characters) vs 20-char minimum | – | text '👍'×10 | 400 too_short (10 characters &lt; 20) | HTTP 201 {"kudos":{"id":"cmwdpqzj10017pls01qrcjcfs","fromName":"Adam Vzorový","toName":"Barbora Skúšobná","text":"👍👍👍👍👍👍👍👍👍👍","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:14.653Z"}} | FAIL | BE-002; qa/results.json#BE-T232 |
| BE-T233 | D-Logic | Kudos 260 emoji (260 characters) vs 500-char maximum | – | text '👍'×260 | 201 (260 characters ≤ 500) | HTTP 400 {"error":"validation_error","fields":{"text":"too_long"}} | FAIL | BE-002; qa/results.json#BE-T233 |
| BE-T234 | A-API | Kudos text missing | – | – | 400 too_short | HTTP 400 {"error":"validation_error","fields":{"text":"too_short"}} | PASS | qa/results.json#BE-T234 |
| BE-T235 | A-API | Kudos text as number | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"text":"too_short"}} | PASS | qa/results.json#BE-T235 |
| BE-T236 | A-API | Kudos invalid value | – | 'TEAMWORK' | 400 value invalid | HTTP 400 {"error":"validation_error","fields":{"value":"invalid"}} | PASS | qa/results.json#BE-T236 |
| BE-T237 | A-API | Kudos value lowercase | – | 'helping' | 400 | HTTP 400 {"error":"validation_error","fields":{"value":"invalid"}} | PASS | qa/results.json#BE-T237 |
| BE-T238 | A-API | Kudos all 5 values accepted | – | COLLABORATION, QUALITY, HELPING, INNOVATION, CUSTOMER | 5× 201 | 201,201,201,201,201 | PASS | qa/results.json#BE-T238 |
| BE-T239 | A-API | Kudos invalid visibility 'PUBLIC' | – | – | 400 visibility invalid | HTTP 400 {"error":"validation_error","fields":{"visibility":"invalid"}} | PASS | qa/results.json#BE-T239 |
| BE-T240 | A-API | Kudos missing visibility | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"visibility":"invalid"}} | PASS | qa/results.json#BE-T240 |
| BE-T241 | A-API | Kudos unknown recipient | – | – | 400 toUserId unknown | HTTP 400 {"error":"validation_error","fields":{"toUserId":"unknown"}} | PASS | qa/results.json#BE-T241 |
| BE-T242 | A-API | Kudos toUserId as number | – | – | 400 required | HTTP 400 {"error":"validation_error","fields":{"toUserId":"required"}} | PASS | qa/results.json#BE-T242 |
| BE-T243 | A-API | Kudos missing toUserId | – | – | 400 required | HTTP 400 {"error":"validation_error","fields":{"toUserId":"required"}} | PASS | qa/results.json#BE-T243 |
| BE-T244 | A-API | Kudos all fields invalid at once | – | {} | 400 with toUserId,text,value,visibility | HTTP 400 {"error":"validation_error","fields":{"toUserId":"required","text":"too_short","value":"invalid","visibility":"invalid"}} | PASS | qa/results.json#BE-T244 |
| BE-T245 | A-API | Kudos malformed JSON | – | – | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T245 |
| BE-T246 | C-Authz | Kudos anonymous | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T246 |
| BE-T247 | D-Logic | Mass assignment: fromUserId in kudos body ignored | – | adam sends with fromUserId=HR | fromName = Adam | HTTP 201 {"kudos":{"id":"cmwdpr0nx001jpls080r9u3zg","fromName":"Adam Vzorový","toName":"Barbora Skúšobná","text":"Ďakujem za pomoc s nasadením!","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:16.126Z"}} | PASS | qa/results.json#BE-T247 |
| BE-T248 | D-Logic | Send private kudos emil → dana | – | – | 201 PRIVATE | HTTP 201 {"kudos":{"id":"cmwdpr0px001lpls04t5mye9r","fromName":"Emil Pokusný","toName":"Dana Príkladná","text":"Súkromné poďakovanie pre Danu XYZ","value":"HELPING","visibility":"PRIVATE","createdAt":"2026-11-12T15:39:16.197Z"}} | PASS | qa/results.json#BE-T248 |
| BE-T249 | C-Authz | Private kudos visible to recipient /api/kudos/me | – | dana | contains kPriv | 6 kudos | PASS | qa/results.json#BE-T249 |
| BE-T250 | C-Authz | Private kudos NOT in team feed (employee view) | – | adam summary | absent | present: false | PASS | qa/results.json#BE-T250 |
| BE-T251 | C-Authz | Private kudos NOT visible to manager (summary) | – | manager Alfa | absent | present: false | PASS | qa/results.json#BE-T251 |
| BE-T252 | C-Authz | Private kudos NOT visible to HR (summary) | – | HR | absent | present: false | PASS | qa/results.json#BE-T252 |
| BE-T253 | C-Authz | Private kudos NOT in sender's /api/kudos/me | – | emil | absent | present: false | PASS | qa/results.json#BE-T253 |
| BE-T254 | C-Authz | Private kudos NOT in manager's or HR's /api/kudos/me | – | – | absent | ma false, hr false | PASS | qa/results.json#BE-T254 |
| BE-T255 | D-Logic | Public kudos appears in recipient team feed, newest first | – | – | feed contains kPub; createdAt desc | 11 kudos in feed | PASS | qa/results.json#BE-T255 |
| BE-T256 | D-Logic | Cross-team public kudos adam(Alfa) → filip(Beta) | – | – | 201; appears in Beta feed, not Alfa feed | beta has true, alfa has false | PASS | qa/results.json#BE-T256 |
| BE-T257 | D-Logic | HR sends kudos | – | – | 201 | HTTP 201 {"kudos":{"id":"cmwdpr1q3001ppls016u45fce","fromName":"Hana Personálna","toName":"Alena Testová","text":"Ďakujem za pomoc s nasadením!","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:17.499Z"}} | PASS | qa/results.json#BE-T257 |
| BE-T258 | D-Logic | Public kudos to HR (no team) | – | adam → HR, TEAM | 201; visible only in HR /kudos/me (no team feed exists for HR) | HTTP 201 {"kudos":{"id":"cmwdpr1v6001rpls08c364fue","fromName":"Adam Vzorový","toName":"Hana Personálna","text":"Vďaka HR za onboarding HRKUDOS","value":"HELPING","visibility":"TEAM","createdAt":"2026-11-12T15:39:17.682Z"}}; in HR /me: true | PASS | qa/results.json#BE-T258 |
| BE-T259 | E-Sec | XSS payload in kudos text stored and returned raw | – | &lt;script>alert(document.cookie)&lt;/script> padding | 201, JSON raw (UI must escape) | stored raw: true | PASS | qa/results.json#BE-T259 |
| BE-T260 | E-Sec | Oversized body 5 MB on /api/kudos | – | text 5 000 000 chars | 400 too_long, server stays up | HTTP 400 {"error":"validation_error","fields":{"text":"too_long"}} in 102 ms; ping 200 | PASS | qa/results.json#BE-T260 |
| BE-T261 | E-Sec | No rate limit on kudos (20 rapid sends) | – | 20× POST /api/kudos | Observation | 20/20 accepted | PASS | qa/results.json#BE-T261 |
| BE-T262 | A-API | GET /api/kudos/me shape | – | barbora | 200, items {id,fromName,toName,text,value,visibility,createdAt} | keys createdAt,fromName,id,text,toName,value,visibility; 7 items | PASS | qa/results.json#BE-T262 |
| BE-T263 | C-Authz | GET /api/kudos/me anonymous | – | – | 401 | HTTP 401 {"error":"unauthorized"} | PASS | qa/results.json#BE-T263 |
| BE-T264 | A-API | GET /api/kudos (no list handler) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T264 |
| BE-T265 | A-API | POST /api/kudos/me (wrong method) | – | – | 405 | HTTP 405 | PASS | qa/results.json#BE-T265 |
| BE-T266 | D-Logic | Concurrent double POST by same user | new open Beta round | 2 parallel submits filip | one 201 + one 409; 1 participation, 1 response | statuses 201,409; participations 1, responses 1 | PASS | qa/results.json#BE-T266 |
| BE-T267 | D-Logic | Concurrent 6× POST by same user | – | 6 parallel submits gabriela | exactly one 201, rest 409; counts +1 | statuses 201,409,409,409,409,409; participations 2, responses 2 | PASS | qa/results.json#BE-T267 |
| BE-T268 | D-Logic | Concurrent submissions by 3 different users | – | hugo, ivana, jakub in parallel | 3× 201; counts 5/5 | statuses 201,201,201; participations 5, responses 5 | PASS | qa/results.json#BE-T268 |
| BE-T269 | D-Logic | Concurrent close + submit race | rC open, manager Beta not yet answered | close and submit in parallel | either submit 201 before close or 409; never stored after CLOSED | close 200, submit 201; participations 6 = responses 6 | PASS | qa/results.json#BE-T269 |
| BE-T270 | D-Logic | Auto-close: OPEN round past deadline closes on first load | open round, closesAt moved to past in DB | GET /api/rounds | status CLOSED | status CLOSED | PASS | qa/results.json#BE-T270 |
| BE-T271 | D-Logic | Submit after deadline | rD auto-closed | barbora submits | 409 round_closed | HTTP 409 {"error":"round_closed"} | PASS | qa/results.json#BE-T271 |
| BE-T272 | D-Logic | Submit after deadline when round still OPEN in DB (endpoint triggers close) | new open round, closesAt past, no reads in between | POST response directly | 409 round_closed | HTTP 409 {"error":"round_closed"} | PASS | qa/results.json#BE-T272 |
| BE-T273 | D-Logic | Manager closes round that already expired | rD auto-closed | POST close | 409 invalid_state | HTTP 409 {"error":"invalid_state"} | PASS | qa/results.json#BE-T273 |
| BE-T274 | B-DB | NFR-01: Response has no user or time column | – | PRAGMA table_info(Response) | id,roundId,teamId,v1..v5,comment only | id,roundId,teamId,v1,v2,v3,v4,v5,comment | PASS | qa/results.json#BE-T274 |
| BE-T275 | B-DB | NFR-01: Participation has only roundId,userId | – | PRAGMA table_info(Participation) | roundId,userId | roundId,userId | PASS | qa/results.json#BE-T275 |
| BE-T276 | B-DB | NFR-01: Response is WITHOUT ROWID | – | SELECT rowid FROM Response | error no such column | no such column: rowid | PASS | qa/results.json#BE-T276 |
| BE-T277 | B-DB | NFR-01: Participation is WITHOUT ROWID | – | SELECT rowid FROM Participation | error | no such column: rowid | PASS | qa/results.json#BE-T277 |
| BE-T278 | B-DB | NFR-01: Response ids are random UUID v4 | – | regex over all ids | all match v4 | 25 ids, sample b44e1ca6-955d-4f86-892c-8564909c6bb1 | PASS | qa/results.json#BE-T278 |
| BE-T279 | B-DB | NFR-01: physical order of Response rows ≠ submission order | rA submitted in order adam..emil with distinct v1 5,4,3,2,1 | SELECT without ORDER BY | order not equal to 5,4,3,2,1 (UUID-ordered); note: 1/120 chance of coincidence | physical order v1 = 1,3,2,4,5 | PASS | qa/results.json#BE-T279 |
| BE-T280 | B-DB | NFR-01: no other table links Response to user (schema scan) | – | list all tables/columns referencing Response | no FK into Response, no audit/log table | tables: _prisma_migrations,User,Team,Question,Round,RoundQuestion,Participation,Response,Action,Kudos; refs into Response: 0 | PASS | qa/results.json#BE-T280 |
| BE-T281 | B-DB | Participation PK blocks duplicate insert at DB level | – | raw INSERT duplicate (adam, rA) | UNIQUE/PK constraint error | rejected: UNIQUE constraint failed | PASS | qa/results.json#BE-T281 |
| BE-T282 | B-DB | DB CHECK: v1 = 6 rejected | – | raw INSERT | CHECK failure | rejected: CHECK constraint failed: Response_v1_range` | PASS | qa/results.json#BE-T282 |
| BE-T283 | B-DB | DB CHECK: v2 = 0 rejected | – | – | CHECK failure | rejected: CHECK constraint failed: Response_v2_range` | PASS | qa/results.json#BE-T283 |
| BE-T284 | B-DB | DB CHECK: v3 = 2.5 rejected | – | – | CHECK failure | rejected: CHECK constraint failed: Response_v3_range` | PASS | qa/results.json#BE-T284 |
| BE-T285 | B-DB | DB CHECK: v4 = 9 rejected | – | – | CHECK failure | rejected: CHECK constraint failed: Response_v4_range` | PASS | qa/results.json#BE-T285 |
| BE-T286 | B-DB | DB CHECK: v5 = 'abc' rejected | – | – | CHECK failure | rejected: CHECK constraint failed: Response_v5_range` | PASS | qa/results.json#BE-T286 |
| BE-T287 | B-DB | DB CHECK: comment 1001 chars rejected | – | – | CHECK failure | rejected: CHECK constraint failed: Response_comment_length` | PASS | qa/results.json#BE-T287 |
| BE-T288 | B-DB | DB NOT NULL: v1 missing rejected | – | – | constraint failure | rejected:  Invalid `prisma.$executeRawUnsafe()` invocation: Raw query failed. Code: `129 | PASS | qa/results.json#BE-T288 |
| BE-T289 | B-DB | DB FK enforced: Response with unknown roundId | – | raw INSERT roundId 'ghost' | FOREIGN KEY failure | rejected: FOREIGN KEY constraint failed | PASS | qa/results.json#BE-T289 |
| BE-T290 | B-DB | DB has no CHECK on Round.status / Action.status / Kudos.value | – | raw UPDATE Round status 'FOO' then revert | Observation: accepted (validation only in app) | accepted by DB (reverted) | PASS | qa/results.json#BE-T290 |
| BE-T291 | B-DB | Consistency: participations == responses for every round | – | GROUP BY roundId | equal for all rounds | 6 rounds, mismatches 0 | PASS | qa/results.json#BE-T291 |
| BE-T292 | B-DB | Consistency: Response.teamId equals Round.teamId | – | join | 0 mismatches | mismatches 0 | PASS | qa/results.json#BE-T292 |
| BE-T293 | B-DB | Orphans: RoundQuestion/Action/Kudos without parent | – | LEFT JOIN checks | 0 orphans | RoundQuestion 0, Action 0, Kudos 0 | PASS | qa/results.json#BE-T293 |
| BE-T294 | B-DB | PRAGMA foreign_key_check / integrity_check | – | – | no violations, 'ok' | fk violations 0, integrity ok | PASS | qa/results.json#BE-T294 |
| BE-T295 | B-DB | Passwords stored as bcrypt hashes | – | SELECT passwordHash | all start with $2 | 13 users, all bcrypt cost 10: true | PASS | qa/results.json#BE-T295 |
| BE-T296 | B-DB | Seed: 2 teams × 6 + 1 HR, 17 questions | – | counts | 13 users, 2 teams, 17 questions | users 13, teams 2, questions 16, team sizes 1,6,6 â€” VOID: expected 17 questions was a tester error; users 13 / teams 2 correct. See BE-T315. | VOID | qa/results.json#BE-T296 |
| BE-T297 | B-DB | Migration status: single init migration applied | – | _prisma_migrations | 1 row, finished | 20261111140553_init | PASS | qa/results.json#BE-T297 |
| BE-T298 | C-Authz | Page /hr/rounds as employee | – | – | 403 | HTTP 403 | PASS | qa/results.json#BE-T298 |
| BE-T299 | C-Authz | Page /hr/rounds anonymous | – | – | redirect to /login | HTTP 307 location /login | PASS | qa/results.json#BE-T299 |
| BE-T300 | C-Authz | Page /rounds/:id/results as manager Beta (Alfa round) | – | – | 403 | HTTP 403 | PASS | qa/results.json#BE-T300 |
| BE-T301 | C-Authz | Page /rounds/:id/results as employee | – | – | 403 | HTTP 403 | PASS | qa/results.json#BE-T301 |
| BE-T302 | C-Authz | Page /team/:beta as employee Alfa | – | – | 403 | HTTP 403 | PASS | qa/results.json#BE-T302 |
| BE-T303 | C-Authz | Page /rounds/new as employee | – | – | 403 | HTTP 403 | PASS | qa/results.json#BE-T303 |
| BE-T304 | C-Authz | Page /rounds/:id/fill as HR | – | – | 403 | HTTP 403 | PASS | qa/results.json#BE-T304 |
| BE-T305 | E-Sec | Results page HTML escapes stored XSS comment | rA comment contains &lt;script>alert('x')&lt;/script> | GET /rounds/:id/results as manager Alfa | no raw &lt;script>alert('x')&lt;/script> in HTML | HTTP 200; raw payload present: false | PASS | qa/results.json#BE-T305 |
| BE-T306 | E-Sec | Team page HTML escapes stored XSS kudos | – | GET /team/:alfa as barbora | no raw &lt;script>alert(document.cookie) | HTTP 200; raw present: false | PASS | qa/results.json#BE-T306 |
| BE-T307 | E-Sec | Error responses carry no stack trace / Prisma message | – | collect error bodies from 10 error requests | only {error, fields?} | 403 {"error":"forbidden"} | 400 {"error":"validation_error","fields":{"name":"required","tea… | 400 {"error":"validation_error","fields":{"toUserId":"required",… | 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T307 |
| BE-T308 | E-Sec | Unknown API route | – | GET /api/nope | 404 without internals | HTTP 404 | PASS | qa/results.json#BE-T308 |
| BE-T309 | E-Sec | Security response headers on API | – | inspect GET /api/me headers | Observation: X-Powered-By, CSP, X-Frame-Options, nosniff | x-powered-by=Next.js; content-security-policy=absent; x-frame-options=absent; x-content-type-options=absent; referrer-policy=absent | PASS | qa/results.json#BE-T309 |
| BE-T310 | E-Sec | Cache-Control on authenticated API JSON | – | GET /api/rounds/:id/results headers | Observation | cache-control=absent | PASS | qa/results.json#BE-T310 |
| BE-T311 | A-API | Body with Content-Type text/plain on submit | – | POST response with text/plain JSON | Observation (accepted? SameSite=Lax blocks cross-site cookie) | HTTP 201 {"ok":true} | PASS | qa/results.json#BE-T311 |
| BE-T312 | A-API | OPTIONS preflight on /api/kudos | – | – | Observation (no CORS headers) | HTTP 204, ACAO=absent | PASS | qa/results.json#BE-T312 |
| BE-T313 | C-Auth | Role taken from DB on each request, not from token | token issued for adam | temporarily change adam's role to MANAGER in DB? (skipped – instead verify token payload carries only uid/exp) | payload keys uid, exp only | payload keys uid,exp | PASS | qa/results.json#BE-T313 |
| BE-T314 | C-Auth | Session TTL 8 h in token | – | exp - now | ≈ 28800 s | exp - now = 28800 | PASS | qa/results.json#BE-T314 |
| BE-T315 | A-API | Question library size per seed (16, 'Dôvody odchodu' intentionally omitted) | – | GET /api/questions as HR | 16 questions | 16 questions | PASS | qa/results.json#BE-T315 |
| BE-T316 | C-Auth | Login timing re-measured (20 interleaved samples) | – | alternate wrong-password / unknown-email | mean difference &lt; 25 ms | wrong password mean 195.8 ms, unknown e-mail mean 200.2 ms | PASS | qa/results.json#BE-T316 |
| BE-T317 | E-Sec | Brute force: 30 wrong passwords in a row – any lockout/throttle? | – | 30× POST /api/login wrong pw, then correct | Observation (mvp.md has no lockout requirement) | 30/30 → 401, no 429; correct login afterwards 200 | PASS | qa/results.json#BE-T317 |
| BE-T318 | D-Logic | 5-question round: submit 5 answers stores v5 | new Alfa round, 5 questions | create, open, adam submits [1,2,3,4,5] | 201; DB v5 = 5 | HTTP 201 {"ok":true}; v5=5 | PASS | qa/results.json#BE-T318 |
| BE-T319 | D-Logic | 5-question round: only 4 answers | – | – | 400 | HTTP 400 {"error":"validation_error","fields":{"answers":"invalid"}} | PASS | qa/results.json#BE-T319 |
| BE-T320 | D-Logic | Comment of 501 emoji (501 characters, 1002 UTF-16 units) | r5 open | cyril submits | 201 (≤ 1 000 characters per MVP-08) | HTTP 400 {"error":"validation_error","fields":{"comment":"too_long"}} | FAIL | BE-002; qa/results.json#BE-T320 |
| BE-T321 | D-Logic | Comment of 1000 Slovak diacritic chars (BMP) | – | dana submits 'ž'×1000 | 201 | HTTP 201 {"ok":true} | PASS | qa/results.json#BE-T321 |
| BE-T322 | D-Logic | Comment with NUL and control characters | – | emil submits 'a\u0000b\u0007c' | 201 or 400, never 500 | HTTP 201 {"ok":true} | PASS | qa/results.json#BE-T322 |
| BE-T323 | D-Logic | Comment with decomposed (NFD) diacritics: 600 'é' as e+U+0301 | – | barbora submits 1200 code units | Observation: counts code units (1200) → 400 although 600 visible characters | HTTP 400 {"error":"validation_error","fields":{"comment":"too_long"}} | PASS | BE-002 (related); qa/results.json#BE-T323 |
| BE-T324 | D-Logic | Round name consisting only of zero-width spaces | – | name '\u200B'×5 | 400 name required (visually empty) | HTTP 201 {"round":{"id":"cmwdpuf9y0039pls08qtmx2l0"}} | FAIL | BE-003; qa/results.json#BE-T324 |
| BE-T325 | D-Logic | Round name of non-breaking spaces only (U+00A0) | – | name '\u00A0'×5 | 400 required (String.trim strips NBSP) | HTTP 400 {"error":"validation_error","fields":{"name":"required"}} | PASS | qa/results.json#BE-T325 |
| BE-T326 | D-Logic | Action topic/description of zero-width spaces only | closed Alfa round | topic '\u200B'×3, description '\u200B'×3 | 400 required | HTTP 201 {"action":{"id":"cmwdpufl0003bpls0t2p2p7pc","roundId":"cmwdpqedj0001pls0b2tnbs2o","topic":"​​​","description":"​​​","dueDate":"2026-11-22T22:59:59.999Z","status":"PLANNED"}} | FAIL | BE-003; qa/results.json#BE-T326 |
| BE-T327 | D-Logic | Comment of zero-width spaces only is stored as a non-empty comment | – | inspect after T for adam? (use filip in Beta – not member) → use r5 manager | stored NULL like whitespace-only | HTTP 201 {"ok":true}; rows with invisible-only comment: 1 | FAIL | BE-003; qa/results.json#BE-T327 |
| BE-T328 | A-API | Deeply nested JSON (100 000 levels) | – | POST /api/kudos '[[[[…' | 400 invalid_json, no 500, server alive | HTTP 400 {"error":"validation_error","fields":{"toUserId":"required","text":"too_short","value":"invalid","visibility":"invalid"}}; ping 200 | PASS | qa/results.json#BE-T328 |
| BE-T329 | A-API | JSON with __proto__ key on PATCH action | – | {"__proto__":{"status":"DONE"}} | 400 status invalid (no prototype pollution) | HTTP 400 {"error":"validation_error","fields":{"status":"invalid"}} | PASS | qa/results.json#BE-T329 |
| BE-T330 | A-API | JSON string primitive body | – | body '"hello"' | 400 invalid_json | HTTP 400 {"error":"invalid_json"} | PASS | qa/results.json#BE-T330 |
| BE-T331 | A-API | UTF-8 BOM before JSON body | – | \uFEFF{...} | Observation | HTTP 200 {"user":{"id":"cmwdpq6c5000lplo4aedxsohq","name":"Adam Vzorový","role":"EMPLOYEE","teamId":"cmwdpq6ba000jplo4qz1il5dx"},"home":"/"} | PASS | qa/results.json#BE-T331 |
| BE-T332 | A-API | HEAD /api/me | – | – | Observation: 200/405 without body, no 500 | HTTP 200 | PASS | qa/results.json#BE-T332 |
| BE-T333 | D-Logic | Kudos text with NUL byte | – | text with \u0000 inside (≥ 20 chars) | 201 or 400, never 500 | HTTP 201 {"kudos":{"id":"cmwdpugjm003fpls01hl5bnyf","fromName":"Adam Vzorový","toName":"Barbora Skúšobná","text":"Vďaka\u0000 za skvelú prácu na projekte","value":"QUALITY","visibility":"TEAM","createdAt":"2026-11-12T15:41:56.675Z"}} | PASS | qa/results.json#BE-T333 |
| BE-T334 | C-Auth | Session picks up role change immediately (role read from DB per request) | adam's token; role changed to HR in DB then reverted | GET /api/questions before/after | 403 before, 200 after, 403 after revert | 403 → 200 → 403 | PASS | qa/results.json#BE-T334 |
| BE-T335 | E-Sec | Manager sees participation count change in real time during OPEN round | r5 open | GET /api/rounds before/after one submit | Observation (allowed by MVP-10 'Otvorené kolo ukazuje iba účasť') | responded 4 â†’ 4: emil had already answered (BE-T322), so the probe submit returned 409 and the count stayed. Real-time count during OPEN is shown in BE-T140 (5/6 before close). Observation only. | PASS | qa/results.json#BE-T335 |
| BE-T336 | C-Authz | HR results of an OPEN round | r5 open | – | not_closed + participation only | HTTP 200 {"round":{"id":"cmwdpuej10037pls0dr8guccn","name":"QA 5q","teamId":"cmwdpq6ba000jplo4qz1il5dx","teamName":"Tím Alfa","status":"OPEN","closesAt":"2026-11-17T22:59:59.999Z"},"participation":{"responded":4,"teamSize":6},"status":"not_closed"} | PASS | qa/results.json#BE-T336 |
| BE-T337 | C-Auth | Login twice yields two independent valid tokens | – | 2 logins adam, logout with first | second token still valid (stateless) | second token after first logout: 200 | PASS | BE-001; qa/results.json#BE-T337 |
| BE-T338 | C-Authz | Employee closes OPEN round of own team | – | POST close as adam | 403 | HTTP 403 {"error":"forbidden"} | PASS | qa/results.json#BE-T338 |
| BE-T339 | C-Authz | Manager Beta closes OPEN Alfa round | – | – | 403, round stays OPEN | HTTP 403 {"error":"forbidden"}; DB OPEN | PASS | qa/results.json#BE-T339 |
| BE-T340 | C-Authz | HR closes OPEN Alfa round | – | – | 200 | HTTP 200 {"ok":true} | PASS | qa/results.json#BE-T340 |
| BE-T341 | D-Logic | Manager sends kudos | – | manazer.alfa â†’ adam | 201 | HTTP 201; kudos created (text appears garbled only because the tester re-saved the script via PowerShell in ANSI – tester artefact, not an app defect). | PASS | qa/results.json#BE-T341 |
| BE-T342 | D-Logic | Draft left past its deadline is stuck (cannot open, close, edit or delete) | draft; closesAt moved to past in DB | open, close, PATCH, DELETE | Observation â€“ no lifecycle exit for an expired draft | open 409 deadline_passed, close 409 invalid_state, PATCH 405, DELETE 405; list status DRAFT | PASS | qa/results.json#BE-T342 |
| BE-T343 | B-DB | NFR-01: server log contains no response body (runtime) | server on :3002 started outside Agent 1 | inspect server stdout | BLOCKED â€“ log stream not accessible; code review: route() logs only method, path, error class; Prisma log: [] | Server process stdout not available to Agent 1. Code inspection of src/lib/errors.ts:route() and src/lib/db.ts (log: []) shows no body logging; no other console.* in src/. | BLOCKED | qa/results.json#BE-T343 |

**Totals:** 343 executed — PASS 332, FAIL 8, BLOCKED 1, VOID 2.

Additionally the existing Vitest suite was run in the worktree: 10 files, 132 tests, all passed (55 s). Not counted above.
