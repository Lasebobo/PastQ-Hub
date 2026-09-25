# Changelog

All notable changes to PastQ-Hub are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Open work lives in [TODO.md](TODO.md).

---

## [Unreleased]

### Vercel deployment — 2026-09-09

- **`api/` is now Vercel Serverless Functions.** The shared handlers moved to
  `lib/ai-handlers.js` and `lib/node-adapter.js`, and `api/` holds four five-line
  routing files (`ocr`, `grade`, `clean-text`, `generate-quizzes`). Vercel turns every
  unprefixed file in `api/` into a public endpoint, so the shared modules could not
  stay there. A third adapter, `lib/vercel-adapter.js`, wraps the same handlers — dev
  middleware, `server.js` and Vercel now all call one implementation.
- **`vercel.json` added.** `maxDuration: 60` because the 10-second default times out
  on Gemini OCR of a full page, and an SPA rewrite that excludes `/api/` so it does not
  swallow the endpoints.
- **Large uploads no longer fail in production.** Vercel caps request bodies at 4.5 MB
  and base64 inflates a file by a third, so a 3.4 MB phone photo exceeded it — while
  working locally, where the dev server has no cap. `src/app/utils/downscale.ts` scales
  images to a 2200 px edge and steps JPEG quality down until they fit, falling back to
  the original bytes if the canvas path fails. Oversized requests now return a 413 that
  explains itself.
- **`DEPLOY-VERCEL.md` added**, including why deployments have been blocked since
  `bb30ad5`: the Vercel project is on a personal Hobby account, which only builds
  commits authored by the account owner. Not a code problem.

Verified: typecheck 0 errors · build passing · rules 48/48 · 16/16 Vercel function
checks (happy path, 405, string body, malformed JSON) · `server.js` and the dev
middleware both still serving all four routes after the move.

### Cleanup — 2026-09-08

- **App source split into a feature tree.** The former monolithic `src/app/App.tsx`
  now delegates to a focused `MainApp` shell, feature screens under
  `src/app/features/`, shared UI under `src/app/components/`, and shared
  data/services/utils/types modules. Firestore question/user/thread rows now have
  explicit shared record types at the app boundary.
- **Cursor affordances normalized.** Native interactive controls now get pointer
  cursors when enabled and not-allowed cursors when disabled; custom click targets keep
  their explicit cursor styles.
- **Forum data model cleaned up.** Threads and selected-thread replies now stream with
  `onSnapshot`; replies are stored under
  `threads/{threadId}/comments/{commentId}` instead of inside the thread document; new
  replies are batched with a `replyCount` increment; thread views increment when a
  thread is opened.
- **Forum attachment controls removed.** Firebase Storage is not configured, so the
  image/PDF buttons were removed rather than implying an upload that never happens.
- **Upload attribution now uses Auth UID.** `UploadView` writes
  `createdBy: auth.currentUser.uid`, matching `firestore.rules` even for older profile
  rows missing an `id` field.
- **Displayed topic frequency has one source of truth.** Reconstructed questions now use
  computed topic counts, matching Trends, instead of showing the stale stored
  `frequency` fallback on cards and paper detail.
- **shadcn stack removed.** Deleted the 46 unused components under
  `src/app/components/ui/` and removed the 39 packages used only by that folder.
  `react` and `react-dom` are now explicit runtime dependencies.
- **PDF export code-split.** `jspdf` is dynamically imported inside `downloadPaper`, so
  PDF-only dependencies no longer sit in the initial app chunk.
- **Rules tests restored and expanded.** Added the missing `firebase.test.json`; the
  emulator suite now covers forum comment subcollections, view/reply counters, and
  tighter thread update permissions: **48/48 passing**.
- **`.DS_Store` untracked.** The ignore rule now applies to the local OS file.

P0 items 1–3 from [TODO.md](TODO.md), plus item 6 pulled forward.

### Fixed

- **The Library and Trends screens now read the database.** `LibraryView` and
  `TrendsView` were being passed the live Firestore paper list but did not declare the
  prop, so it was silently dropped and both fell back to the bundled sample papers.
  Approved uploads never reached the Library. Both now accept `allPqFilesList` and
  shadow it locally, matching the existing `QuizView` idiom.
- **Removed a crash waiting in `TrendsView`.** It looked up a hardcoded paper id with
  a non-null assertion (`.find(…)!`), which returns `undefined` against any real
  database and threw on the next line. It now selects the first available paper,
  re-selects when the list changes, and renders an empty state instead.
- **OCR request now matches the server.** The client sent `{ file, filename }` while
  the handler read `{ imageBase64, mimeType }`. Masked until now by the mock response
  returned when `GEMINI_API_KEY` is unset. The client also now strips the
  `data:<mime>;base64,` prefix — Gemini's `inlineData.data` wants raw base64 — and
  derives the real MIME type.
- **OCR no longer hangs on unreadable files.** Added the missing `reader.onerror`, and
  moved `readAsDataURL` to after the handlers are attached.

### Changed

- **Topic frequency is now counted, not read from a stored field.** `TrendsView`
  counts how many times each topic is actually asked across every paper in the
  repository. Pulled forward from item 6 because connecting Trends to real data
  without it would have rendered a flat, meaningless chart — every uploaded question
  stores `frequency: 5`.
- **"Years Covered: 25+" replaced with a real count** of distinct sessions, relabelled
  "Sessions Covered". It was a string literal.
- **Library empty state now distinguishes** "repository is empty" from "search found
  nothing", with different guidance for students and lecturers.
- **"Download" now produces a real PDF**, not a `.txt` file. A4, cover block, per-section
  headings, wrapped text, colour-coded answers and solutions, and "Page n of m" footers.
  Text is folded to Latin-1 first, since jsPDF's built-in fonts would otherwise render
  the em dashes and box-drawing characters in the question data as mojibake.
- **AI grades are clamped to `0..marks`.** The grading endpoint previously passed the
  model's number through unchecked, so a hallucinated score could exceed the marks
  available. Gemini's non-2xx responses now surface as errors instead of silently
  becoming "No text extracted."
- `npm start` added to `package.json`.

### Fixed (housekeeping pass)

- **Forum moderation is real.** "Flagged Posts" was decorative — `flagged` was a state
  array nothing ever filled, the buttons only hid rows locally, and "No flagged posts —
  all clear!" always showed even though nothing in the app could flag anything. Threads
  now carry a Report control; the Admin Panel lists genuinely reported posts and can
  dismiss the report or delete the post, and the stat tile counts them. The fake
  "Ban User" button was removed rather than faked — banning needs enforcement on every
  read, which is a larger design decision.
- **Stale papers after emptying the database.** `allPqFiles` was only rebuilt when the
  fetch returned rows, so the Admin reset (or un-approving everything) left the old
  papers on screen. Now rebuilds unconditionally.
- **Loading state.** `loadingQuestions` was set but never read, so a slow first fetch
  looked identical to an empty repository — "no papers exist" on every page load.
  Screens that read the paper list now show a spinner; Upload and Admin do not wait.
- **Timed quiz interval leak.** Leaving the Quiz mid-countdown left the interval running
  and calling `setStep` on an unmounted component. Cleanup effect added.
- **Forum course tabs** came from the hardcoded sample papers, so a newly uploaded
  course had no forum category. They now follow the live repository, and the hardcoded
  `"CPE 508"` default falls back to a course that exists.
- **README.md** — the unresolved merge conflict markers from `be9d800` are gone, and the
  file now documents dev *and* production, environment variables, layout, and the two
  things to know before deploying.

### Removed

- `science-repository-temp/` — byte-identical duplicate, confirmed with `diff -rq`
  immediately before deletion. Recover with
  `git checkout fdc2476 -- science-repository-temp`. `science-repository/` is kept
  deliberately: everything useful was reimplemented rather than copied, but it remains
  the only record of the earlier implementation in the working tree.
- **14 unused packages** — `@mui/material`, `@mui/icons-material`, `@emotion/react`,
  `@emotion/styled`, `@popperjs/core`, `react-popper`, `canvas-confetti`, `date-fns`,
  `motion`, `react-dnd`, `react-dnd-html5-backend`, `react-responsive-masonry`,
  `react-router`, `react-slick`. Nothing in the repo referenced any of them.
  `node_modules` 666 MB → 450 MB. `tw-animate-css` was on the same list but is kept —
  it is imported from `src/styles/tailwind.css`, which a JavaScript-only scan misses.
- **9 dead symbols** in `App.tsx` — unused `Users`/`Settings` icon imports,
  `FORUM_THREADS`, `MOCK_OCR_CPE508`, two unread `loading` bindings, an unused `label`,
  plus `LibraryView`'s `onStartQuiz` prop and `detectMeta`'s `content` parameter, both
  declared and passed but never used.

### Security

- **Added `firestore.rules` and `firebase.json`.** The project had no rules of its own,
  so the database was open. The new rules deny by default, let a user create only their
  own profile and only as a student, forbid changing your own role, restrict question
  submission to staff with `status: "pending"`, and make approval admin-only.
  **Not deployed** — run `firebase deploy --only firestore:rules` to enforce them.
  The Firebase CLI was not available here, so they are structurally checked and traced
  by hand against every Firestore call in the app, but not compile-checked.
- **Demo credentials no longer ship to production.** The login screen's one-click
  `admin@oau.edu / admin123` button, the "Demo code: OAU_ADMIN_2024" hint on the sign-up
  form, the `OAU_ADMIN_2024` constant itself, and the auto-registration path that
  inferred roles from the email address are all now behind `import.meta.env.DEV`.
  Verified absent from the built bundle; `npm run dev` still has all of them for demos.
- **The sign-up role picker offers Student only in production**, matching what the rules
  permit. Verified: the build folds it to a single-entry array. All three roles remain
  available in development.

### Added

- **A production server (`server.js`).** `vite build` emits static files only, so the
  four AI endpoints simply did not exist in a deployed build — OCR, AI grading, OCR
  cleanup and quiz generation all 404'd while the client calls shipped in the bundle.
  `npm start` now serves `dist/`, the API routes and an SPA fallback, with no
  dependencies beyond Node's own `http` module.
- **`api/handlers.js` — one implementation of the four endpoints.** Both the Vite dev
  middleware and `server.js` call them through `api/node-adapter.js`, so dev and
  production can no longer drift apart. This is the structural fix for the class of bug
  that produced the OCR field-name mismatch. `vite.config.ts` went from 373 to 53 lines.
- **Bookmarks screen.** Saved questions grouped by paper, with expandable answers and
  solutions, an "Open paper" shortcut, and one-tap removal. Bookmarks whose question is
  no longer in the repository (deleted or un-approved) are counted and reported rather
  than silently disappearing.
- **"Manage Roles" card in the Admin Panel.** Lists every registered user with a role
  dropdown, so admins can promote lecturers and admins from inside the app. This is now
  the only way to grant a role, since `firestore.rules` allows self-registration as a
  student only — without it, promoting anyone would mean editing Firestore by hand.
  Updates optimistically and rolls back on failure; an admin cannot change their own
  role, which would lock them out of the screen. The role-count tiles above are now
  derived from the same list, so they no longer go stale after a change.
- **"Seed demo data" button in the Admin Panel.** Publishes the bundled sample papers
  into Firestore with `status: "approved"` and `createdBy: "system"`, so a fresh
  database gives the Library, Quiz and Trends screens something to show. Previously
  nothing wrote the samples to Firestore, so a fresh database produced an empty Quiz
  beside a Library showing four papers. Safe to re-run — it checks for existing seeded
  rows and reports the count instead of duplicating.
- **TypeScript checking** — `tsconfig.json`, `typescript` / `@types/react` /
  `@types/react-dom` as devDependencies, and `npm run typecheck`. Runs under `strict`,
  `noUnusedLocals` and `noUnusedParameters` with **zero errors**. Vite does not
  type-check on build, so nothing previously caught a wrong prop or a bad field name —
  which is how the Library/Trends disconnect survived.
- `TODO.md` — prioritised work list from the 6 Sep 2026 codebase review.
- `CHANGELOG.md` — this file.
- `CLAUDE.md` — project context and known traps for future sessions.
- `.markdownlint.json`, and a `.gitignore` that covers `dist/`, `.env*` and `.DS_Store`.

### Testing

- **Firestore security rules are now verified, not hand-traced.** Added
  `rules-test.mjs` and `npm run test:rules`, which starts the Firestore emulator,
  runs **48 assertions**, and tears it down in one command (exit 0 on pass,
  1 on failure). Coverage:
  - `users` — self-read vs. cross-read, admin read-all, self-registration as
    student/lecturer/admin, self-promotion, promoting others, bookmark writes,
    and the Admin Panel's Manage Roles path.
  - `questions` — approved vs. pending visibility per role, lecturer submission,
    self-approval, author forgery, student submission, admin seeding and approval.
  - `threads` — read gating, authorship forgery, likes, view/reply counters, the
    Report flow, title/content hijacking, authorship theft, and delete permissions per
    role.
  - `threads/{threadId}/comments` — comment reads, author forgery, invalid roles,
    likes, immutable text, and delete permissions per role.
  - Unlisted collections are denied by default.

- **The suite was validated by sabotage.** Reintroducing the privilege-escalation
  hole (letting self-registration pick any role) made exactly the two relevant
  assertions fail and the run exit 1; restoring the rules returned it to 34/34.
  A suite that cannot fail proves nothing, so this check matters more than the
  passing run.

- **Two bugs found were in the test, not the rules.** A fixture user was promoted
  mid-run, silently turning every later "student" assertion into a lecturer one;
  and created documents were not cleaned up, so a second run failed with HTTP 409
  and looked like a rules regression. Both fixed — the suite now wipes emulator
  state on start and is idempotent across runs.

- Test host reads `FIRESTORE_EMULATOR_HOST` so it follows whatever port the
  emulator picks, falling back to `firebase.test.json`'s 8098.

### Notes

- Verified with `tsc --noEmit` in strict mode: **zero type errors in `App.tsx`**. The
  only error in `src/` is a pre-existing `TS5097` in `src/main.tsx` (the `./app/App.tsx`
  import needs `allowImportingTsExtensions`). TypeScript was installed with
  `--no-save` for the check only; `package.json` is unchanged. See TODO item 11.
- `dist/` is committed and was rebuilt, so its asset hash changed.
- Verified end to end against a running dev server: all four `/api/*` endpoints answer
  the exact payloads the client sends; the OCR client/server field contract was checked
  against the real source (`imageBase64`, `mimeType` — no missing keys); base64
  prefix-stripping was tested across PNG/JPEG/PDF/no-mime inputs (decoded PNG magic
  bytes confirm valid data); and a seed row was round-tripped through
  `reconstructPQFiles` (10/10 field assertions pass).
- **Still outstanding:** the rules are written but **not deployed**, so nothing is
  enforced yet. Run `firebase deploy --only firestore:rules` to enforce them.
- ⚠️ **Promote your first admin by hand in the Firebase console *before* deploying the
  rules.** Manage Roles is admin-only and self-registration produces students, so
  deploying first with no existing admin locks everyone out.

---

## Review — 2026-09-06

Not a release. Recorded so the findings aren't lost, and so later entries have a
baseline to refer back to.

Full write-up: [Where PastQ-Hub Stands](https://claude.ai/code/artifact/0b02e3a5-2f44-4e1a-83e6-a14bfe35e780)

**Verified state of `main` @ `bb30ad5`:**

- Build passes — 1,618 modules, 964 KB JS (254 KB gzipped), ~1.2 s.
- Committed `dist/` is current: a rebuild reproduces identical asset hashes.
- 10 features audited: **3 working**, **5 need fixing**, **2 not built**.

**Working end to end:** authentication (email/password + Google), the quiz engine
(timer, scoring, model solutions, AI marking), and the discussion forum
(threads, replies, likes).

**Principal finding — the data sources are split.** `LibraryView` and `TrendsView`
are passed the Firestore-backed paper list but do not declare the prop, so they
silently fall back to a hardcoded 4-paper mock. `QuizView` and `RepositoryView`
read the real database. Consequence: an approved upload appears in the Repository
and the Quiz but never in the Library, and a fresh database yields an empty Quiz
beside a Library showing four papers.

**Also found:**

- All four AI endpoints exist only as Vite dev-server middleware, so they 404 in any deployed build.
- The OCR client and server disagree on the payload field name; masked today by a mock fallback.
- Trend "frequency" is a hand-typed constant, not a computed count.
- Bookmarks are written to Firestore but have no screen to read them back.
- No Firestore security rules exist at the repo root; the database is open.
- Admin credentials are printed on the login and sign-up screens, and failed logins silently auto-register with roles guessed from the email address.
- No TypeScript configuration or check step, which is how the above went unnoticed.

---

## 2026-09-05 — `bb30ad5` "Update since last time"

### Added

- `CPE508_Project_Implementation_Summary.pdf` — the project report.

### Changed

- `README.md` — edited, but the merge conflict markers from `be9d800` were left in place and are still present.

---

## 2026-07-10 — `be9d800` "Resolve merge conflict in README.md"

### Fixed

- Attempted resolution of a README conflict between the Figma Make bundle text and
  the `PastQ-Hub` repository README. **The conflict markers were not actually
  removed** — `<<<<<<<`, `=======` and `>>>>>>>` remain at lines 1, 13 and 15.

---

## 2026-07-10 — `fdc2476` "complete first version"

### Added

- The full application in `src/` — React 18, TypeScript, Vite 6, Tailwind 4.
  All screens in a single `src/app/App.tsx`: auth, PQ library, paper viewer,
  quiz engine, forum, upload, trends, repository, admin panel.
- Firebase Authentication and Cloud Firestore integration.
- Four Gemini-backed dev endpoints in `vite.config.ts`: OCR, AI grading, OCR
  cleanup, and automatic MCQ generation.
- 4 mock past-question papers (45 questions), including 35 CPE 508 questions with
  worked EVM and critical-path solutions.
- `science-repository/` — an earlier, separate implementation ("SciQuest AI",
  React 19 + react-router + Express). Not imported by the live app.
- `science-repository-temp/` — a byte-identical duplicate of the above.
- Built output committed to `dist/`.
- 46 shadcn/ui components under `src/app/components/ui/`, none of which are imported.

---

## 2026-07-10 — `e3c1d10` "Initial commit"

### Added

- Repository created with `README.md`.
