/**
 * Storage security-rules test suite.
 *
 * Tests the CRITICAL open risk from ORIGINAL-FILE-FIX.md:
 * Whether firestore.get() against a NAMED Firestore database works from
 * Storage rules in the emulator.
 *
 * Three scenarios are tested:
 *   1. Lecturer/admin can upload a PDF  → ALLOW
 *   2. Student can read/download        → ALLOW
 *   3. Unauthenticated request denied   → DENY
 *
 * Uses the Firebase Storage REST API against the emulator directly, with
 * unsigned JWT tokens (same approach as rules-test.mjs for Firestore).
 *
 * Run:
 *   firebase emulators:exec \
 *     --only firestore,storage,auth \
 *     --project pastq-test \
 *     --config firebase.storage-test.json \
 *     "node storage-rules-test.mjs"
 */

const PROJECT = "pastq-test";
const DB_NAME = "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8098";
const STORAGE_HOST   = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";

const FIRESTORE_BASE = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/${DB_NAME}/documents`;
const STORAGE_BASE   = `http://${STORAGE_HOST}/v0/b/${PROJECT}.appspot.com/o`;

// ── Fake JWT generator (emulator doesn't check signatures) ──────────────────
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (uid, role = "student") => [
  b64({ alg: "none", typ: "JWT" }),
  b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT, sub: uid, user_id: uid,
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 3600,
    email: `${uid}@oau.edu`, email_verified: true,
    role, // Custom claim for Storage rules
    firebase: { identities: {}, sign_in_provider: "password" },
  }),
  "",
].join(".");

const OWNER    = "owner";
const STUDENT  = "student1";
const LECTURER = "lecturer1";
const ADMIN    = "admin1";

// ── Seed Firestore so the Storage rules can look up roles ───────────────────
const enc = v =>
  v === null ? { nullValue: null }
  : typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };

const firestoreDoc = obj => ({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) });

async function firestoreWrite(path, data) {
  return fetch(`${FIRESTORE_BASE}/${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${OWNER}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(firestoreDoc(data)),
  });
}

async function seedFirestore() {
  // Wipe first
  await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/${DB_NAME}/documents`,
    { method: "DELETE", headers: { Authorization: `Bearer ${OWNER}` } }
  );
  await firestoreWrite(`users/${STUDENT}`,  { id: STUDENT,  email: "s@oau.edu", name: "Ada",  role: "student",  bookmarkedQuestions: [] });
  await firestoreWrite(`users/${LECTURER}`, { id: LECTURER, email: "l@oau.edu", name: "Bola", role: "lecturer", bookmarkedQuestions: [] });
  await firestoreWrite(`users/${ADMIN}`,    { id: ADMIN,    email: "a@oau.edu", name: "Chidi",role: "admin",    bookmarkedQuestions: [] });
}

// ── Storage REST helpers ────────────────────────────────────────────────────
// The Storage emulator's REST API accepts:
//   POST  /v0/b/{bucket}/o?name={path}   — upload (multipart)
//   GET   /v0/b/{bucket}/o/{encoded-path}?alt=media  — download/read
// Auth is passed via Bearer token in the Authorization header.

function encPath(p) {
  return encodeURIComponent(p);
}

async function storageUpload(path, authToken) {
  const headers = { "Content-Type": "application/pdf" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(
    `${STORAGE_BASE}?name=${encPath(path)}`,
    { method: "POST", headers, body: "%PDF-1.0 (fake test content)" }
  );
  return { ok: res.ok, status: res.status };
}

async function storageRead(path, authToken) {
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${STORAGE_BASE}/${encPath(path)}?alt=media`, { headers });
  return { ok: res.ok, status: res.status };
}

// ── Test harness ────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];

async function expect(label, want, fn) {
  const { ok, status } = await fn();
  const got = ok ? "ALLOW" : "DENY";
  const good = got === want;
  good ? pass++ : (fail++, failures.push(`${label} — wanted ${want}, got ${got} (HTTP ${status})`));
  console.log(`  ${good ? "✅" : "❌"} ${want.padEnd(5)} ${label}  (HTTP ${status})`);
}

// ── Main ────────────────────────────────────────────────────────────────────
const TEST_PATH = "papers/CPE_508/2022-2023/test_paper.pdf";

async function main() {
  console.log("\n── Seeding Firestore with user roles ───────────────────────────");
  await seedFirestore();
  console.log("  ✔  Firestore seeded (student, lecturer, admin)");

  console.log("\n── Storage upload (write) ──────────────────────────────────────");
  await expect("lecturer can upload a PDF",
    "ALLOW", () => storageUpload(TEST_PATH, token(LECTURER, "lecturer")));
  await expect("admin can upload a PDF",
    "ALLOW", () => storageUpload(TEST_PATH, token(ADMIN, "admin")));
  await expect("student CANNOT upload",
    "DENY",  () => storageUpload(TEST_PATH, token(STUDENT, "student")));
  await expect("unauthenticated CANNOT upload",
    "DENY",  () => storageUpload(TEST_PATH, null));

  console.log("\n── Storage download (read) ─────────────────────────────────────");
  await expect("student can download",
    "ALLOW", () => storageRead(TEST_PATH, token(STUDENT, "student")));
  await expect("lecturer can download",
    "ALLOW", () => storageRead(TEST_PATH, token(LECTURER, "lecturer")));
  await expect("unauthenticated CANNOT download",
    "DENY",  () => storageRead(TEST_PATH, null));

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\n  FAILURES:");
    failures.forEach(f => console.log(`   • ${f}`));
    console.log(`
  ⚠️  If ALL storage tests failed (especially the lecturer-upload ALLOW),
  the named Firestore database firestore.get() is NOT supported by this
  emulator version. Switch to custom claims — see the fallback plan
  in the comment block at the top of storage.rules.
`);
  } else {
    console.log(`
  ✅  All storage rules tests passed. The named-database firestore.get()
  works in this emulator. Safe to deploy with:
    1. firebase deploy --only firestore:rules
    2. firebase deploy --only storage
  (Deploy Firestore rules first — storage rules depend on the users
  collection being locked down.)
`);
  }
  process.exit(fail ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
