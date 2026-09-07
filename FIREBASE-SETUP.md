# Firebase Setup — Admin Checklist

**For whoever has access to the Firebase project.** Everything here needs console or
CLI permissions, so it can't be done from the code.

| | |
| --- | --- |
| **Project ID** | `gen-lang-client-0333512564` |
| **Database** | `ai-studio-6e4f1bfa-e270-4433-8911-181211d11793` — **not** `(default)` |
| **Console** | <https://console.firebase.google.com/project/gen-lang-client-0333512564> |

> **You do not need any of this to try the app locally.** `npm run dev` gives you a
> working admin account through the demo login, because the security rules aren't
> deployed yet. This checklist is for making the app safe to share.

---

## Before you start: the database is not the default one

The app stores everything in a **named** database:

```text
ai-studio-6e4f1bfa-e270-4433-8911-181211d11793
```

In the Firebase console, Firestore opens `(default)` — which is **empty**. You have to
switch databases using the picker at the top of the Firestore Data page, or you'll
conclude the data is missing.

`firebase.json` already points at the named database, so the CLI deploy targets the
right place. This only affects what you see in the console.

---

## Step 1 — Promote the first admin *(do this first)*

1. Have someone sign up in the app normally. This creates their `users` document.
2. Firebase console → **Firestore Database** → switch to the named database above.
3. Open the `users` collection and find their document (the ID is their Firebase Auth
   UID).
4. Change the `role` field from `student` to `admin`. Save.

**Why first:** once the rules are deployed, self-registration only ever creates
students, and the screen that grants roles is admin-only. If no admin exists at that
point, nobody can promote anyone from inside the app.

---

## Step 2 — Deploy the security rules

Until this runs, the database is open to anyone with the app's config — which ships in
the public JavaScript. Every role check in the app is currently decoration.

```bash
firebase login
firebase deploy --only firestore:rules
```

The rules are in `firestore.rules`. They have been tested against the Firestore
emulator — 34 assertions covering every collection and role, run with
`npm run test:rules`.

### What changes once they're live

- **Self-registration only creates students.** The role picker and the
  `OAU_ADMIN_2024` code stop working. That's the point — it was the hole.
- **Lecturers and admins are promoted** from the Admin Panel's *Manage Roles* card.
- **Lecturers can submit questions**, but only as `pending`. Only admins approve.
- **Students can't read pending questions**, only approved ones.
- **Nobody can rewrite another person's forum thread** author or title.

### If you deploy before Step 1

Recoverable, don't panic. Console access bypasses security rules, so you can still
edit the `users` document by hand exactly as described in Step 1. You just can't grant
roles from inside the app until one admin exists.

---

## Step 3 — Check it actually applied

1. Console → **Firestore Database** → **Rules** tab. Confirm the named database is
   selected and the rules match `firestore.rules`.
2. In the app, sign up a fresh test account. It should come out as a **student**.
3. As that student, try the Upload screen — it shouldn't be reachable.
4. As your admin, open the Admin Panel → **Manage Roles** and promote the test account
   to lecturer. It should work.

If step 2 produces something other than a student, the rules didn't apply — check you
were on the named database and not `(default)`.

---

## Step 4 — Before deploying the app publicly

### Authorized domains (or Google sign-in breaks)

Console → **Authentication** → **Settings** → **Authorized domains** → add your
deployed domain.

`localhost` is allowed by default, which is why this only ever fails after deployment.
Google sign-in silently refuses to work on unlisted domains.

### Confirm sign-in methods are on

Console → **Authentication** → **Sign-in method**. Both should be enabled:

- Email/Password
- Google

### Deploy on a Node host, not static hosting

`npm run build` produces static files only. The AI endpoints (`/api/ocr`,
`/api/grade`, `/api/clean-text`, `/api/generate-quizzes`) are served by `server.js`:

```bash
npm run build
npm start          # serves dist/ and the API together
```

Deploying `dist/` alone to static hosting makes OCR, AI grading, OCR cleanup and quiz
generation return 404. **Firebase Hosting alone will not work** for this reason —
use a Node host (Cloud Run, Render, Railway) or Firebase Hosting with Cloud Functions.

### Set the Gemini key

```bash
GEMINI_API_KEY=...
```

Set this on whichever host runs `server.js`. **Without it the AI endpoints return
realistic mock data rather than failing** — so they look like they're working while
being fake. That's a bad thing to discover mid-demo.

---

## Checklist

- [ ] Switched to the named database in the console (not `(default)`)
- [ ] First admin promoted by hand — **before** deploying rules
- [ ] `firebase deploy --only firestore:rules` run
- [ ] Verified: a fresh sign-up comes out as a student
- [ ] Verified: Manage Roles can promote someone
- [ ] Deployed domain added to Authorized domains
- [ ] Email/Password and Google sign-in both enabled
- [ ] Running on a Node host via `npm start`, not static hosting
- [ ] `GEMINI_API_KEY` set on the host

---

## One known unknown

`RepositoryView` runs a query with three equality filters (`courseCode`, `session`,
`type`). Firestore normally serves this without a composite index. If you ever see a
*"The query requires an index"* error in the console, the error message contains a
one-click link that creates the index for you.

---

*Current state: [STATUS.md](STATUS.md) · Open work: [TODO.md](TODO.md) ·
Architecture notes: [CLAUDE.md](CLAUDE.md)*
