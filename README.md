# PastQ-Hub

A past questions and solutions repository for science-based courses at **Obafemi
Awolowo University**, built for **CPE 508 — Computer System Project Management**.

Students browse past exam papers, generate timed quizzes with worked solutions, see
which topics come up most often, bookmark hard questions, and discuss them in
per-course forums. Lecturers and admins upload scanned papers, which are transcribed
by OCR and reviewed before publication.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

To run the production build:

```bash
npm run build
npm start        # http://localhost:3000
```

`npm run build` produces static files only. The `/api/*` routes need a runtime, so
**deploy to Vercel ([DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)) or run `npm start` on a Node
host — never to GitHub Pages or other static hosting**, or OCR, AI grading and quiz
generation will return 404 while the app looks like it loaded fine.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | no | Enables the real Gemini calls for OCR, grading, OCR cleanup and quiz generation. Without it every AI endpoint returns realistic mock data and the app is still fully demoable. |
| `PORT` | no | Port for `npm start` (default `3000`). |

## Stack

React 18 · TypeScript · Vite 6 · Tailwind CSS 4 · Firebase Authentication ·
Cloud Firestore · Google Gemini · jsPDF

## Layout

| Path | What it is |
| --- | --- |
| `src/app/App.tsx` | Tiny provider wrapper. |
| `src/app/MainApp.tsx` | Authenticated shell, sidebar, mobile drawer, loading state, and view routing. |
| `src/app/features/` | Screen-level features: auth, library, quiz, forum, upload, bookmarks, trends, repository, admin. |
| `src/app/components/` | Shared layout and paper components used by multiple screens. |
| `src/app/data/` | Bundled demo papers for the admin seed flow. |
| `src/app/services/` | Firestore-facing helpers and paper reconstruction logic. |
| `src/app/utils/` | Small presentation helpers for class names, department colours, and frequency badges. |
| `lib/` | The four AI endpoints, written once, plus the Node and Vercel adapters. |
| `api/` | Vercel Serverless Functions — routing only, five lines each. |
| `server.js` | Node-host server — static files, API routes, SPA fallback. |
| `firestore.rules` | Database security rules. **Not deployed yet** — see `TODO.md`. |

## Before deploying

Verifying it works? Follow [DEMO-SCRIPT.md](DEMO-SCRIPT.md) — an ordered click-through
of every feature, about 30 minutes, needs nothing set up first.

**If you have Firebase console access, read [FIREBASE-SETUP.md](FIREBASE-SETUP.md)** —
it is the ordered checklist for making this safe to share. Two things matter most:

1. **The Firestore rules are not deployed**, so the database is currently open.
2. **Promote your first admin by hand in the Firebase console *before* deploying
   them** — self-registration only creates students, and the screen that grants roles
   is admin-only, so deploying first locks everyone out.

`STATUS.md` is the current delivery report — what works, what was verified, and what
is left; `BASELINE-REVIEW.md` is the 6 Sep snapshot it is measured against. `CHANGELOG.md` records what has changed; `CLAUDE.md` carries the architecture notes
and the traps worth knowing before editing.

## Attribution

See `ATTRIBUTIONS.md`. The original project was exported from a
[Figma Make](https://www.figma.com/design/q3WumamhQ8IOesN8ubE67x/Quiz-and-Forum-Features)
bundle; unused shadcn/ui scaffolding has since been removed from the live source.
