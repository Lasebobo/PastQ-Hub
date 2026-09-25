/**
 * Security-rules test suite, run against the Firestore emulator.
 *
 *   npx firebase emulators:start --only firestore --config firebase.test.json
 *   node rules-test.mjs
 *
 * Talks to the emulator's REST API directly, so it needs no extra dependencies and
 * no peer-version juggling with the app's firebase SDK. The emulator does not verify
 * JWT signatures, so we can mint tokens for a student / lecturer / admin and check
 * what each is actually allowed to do.
 */

const PROJECT = "pastq-test";
// emulators:exec exports FIRESTORE_EMULATOR_HOST; fall back to firebase.test.json's port
const HOST = `http://${process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8098"}`;
const BASE = `${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = uid => [
  b64({ alg: "none", typ: "JWT" }),
  b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT, sub: uid, user_id: uid,
    iat: Math.floor(Date.now() / 1e3), exp: Math.floor(Date.now() / 1e3) + 3600,
    email: `${uid}@oau.edu`, email_verified: true,
    firebase: { identities: {}, sign_in_provider: "password" },
  }),
  "",
].join(".");

// "owner" bypasses rules — used only to plant baseline data.
const OWNER = "owner";

const enc = v =>
  v === null ? { nullValue: null }
  : typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };

const doc = obj => ({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) });

async function req(method, path, { as = OWNER, body, params = "" } = {}) {
  const res = await fetch(`${BASE}/${path}${params}`, {
    method,
    headers: { Authorization: `Bearer ${as}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status };
}

const get    = (path, as)        => req("GET", path, { as });
const del    = (path, as)        => req("DELETE", path, { as });
const update = (path, as, data)  => req("PATCH", path, { as, body: doc(data) });
const create = (path, as, data)  =>
  req("PATCH", path, { as, body: doc(data), params: "?currentDocument.exists=false" });
const list   = (path, as)        => req("GET", path, { as });

// ─── test harness ────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];

async function expect(label, want, fn) {
  const { ok, status } = await fn();
  const got = ok ? "ALLOW" : "DENY";
  const good = got === want;
  good ? pass++ : (fail++, failures.push(`${label} — wanted ${want}, got ${got} (HTTP ${status})`));
  console.log(`  ${good ? "✅" : "❌"} ${want.padEnd(5)} ${label}`);
}

// ─── baseline data (planted as owner, bypassing rules) ───────────────────────
const STUDENT = "student1", LECTURER = "lecturer1", ADMIN = "admin1", OTHER = "student2";
const PROMOTEE = "promoteMe";

const threadData = (overrides = {}) => ({
  courseCode: "CPE 508",
  title: "Thread",
  content: "Body",
  authorId: STUDENT,
  authorName: "Ada",
  createdAt: 1,
  views: 0,
  replyCount: 0,
  likes: [],
  flagged: false,
  ...overrides,
});

const commentData = (overrides = {}) => ({
  authorId: OTHER,
  authorName: "Obi",
  role: "Student",
  content: "Reply",
  createdAt: 1,
  likes: [],
  ...overrides,
});

async function seed() {
  // Wipe first: the suite creates documents, so a second run would otherwise fail with
  // 409 "already exists" and look like a rules failure.
  await fetch(`${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: "DELETE", headers: { Authorization: `Bearer ${OWNER}` },
  });

  await update(`users/${STUDENT}`,  OWNER, { id: STUDENT,  email: "s@oau.edu", name: "Ada",  role: "student",  bookmarkedQuestions: [] });
  await update(`users/${PROMOTEE}`, OWNER, { id: PROMOTEE, email: "p@oau.edu", name: "Pat", role: "student", bookmarkedQuestions: [] });
  await update(`users/${OTHER}`,    OWNER, { id: OTHER,    email: "o@oau.edu", name: "Obi",  role: "student",  bookmarkedQuestions: [] });
  await update(`users/${LECTURER}`, OWNER, { id: LECTURER, email: "l@oau.edu", name: "Bola", role: "lecturer", bookmarkedQuestions: [] });
  await update(`users/${ADMIN}`,    OWNER, { id: ADMIN,    email: "a@oau.edu", name: "Chidi", role: "admin",   bookmarkedQuestions: [] });
  await update("questions/qApproved", OWNER, { courseCode: "CPE 508", status: "approved", questionText: "Q", createdBy: "system" });
  await update("questions/qPending",  OWNER, { courseCode: "CPE 508", status: "pending",  questionText: "Q", createdBy: LECTURER });
  for (const id of ["t1", "tLike", "tReport", "tViews", "tViewJump", "tReplies", "tHijack", "tAuthor", "tContent", "tOther", "tAdminDelete", "tComment"]) {
    await update(`threads/${id}`, OWNER, threadData(id === "tOther" ? { authorId: OTHER, authorName: "Obi" } : {}));
  }
  await update("threads/tComment/comments/c1", OWNER, commentData());
  await update("threads/tComment/comments/cEdit", OWNER, commentData());
  await update("threads/tComment/comments/cOwn", OWNER, commentData({ authorId: STUDENT, authorName: "Ada" }));
  await update("threads/tComment/comments/cAdminDelete", OWNER, commentData());
}

async function main() {
  await seed();

  console.log("\n── users: reading ──────────────────────────────────────────");
  await expect("student reads own profile",             "ALLOW", () => get(`users/${STUDENT}`, token(STUDENT)));
  await expect("student reads ANOTHER user's profile",  "DENY",  () => get(`users/${OTHER}`,   token(STUDENT)));
  await expect("admin reads any profile",               "ALLOW", () => get(`users/${STUDENT}`, token(ADMIN)));
  await expect("signed-out reads a profile",            "DENY",  () => get(`users/${STUDENT}`, "unauth"));

  console.log("\n── users: the privilege-escalation hole ────────────────────");
  await expect("student self-registers as student",     "ALLOW", () => create("users/newStudent", token("newStudent"), { id: "newStudent", email: "n@oau.edu", name: "New", role: "student", bookmarkedQuestions: [] }));
  await expect("student self-registers as ADMIN",       "DENY",  () => create("users/newAdmin",  token("newAdmin"),  { id: "newAdmin",  email: "x@oau.edu", name: "X",   role: "admin",   bookmarkedQuestions: [] }));
  await expect("student self-registers as LECTURER",    "DENY",  () => create("users/newLect",   token("newLect"),   { id: "newLect",   email: "y@oau.edu", name: "Y",   role: "lecturer",bookmarkedQuestions: [] }));
  await expect("student promotes SELF to admin",        "DENY",  () => update(`users/${STUDENT}`, token(STUDENT), { id: STUDENT, email: "s@oau.edu", name: "Ada", role: "admin", bookmarkedQuestions: [] }));
  await expect("student edits own bookmarks",           "ALLOW", () => update(`users/${STUDENT}`, token(STUDENT), { id: STUDENT, email: "s@oau.edu", name: "Ada", role: "student", bookmarkedQuestions: ["q1"] }));
  await expect("student promotes ANOTHER user",         "DENY",  () => update(`users/${OTHER}`,   token(STUDENT), { id: OTHER, email: "o@oau.edu", name: "Obi", role: "admin", bookmarkedQuestions: [] }));
  // Promote a throwaway user, not STUDENT — mutating a shared fixture's role would
  // silently turn every later "student" assertion into a lecturer one.
  await expect("admin promotes a user (Manage Roles)",  "ALLOW", () => update(`users/${PROMOTEE}`, token(ADMIN), { id: PROMOTEE, email: "p@oau.edu", name: "Pat", role: "lecturer", bookmarkedQuestions: [] }));

  console.log("\n── questions ───────────────────────────────────────────────");
  await expect("student reads an approved question",    "ALLOW", () => get("questions/qApproved", token(STUDENT)));
  await expect("student reads a PENDING question",      "DENY",  () => get("questions/qPending",  token(STUDENT)));
  await expect("lecturer reads a pending question",     "ALLOW", () => get("questions/qPending",  token(LECTURER)));
  await expect("lecturer submits as pending (upload)",  "ALLOW", () => create("questions/newQ1", token(LECTURER), { courseCode: "CPE 508", status: "pending", questionText: "Q", createdBy: LECTURER }));
  await expect("lecturer self-approves a submission",   "DENY",  () => create("questions/newQ2", token(LECTURER), { courseCode: "CPE 508", status: "approved", questionText: "Q", createdBy: LECTURER }));
  await expect("lecturer forges another author",        "DENY",  () => create("questions/newQ3", token(LECTURER), { courseCode: "CPE 508", status: "pending", questionText: "Q", createdBy: ADMIN }));
  await expect("student submits a question",            "DENY",  () => create("questions/newQ4", token(STUDENT),  { courseCode: "CPE 508", status: "pending", questionText: "Q", createdBy: STUDENT }));
  await expect("admin seeds approved data (Seed btn)",  "ALLOW", () => create("questions/seeded", token(ADMIN),   { courseCode: "CPE 508", status: "approved", questionText: "Q", createdBy: "system" }));
  await expect("admin approves a pending question",     "ALLOW", () => update("questions/qPending", token(ADMIN), { courseCode: "CPE 508", status: "approved", questionText: "Q", createdBy: LECTURER }));
  await expect("lecturer approves a question",          "DENY",  () => update("questions/qApproved", token(LECTURER), { courseCode: "CPE 508", status: "approved", questionText: "edited", createdBy: "system" }));
  await expect("student deletes a question",            "DENY",  () => del("questions/qApproved", token(STUDENT)));

  console.log("\n── threads (forum) ─────────────────────────────────────────");
  await expect("student reads threads",                 "ALLOW", () => get("threads/t1", token(STUDENT)));
  await expect("signed-out reads threads",              "DENY",  () => get("threads/t1", "unauth"));
  await expect("student creates own thread",            "ALLOW", () => create("threads/t2", token(STUDENT), threadData({ title: "New", content: "B" })));
  await expect("student forges another author",         "DENY",  () => create("threads/t3", token(STUDENT), threadData({ title: "New", content: "B", authorId: ADMIN, authorName: "Chidi" })));
  await expect("student likes a thread",                "ALLOW", () => update("threads/tLike", token(STUDENT), threadData({ likes: [STUDENT] })));
  await expect("student REPORTS a thread (new flow)",   "ALLOW", () => update("threads/tReport", token(OTHER), threadData({ flagged: true, flagReason: "spam", flaggedBy: "Obi", flaggedAt: 2 })));
  await expect("student increments thread views",       "ALLOW", () => update("threads/tViews", token(STUDENT), threadData({ views: 1 })));
  await expect("student jumps thread views",            "DENY",  () => update("threads/tViewJump", token(STUDENT), threadData({ views: 10 })));
  await expect("student increments reply count",        "ALLOW", () => update("threads/tReplies", token(STUDENT), threadData({ replyCount: 1 })));
  await expect("student hijacks a thread's title",      "DENY",  () => update("threads/tHijack", token(OTHER), threadData({ title: "HIJACKED" })));
  await expect("student steals a thread's authorship",  "DENY",  () => update("threads/tAuthor", token(OTHER), threadData({ authorId: OTHER, authorName: "Obi" })));
  await expect("student rewrites thread content",       "DENY",  () => update("threads/tContent", token(OTHER), threadData({ content: "Edited by someone else" })));
  await expect("author deletes own thread",             "ALLOW", () => del("threads/t2", token(STUDENT)));
  await expect("student deletes SOMEONE ELSE's thread", "DENY",  () => del("threads/t1", token(OTHER)));
  await expect("admin deletes any thread (moderation)", "ALLOW", () => del("threads/tAdminDelete", token(ADMIN)));

  console.log("\n── forum comments ──────────────────────────────────────────");
  await expect("student reads comments",                "ALLOW", () => get("threads/tComment/comments/c1", token(STUDENT)));
  await expect("signed-out reads comments",             "DENY",  () => get("threads/tComment/comments/c1", "unauth"));
  await expect("student creates own comment",           "ALLOW", () => create("threads/tComment/comments/cNew", token(STUDENT), commentData({ authorId: STUDENT, authorName: "Ada" })));
  await expect("student forges comment author",         "DENY",  () => create("threads/tComment/comments/cForge", token(STUDENT), commentData({ authorId: ADMIN, authorName: "Chidi" })));
  await expect("student creates invalid role comment",  "DENY",  () => create("threads/tComment/comments/cBadRole", token(STUDENT), commentData({ authorId: STUDENT, authorName: "Ada", role: "admin" })));
  await expect("student likes a comment",               "ALLOW", () => update("threads/tComment/comments/c1", token(STUDENT), commentData({ likes: [STUDENT] })));
  await expect("student rewrites comment text",         "DENY",  () => update("threads/tComment/comments/cEdit", token(STUDENT), commentData({ content: "Edited" })));
  await expect("author deletes own comment",            "ALLOW", () => del("threads/tComment/comments/cOwn", token(STUDENT)));
  await expect("student deletes another comment",       "DENY",  () => del("threads/tComment/comments/cEdit", token(STUDENT)));
  await expect("admin deletes any comment",             "ALLOW", () => del("threads/tComment/comments/cAdminDelete", token(ADMIN)));

  console.log("\n── unknown collections are denied by default ───────────────");
  await expect("write to an unlisted collection",       "DENY",  () => create("secrets/s1", token(ADMIN), { a: "b" }));

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\n  FAILURES:");
    failures.forEach(f => console.log(`   • ${f}`));
  }
  process.exit(fail ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
