# CLAUDE.md

Context for Claude Code working in this repository.

## What this is

**PastQ-Hub** — a past-questions and solutions repository for science-based courses
at Obafemi Awolowo University (OAU), built for **CPE 508 (Computer System Project
Management)**. Students browse past exam papers, take generated quizzes with worked
solutions, see topic-frequency trends, and discuss questions in per-course forums.
Lecturers and admins upload papers (scanned, via OCR) which admins approve before
publication.

Two documents define the intent, and they disagree with each other in places:

- `src/imports/pasted_text/past-questions-repo.md` — the original project brief.
- `CPE508_Project_Implementation_Summary.pdf` — the report submitted for the course.

Neither fully matches the code. See "Claims that don't match the code" below.

## Commands

```bash
npm install
npm run dev      # vite dev server, with /api/* mounted as middleware
npm run build    # vite build → dist/
npm start        # node server.js — serves dist/ + /api/* for production
```

```bash
npm run typecheck   # tsc --noEmit, strict — currently zero errors, keep it that way
npm run test:rules  # boots the Firestore emulator, runs 34 rules assertions, tears down
npm run emulator    # leaves the emulator running, for iterating on firestore.rules
```

`npm run build` does *not* type-check, so run it separately. `test:rules` is the only
test suite — there is no unit-test runner and no linter.

Optional: `GEMINI_API_KEY` in the environment enables the real Gemini calls. Without
it, every AI endpoint returns hardcoded mock responses — which is why several bugs
in that path are invisible in normal use.

## Layout — three codebases, one runs

| Path | Role |
| --- | --- |
| `src/` | **The live app.** Everything below refers to this. |
| `science-repository/` | An earlier, separate implementation ("SciQuest AI", React 19 + react-router + Express). Dead — nothing imports it, nothing builds or typechecks it. |

Everything worth taking from `science-repository/` has been reimplemented rather than
copied (rules, server, Bookmarks, PDF export), so treat it as read-only history. Its
byte-identical twin `science-repository-temp/` was deleted on 6 Sep 2026.

`dist/` is still tracked by git even though `.gitignore` now lists it — run
`git rm -r --cached dist` to untrack it.

## Architecture

- **React 18 + TypeScript + Vite 6 + Tailwind 4.** Firebase Auth + Cloud Firestore.
- **`src/app/App.tsx` is ~2,600 lines and contains every screen.** Views are plain
  functions in one file, switched by a `view` string in `MainApp` — there is no
  router. Expect to navigate it by `grep`, not by file.
- `src/app/lib/firebase.ts` — Firebase init. Note the named database:
  `getFirestore(app, "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793")`.
- `src/app/lib/AuthContext.tsx` — `user` (Firebase) + `profile` (Firestore `users` doc).
- `api/handlers.js` — **the four AI endpoints, written once.** Plain functions taking
  `(body, apiKey)` and returning `{ status, body }`. `api/node-adapter.js` bridges them
  to Node req/res. Both `vite.config.ts` (dev) and `server.js` (production) import that
  adapter, so **change an endpoint here and both get it** — never add a handler to only
  one of them; that is what produced the OCR field-name bug.
- `server.js` — dependency-free production server: `dist/`, the API routes, SPA fallback.
- `src/app/components/ui/` — 46 shadcn components, imported **zero** times. Ignore them.

**Firestore collections:** `users`, `questions`, `threads`.
Questions are stored flat, one document per question, and reassembled into papers
client-side by `reconstructPQFiles`. Its field names
(`questionText`, `solutionText`, …) differ from the in-memory `PQQuestion` type
(`text`, `solution`, …) — match the DB names when writing, the type when reading.

## Traps — read before editing

These have already caused real bugs. `App.tsx` has changed a lot — **treat any line
number here as stale and re-grep.**

1. **`ALL_PQ_FILES` means two different things.** There is a module-level constant of
   that name (the bundled sample papers, near the top of the file), and most screens
   shadow it with `const ALL_PQ_FILES = allPqFilesList;` — the live Firestore list
   passed down from `MainApp`. **Every screen that shows papers now shadows it** —
   `LibraryView`, `QuizView`, `TrendsView`, `RepositoryView`, `BookmarksView` and
   `ForumView`. The module constant survives only as input to the Admin Panel's
   "Seed demo data" button.

   If you add a screen that shows papers, declare the `allPqFilesList` prop and shadow
   it the same way. Library, Trends and Forum each silently fell back to the mock at
   some point because the prop was passed but never declared — and with `strict` +
   `noUnusedParameters` now on, `npm run typecheck` catches exactly that.

2. **Guard `.find()` on the paper list.** `TrendsView` used to do
   `ALL_PQ_FILES.find(p => p.id === selPQ)!` against a hardcoded id, which crashed the
   moment it saw real data. It now selects the first available paper, re-selects via
   `useEffect` when the list changes, and renders an empty state. `QuizView` does the
   same. Any new screen that selects a paper by id needs all three.

3. **A static deploy has no `/api/*`.** `vite build` emits static files only, so
   deploying `dist/` alone silently breaks OCR, AI grading, text cleanup and quiz
   generation — the client calls are in the bundle, the server is not. Deploy with
   `npm start` (`server.js`) on a Node host, not to static hosting.
   *(`firebase.json` deliberately configures Firestore only, for this reason.)*

4. **Mock fallbacks hide broken code paths.** Every AI endpoint returns canned data
   when `GEMINI_API_KEY` is unset, so a broken request still "works" in the UI. That
   is how the OCR field-name mismatch survived (fixed 6 Sep 2026 — the client now
   sends `imageBase64` + `mimeType` and strips the data-URL prefix). **The OCR path
   has still never run against a real key.** The other three endpoints —
   `/api/grade`, `/api/clean-text`, `/api/generate-quizzes` — have not been verified
   against a real key either. Check the payload shapes before trusting them.

5. **The type check does not cover the Firestore boundary.** `npm run typecheck` is
   strict and clean, so a wrong prop or unused symbol is caught now. But: `App.tsx` writes `type: "mcq"` into
   Firestore even though `PQQuestion["type"]` has no such member. The object is built
   inside `.map((item: any) => …)` and handed to `addDoc`, so it is never checked.
   **Anything written to or read from Firestore is effectively untyped** — verify
   those shapes by reading `reconstructPQFiles`, not by trusting the compiler.

6. **Roles are still decided in the browser until the rules are deployed.**
   `firestore.rules` exists at the repo root and closes this properly. It is
   **verified** — `npm run test:rules` runs 34 assertions against the emulator and the
   suite is sabotage-checked, so it genuinely fails when a rule regresses. But it has
   **not been deployed**: until someone runs `firebase deploy --only firestore:rules`
   the database is open and any role check in `src/` is decoration, not security.

   **If you change `firestore.rules`, run `npm run test:rules` before and after.**
   Add an assertion for any new collection — the suite's last test asserts that
   unlisted collections are denied, so a new collection fails closed until you write
   a rule for it.

   The demo shortcuts (one-click `admin@oau.edu` login, the `OAU_ADMIN_2024` hint and
   constant, auto-registration with a role guessed from the email, and the
   lecturer/admin options in the sign-up picker) are all behind `import.meta.env.DEV`.
   They work in `npm run dev` and are stripped from `vite build` — verified against the
   built bundle. **Keep new demo conveniences behind the same flag**, and re-check the
   bundle if you add one: search the built JS for the literal, don't assume.

7. **Deploying the rules changes app behaviour.** Self-registration will only produce
   students, so the sign-up role picker and the admin code stop working by design.
   Lecturers and admins are promoted from the Admin Panel's **Manage Roles** card,
   which is itself admin-only — so **the first admin must be set by hand in the
   Firebase console before the rules are deployed**, or nobody can grant anything.
   Read the header comment in `firestore.rules` before deploying.

## Claims that don't match the code

If asked whether a feature "works", check rather than trusting the report:

- **"Real-time" forum** — uses `getDocs` + manual refetch. No `onSnapshot` anywhere.
- **Forum attachments** — the paperclip selects a file that is never uploaded. Firebase
  Storage is not used anywhere in the app.
- **Trend analysis across years** — *partly fixed 6 Sep 2026.* `TrendsView` now counts
  topic occurrences across every paper in the repository, and the Library's
  "Sessions Covered" tile is a real count. But the stored `frequency` field still
  exists, still defaults to `5` on upload, and is still what `PQCard` and `PQViewer`
  display — so two different numbers are shown for the same idea. Pick one.
- ~~**Bookmarks** — no screen to read them back~~ — fixed 6 Sep 2026, `BookmarksView`.
- **JSON/CSV upload** — doesn't exist; upload is image/PDF + OCR only.
- ~~**PDF export** — emitted `text/plain`~~ — fixed 6 Sep 2026, real jsPDF output.
- ~~**Admin moderation** — decorative~~ — fixed 6 Sep 2026: threads carry a Report
  control, the Admin Panel acts on real flags. "Ban User" was removed, not implemented.
- **25 years of questions** — 4 papers, 45 questions, 3 sessions.

## Conventions

- Match the existing style in `App.tsx`: section banner comments
  (`// ─── QUIZ VIEW ───`), the local `cn()` helper defined near the top, Tailwind
  utility classes inline, brand colours as literals — navy `#0F2340`,
  amber `#E8A020`, page background `#F7F8FA`.
- Fonts are Outfit / Playfair Display / JetBrains Mono, loaded in `src/styles/fonts.css`.
- Icons come from `lucide-react`.
- Keep new screens as functions in `App.tsx` unless the task is explicitly to split
  the file — a partial extraction would leave the codebase in two idioms at once.

## Working agreements

- **Verify line references before citing them.** This file and `TODO.md` cite
  specific lines; `App.tsx` is one large file and they shift on every edit.
- Log completed work in `CHANGELOG.md` under `[Unreleased]`, and tick the matching
  item in `TODO.md`.
- Touching `firestore.rules` means running `npm run test:rules`. It is fast (~15s) and
  it is the only automated check in the repo that tests behaviour rather than types.
- Don't touch `science-repository*/` except to copy code out of it.
