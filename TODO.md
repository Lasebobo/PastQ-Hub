# PastQ-Hub — TODO

Working checklist from the codebase review of 6 Sep 2026.
Full write-up: [Where PastQ-Hub Stands](https://claude.ai/code/artifact/0b02e3a5-2f44-4e1a-83e6-a14bfe35e780)

**P0, P1, P2 and P3 code items are complete** except for two things only you can do:
promoting the first admin and deploying the Firestore rules (now emulator-verified,
48/48). The remaining defence items are product/data decisions. Details in
[CHANGELOG.md](CHANGELOG.md).

The reviewed app monolith has been split into `src/app/MainApp.tsx`,
`src/app/features/`, `src/app/components/`, `src/app/services/`, `src/app/utils/`,
`src/app/data/`, and `src/app/types.ts`, so **any old line number in `App.tsx` is stale
— re-grep rather than trusting it.**

Guardrails now in place: `npm run typecheck` passes under `strict`, `noUnusedLocals`
and `noUnusedParameters` with zero errors. Run it before you commit.

---

## P0 — Before the demo

Turns the separate working parts into one working system.

- [x] **1. Connect Library + Trends to the database** — done
  - `LibraryView` and `TrendsView` now accept `allPqFilesList` and shadow it locally,
    matching the `QuizView` idiom. Both read Firestore; the module-level mock is now
    only used as seed input.
  - Crash guard is in: `TrendsView` selects the first available paper, re-selects when
    the list changes, and renders an empty state rather than throwing on `undefined`.
  - "Years Covered: 25+" is now a real count of distinct sessions, relabelled
    "Sessions Covered".
  - `LibraryView` now distinguishes "repository is empty" from "search found nothing".
  - **Pulled item 6 forward** — connecting Trends without it would have displayed a
    flat, meaningless chart, so topic frequency is now counted across all papers.

- [x] **2. Seed the demo papers into Firestore, once** — done
  - "Seed demo data" button added to `AdminPanel`, above the Dangerous Zone.
  - Writes every bundled question with `status: "approved"` and `createdBy: "system"`,
    using the field names `reconstructPQFiles` reads back.
  - Safe to re-run: queries `createdBy == "system"` first and reports the existing
    count instead of duplicating. `options` is omitted when absent, since Firestore
    rejects `undefined`.

- [x] **3. Fix the OCR request contract** — done
  - Client now sends `{ imageBase64, mimeType, filename }`, matching the server.
  - Strips the `data:<mime>;base64,` prefix and derives the real MIME type, falling
    back to `file.type`.
  - Added the missing `reader.onerror`, and moved `readAsDataURL` to after the
    handlers are attached.

- [~] **4. Lock down the database** — code side done, **deployment still pending**

  - [x] `firestore.rules` written at the repo root, plus `firebase.json` pointing at the
        named database. Rules deny by default; roles cannot be self-assigned;
        lecturers may create only `status: "pending"` questions; only admins approve.
        Written from scratch — the `science-repository` version had two holes
        (`users` self-write allowed role escalation, and admin-only `questions` writes
        would have blocked the lecturer upload flow).
  - [x] Credential leaks gated behind `import.meta.env.DEV` and **verified stripped from
        the production bundle**: `admin@oau.edu`, `admin123`, the one-click admin login,
        the "Demo code" hint, and the `OAU_ADMIN_2024` constant are all absent from a
        `vite build`, while `npm run dev` keeps every shortcut for demos.
  - [x] The sign-up role picker now offers **Student only** in production (verified: the
        minifier folds it to a single-entry array), matching what the rules permit.
        All three roles remain selectable in dev.
  - [x] Auto-registration on failed login is dev-only, so production no longer infers
        `admin` from `admin@oau.edu` or `lecturer` from the email string.

  - [x] **Rules verified against the Firestore emulator.** `npm run test:rules` starts
        the emulator, runs 48 assertions covering every collection and every role, and
        shuts down — one command, exit code 0 on pass. The rules **compile** (the
        emulator rejects a malformed file at load) and behave as intended. The suite
        was itself validated by sabotage: reintroducing the self-registration hole made
        exactly two assertions fail and the run exit 1, so it detects the thing it
        guards rather than passing unconditionally.

        Two bugs found were in the *test*, not the rules — a fixture whose role was
        mutated mid-run, and missing state cleanup causing HTTP 409s. Both fixed; the
        suite is now idempotent across repeated runs.

  - [ ] **Deploy the rules** — verified, but nothing is enforced until you run this:

        firebase deploy --only firestore:rules

  - [x] **Lecturer promotion path built.** "Manage Roles" card added to the Admin Panel:
        lists every registered user with a role dropdown. Optimistic update with
        rollback on failure, a spinner per row, and admins are blocked from changing
        their own role (which would lock them out of the screen). The role-count tiles
        above it are now derived from the same list, so they update immediately instead
        of going stale.
  - [ ] Promote your **first** admin by hand in the Firebase console — the Manage Roles
        screen is admin-only, so there is no bootstrap path once the rules are live.
        Chicken-and-egg: do this *before* deploying the rules, or you will lock
        yourself out.
  - [x] `UploadView` now sends `createdBy: auth.currentUser.uid`, so older profile rows
        missing `id` no longer cause lecturer submissions to be denied by the rules.

---

## P1 — To match the Implementation Summary

- [x] **5. Make the AI features survive deployment** — done
  - The four handlers now live once, in `api/handlers.js`, as plain functions.
    `vite.config.ts` (dev) and `server.js` (production) both call them through
    `api/node-adapter.js`, so the two can no longer drift — which is exactly how the
    OCR field-name mismatch survived. `vite.config.ts` dropped from 373 to 53 lines.
  - `server.js` is a dependency-free Node server: serves `dist/`, the four API routes,
    and an SPA fallback. `npm start` after `npm run build`.
  - Verified in production: all four endpoints return HTTP 200, static assets and the
    SPA fallback serve, path traversal is blocked (4 attack shapes tested, no leaks),
    wrong method → 405, malformed JSON → 400, hashed assets get immutable caching.
  - Also fixed while extracting: AI-assigned grades are now clamped to `0..marks`
    (the model could previously return any number), and Gemini's non-2xx responses
    now surface as a real error instead of silently becoming "No text extracted."

- [x] **6. Compute topic frequency for real** — done, pulled forward with item 1
  - `TrendsView` now counts how many times each topic is actually asked across every
    paper in the repository, instead of reading the stored `frequency` field.
  - `PQCard`/`PQViewer` now display the same computed count. The stored `frequency`
    field is still written as backwards-compatible data, but it is no longer the source
    of truth for displayed frequency.
  - Note `freqMeta` thresholds (`≥10` Very High, `≥7` High) were written for a
    25-year archive. With 4 papers every topic lands on "Moderate", which is honest
    but sparse — consider scaling thresholds to the dataset.

- [x] **7. Add the Bookmarks screen** — done
  - New `BookmarksView` plus a "Bookmarks" sidebar entry. Saved questions are grouped
    under the paper they came from, with expandable answers and solutions, an
    "Open paper" shortcut, and one-tap removal (optimistic, rolls back on failure).
  - Handles the case a straight port would have missed: a bookmark can outlive its
    question if an admin deletes or un-approves it. Those are counted and reported
    rather than silently vanishing.

- [x] **8. Real PDF download** — done
  - `downloadPaper` now produces a proper A4 PDF via `jsPDF`: cover block, per-section
    headings, wrapped question text, options, colour-coded answers and solutions, and
    "Page n of m" footers. The button is relabelled "Download PDF".
  - Verified by generating a 35-question paper: 8 pages, valid `%PDF-1.3` header, all
    expected strings present in the text layer, correct page numbering.
  - jsPDF's built-in fonts are Latin-1, so em dashes and box-drawing characters used
    throughout the question data would have rendered as mojibake — they are folded to
    ASCII first. Verified: no non-Latin-1 characters reach the PDF.

---

## P2 — Housekeeping

- [x] **9. Fix README.md** — done. Conflict markers removed and the README rewritten:
      what the project is, how to run dev *and* production, the environment variables,
      the repo layout, and the two things to know before deploying.
- [x] **10. Remove duplication** — mostly done.
  - `science-repository-temp/` deleted (was byte-identical to `science-repository/`,
    confirmed with `diff -rq` immediately before removing; recover with
    `git checkout fdc2476 -- science-repository-temp`).
  - `science-repository/` **kept deliberately.** Everything valuable was reimplemented
    rather than copied — rules, server, Bookmarks, PDF export — so it holds nothing we
    need, but it is the only record of the earlier implementation in the working tree
    and may be useful for the report. It is not built, installed or typechecked, so it
    costs nothing. Delete with `rm -rf science-repository` whenever you want.
  - `dist/` added to `.gitignore`, along with `.env*` and `.DS_Store`.
  - [x] `.DS_Store` untracked with `git rm --cached .DS_Store`; `dist/` was already not
        tracked in this checkout.
- [x] **11. Add TypeScript checking** — done, and stricter than planned.
  - `tsconfig.json` added; `typescript`, `@types/react`, `@types/react-dom` added as
    devDependencies; `npm run typecheck` added.
  - `strict`, `noUnusedLocals` and `noUnusedParameters` are all **on**, and the project
    passes with **zero errors**. The 9 pre-existing dead symbols were cleaned up
    (unused `Users`/`Settings` imports, `FORUM_THREADS`, `MOCK_OCR_CPE508`, two unread
    `loading` bindings, an unused `label`), plus two unused parameters the flags then
    surfaced: `LibraryView`'s `onStartQuiz` (declared, passed, never used) and
    `detectMeta`'s `content`.
  - Note what a type check still cannot catch: Firestore is still schemaless at
    runtime, so field-shape regressions still need explicit code review and rules
    tests. Shared question/user/thread record types now cover the main app boundary,
    and the generated-MCQ `type: "mcq"` mismatch is fixed.
- [x] **12. Drop unused packages** — done.
  - **14 removed** — nothing in the repo referenced them at all: `@mui/material`,
    `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@popperjs/core`,
    `react-popper`, `canvas-confetti`, `date-fns`, `motion`, `react-dnd`,
    `react-dnd-html5-backend`, `react-responsive-masonry`, `react-router`,
    `react-slick`. `node_modules` went **666 MB → 450 MB**. Build, typecheck and the
    production server all still pass.
  - `tw-animate-css` was on the same list but is **kept** — it is imported from
    `src/styles/tailwind.css`, which a JavaScript-only scan misses.
  - **Decision made:** the remaining shadcn stack was removed. The 46 unused components
        under `src/app/components/ui/` were deleted, and the 39 packages used only by
        that folder were removed from `package.json`/`package-lock.json`.
  - `react` and `react-dom` are now explicit runtime dependencies instead of optional
        peers, which the shadcn dependency tree had previously masked.
- [x] **13. Split the app into a readable folder structure** — done.
  - `src/app/App.tsx` is now only the provider wrapper.
  - `src/app/MainApp.tsx` owns the authenticated shell, sidebar/mobile drawer and view
    routing.
  - Screen-level code lives in `src/app/features/`; reused UI lives in
    `src/app/components/`; shared paper data, Firestore helpers, small presentation
    helpers and domain types live in `data/`, `services/`, `utils/` and `types.ts`.

---

## P3 — Minor bugs found during review

- [x] Timed quiz interval never cleared on unmount — cleanup effect added.
- [x] `loadingQuestions` set but never read — the app now shows a spinner while the
      first fetch runs, instead of an empty Library that reads as "no papers exist".
      Upload and Admin do not wait, since they never read the paper list.
- [x] Forum course tabs came from the hardcoded mock — `ForumView` now takes the live
      paper list, so a newly uploaded course gets a forum category. The hardcoded
      `"CPE 508"` default now falls back to a course that actually exists.
- [x] `AdminPanel` "Flagged Posts" was decorative — `flagged` was a state array nothing
      filled, the buttons only hid rows locally, and "No flagged posts — all clear!"
      always showed even though nothing could be flagged. **Reporting is now real:**
      a Report control on each thread writes `flagged`/`flagReason`/`flaggedBy` onto
      the thread (which passes `firestore.rules`, since author and title are
      untouched); the Admin Panel lists genuinely flagged posts and can dismiss the
      report or delete the post. The "Flagged Posts" stat tile counts them.
      The fake "Ban User" button was removed rather than reimplemented — banning needs
      enforcement on every read, which is a bigger design decision.
- [x] `allPqFiles` was only rebuilt when the fetch returned rows, so emptying the
      database (Admin reset, or un-approving everything) left stale papers on screen.
      Found while fixing the loading state; now rebuilds unconditionally.

Closed in cleanup pass:

- [x] Thread `views` are incremented once when a signed-in user opens a thread.
- [x] Forum comments now live in `threads/{threadId}/comments/{commentId}` and are
      written with a batch alongside a `replyCount` increment. Legacy embedded comments
      are still displayed read-only as a migration fallback.
- [x] Forum attachment controls were removed because Firebase Storage is not configured.
- [x] Forum threads and selected-thread comments now use `onSnapshot`.
- [x] `jspdf` is dynamically imported inside `downloadPaper`, keeping PDF-only
      dependencies out of the initial app chunk.

---

## Decide before the defence

The original brief (`src/imports/pasted_text/past-questions-repo.md`) asks for five
things neither the code nor the Implementation Summary mentions. Rule them in or out
deliberately:

- **Level selection** — the brief asks for department / *level* / semester / course. There is no `level` field in `PQFile` or `PQQuestion`.
- **Difficulty tagging** — questions carry topic, year and type, but no difficulty.
- **Solution source** — the brief requires each solution to state whether it came from a lecturer, a student, or online. Not recorded.
- **Search history and usage records** — listed as a core feature. Not built.
- **Twenty-five years of coverage** — promised by both the brief and the UI. Actual: 4 papers, 45 questions, 3 sessions.
