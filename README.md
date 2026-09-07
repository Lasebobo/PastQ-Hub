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

`npm run build` produces static files only. The `/api/*` routes are served by
`server.js`, so **deploy with `npm start` on a Node host — not to static hosting**, or
OCR, AI grading and quiz generation will return 404.

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
| `src/` | The application. Every screen lives in `src/app/App.tsx`. |
| `api/` | The four AI endpoints, shared by the dev server and `server.js`. |
| `server.js` | Production server — static files, API routes, SPA fallback. |
| `firestore.rules` | Database security rules. **Not deployed yet** — see `TODO.md`. |

## Before deploying

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

See `ATTRIBUTIONS.md`. UI scaffolding from [shadcn/ui](https://ui.shadcn.com/) (MIT);
originally exported from a [Figma Make](https://www.figma.com/design/q3WumamhQ8IOesN8ubE67x/Quiz-and-Forum-Features) bundle.
