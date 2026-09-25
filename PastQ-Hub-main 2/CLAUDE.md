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
npm run test:rules  # boots the Firestore emulator, runs 48 rules assertions, tears down
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

`dist/` and `.DS_Store` are ignored and untracked. Regenerate build output with
`npm run build`; do not commit it.

## Architecture

- **React 18 + TypeScript + Vite 6 + Tailwind 4.** Firebase Auth + Cloud Firestore.
- `src/app/App.tsx` — tiny provider wrapper.
- `src/app/MainApp.tsx` — authenticated app shell, mobile drawer, loading state, and
  view routing. There is no router library; views still switch on the `View` union.
- `src/app/features/` — screen-level feature modules: auth, library, quiz, forum,
  upload, bookmarks, trends, repository, and admin.
- `src/app/components/` — shared reusable UI already used by the app: layout/sidebar
  and paper card/viewer components.
- `src/app/types.ts` — shared domain types.
- `src/app/data/samplePapers.ts` — bundled sample papers for the Admin seed button.
- `src/app/services/` — Firestore-facing helpers and paper reconstruction.
- `src/app/utils/` — small UI helpers (`cn`, department colours, frequency badges).
- `src/app/lib/firebase.ts` — Firebase init. Note the named database:
  `getFirestore(app, "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793")`.
- `src/app/lib/AuthContext.tsx` — `user` (Firebase) + `profile` (Firestore `users` doc).
- `api/handlers.js` — **the four AI endpoints, written once.** Plain functions taking
  `(body, apiKey)` and returning `{ status, body }`. `api/node-adapter.js` bridges them
  to Node req/res. Both `vite.config.ts` (dev) and `server.js` (production) import that
  adapter, so **change an endpoint here and both get it** — never add a handler to only
  one of them; that is what produced the OCR field-name bug.
- `server.js` — dependency-free production server: `dist/`, the API routes, SPA fallback.

**Firestore collections:** `users`, `questions`, `threads`, and
`threads/{threadId}/comments`.
Questions are stored flat, one document per question, and reassembled into papers
client-side by `reconstructPQFiles`. Its field names
(`questionText`, `solutionText`, …) differ from the in-memory `PQQuestion` type
(`text`, `solution`, …) — match the DB names when writing, the type when reading.
Forum replies are subcollection documents; legacy embedded `comments` arrays are still
displayed read-only as a migration fallback.

## Traps — read before editing

These have already caused real bugs. Treat old line numbers as stale and re-grep.

1. **Live papers are passed through `allPqFilesList`.** Screens that show papers should
   accept that prop and derive local `pqFiles` from it. Library, Trends and Forum each
   silently fell back to bundled mock data at some point because the prop was passed
   but never declared; `strict` + `noUnusedParameters` now catches that class of bug.

2. **Guard `.find()` on the paper list.** `TrendsView` used to do a non-null assertion
   against a hardcoded id, which crashed the moment it saw real data. Screens that
   select a paper by id should choose a valid first paper when the list changes and
   render an empty state when no papers exist.

3. **A static deploy has no `/api/*`.** `vite build` emits static files only, so
   deploying `dist/` alone silently breaks OCR, AI grading, text cleanup and quiz
   generation — the client calls are in the bundle, the server is not. **Never deploy
   to GitHub Pages or any static host.** Two supported targets:
   - **Vercel** — `api/*.js` are Serverless Functions; see `DEPLOY-VERCEL.md`.
   - **Any Node host** — `npm run build && npm start` runs `server.js`.

   The four endpoints live once in `lib/ai-handlers.js`. Three adapters wrap them:
   `lib/node-adapter.js` (dev middleware + `server.js`) and `lib/vercel-adapter.js`
   (`api/*.js`). **`api/` holds routing only — never logic.** Adding an endpoint means
   editing `lib/ai-handlers.js` and adding a five-line file under `api/`. Anything in
   `api/` not prefixed with `_` becomes a public endpoint on Vercel, which is why the
   shared modules live in `lib/` and not there.

   *(`firebase.json` configures Firestore only — it is not a hosting target.)*

4. **Mock fallbacks hide broken code paths.** Every AI endpoint returns canned data
   when `GEMINI_API_KEY` is unset, so a broken request still "works" in the UI. That
   is how the OCR field-name mismatch survived (fixed 6 Sep 2026 — the client now
   sends `imageBase64` + `mimeType` and strips the data-URL prefix). **The OCR path
   has still never run against a real key.** The other three endpoints —
   `/api/grade`, `/api/clean-text`, `/api/generate-quizzes` — have not been verified
   against a real key either. Check the payload shapes before trusting them.

5. **The type check only partly covers the Firestore boundary.** `npm run typecheck`
   is strict and clean, so a wrong prop or unused symbol is caught now. But most
   Firestore rows are still assembled from `any` objects and handed to `addDoc`.
   **Anything written to or read from Firestore needs shape checks in code and rules** —
   verify those shapes by reading `reconstructPQFiles`, the upload/seed writers, and
   `firestore.rules`, not by trusting the compiler alone.

6. **Roles are still decided in the browser until the rules are deployed.**
   `firestore.rules` exists at the repo root and closes this properly. It is
   **verified** — `npm run test:rules` runs 48 assertions against the emulator and the
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

- ~~**"Real-time" forum**~~ — fixed 8 Sep 2026: forum threads and selected-thread
  comments use `onSnapshot`.
- ~~**Forum attachments**~~ — removed 8 Sep 2026 because Firebase Storage is not
  configured.
- ~~**Trend analysis across years**~~ — fixed 8 Sep 2026: Trends, paper cards and paper
  detail all display computed topic counts from the approved question set.
- ~~**Bookmarks** — no screen to read them back~~ — fixed 6 Sep 2026, `BookmarksView`.
- **JSON/CSV upload** — doesn't exist; upload is image/PDF + OCR only.
- ~~**PDF export** — emitted `text/plain`~~ — fixed 6 Sep 2026, real jsPDF output.
- ~~**Admin moderation** — decorative~~ — fixed 6 Sep 2026: threads carry a Report
  control, the Admin Panel acts on real flags. "Ban User" was removed, not implemented.
- **25 years of questions** — 4 papers, 45 questions, 3 sessions.

## Conventions

- Put screen-level work under `src/app/features/<feature>/`.
- Put shared, already-used UI under `src/app/components/<domain>/`.
- Put Firestore/data-shape helpers under `src/app/services/`; keep raw collection
  writes easy to grep.
- Put tiny presentation helpers under `src/app/utils/`.
- Keep Tailwind utility classes inline and preserve the brand colours as literals —
  navy `#0F2340`, amber `#E8A020`, page background `#F7F8FA`.
- Fonts are Outfit / Playfair Display / JetBrains Mono, loaded in `src/styles/fonts.css`.
- Icons come from `lucide-react`.
- Prefer focused files over a new framework. There is no routing/state framework, and
  adding one just for neatness would be a larger product change than this app needs.

## Working agreements

- **Verify line references before citing them.** The app is split now, but files still
  move; use `rg` and fresh line numbers.
- Log completed work in `CHANGELOG.md` under `[Unreleased]`, and tick the matching
  item in `TODO.md`.
- Touching `firestore.rules` means running `npm run test:rules`. It is fast (~15s) and
  it is the only automated check in the repo that tests behaviour rather than types.
- Don't touch `science-repository*/` except to copy code out of it.
