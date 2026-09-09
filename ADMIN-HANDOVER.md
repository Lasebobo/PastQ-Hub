# PastQ-Hub — Admin Handover

**For whoever owns the Firebase project and the Vercel account.**

Everything here needs console access, so it can't be done from the code or by anyone
else on the team. **About 45 minutes.**

| | |
| --- | --- |
| **Firebase project** | `gen-lang-client-0333512564` |
| **Firestore database** | `ai-studio-6e4f1bfa-e270-4433-8911-181211d11793` — **not** `(default)` |
| **Firebase console** | <https://console.firebase.google.com/project/gen-lang-client-0333512564> |
| **Vercel project** | under `lasebobos-projects` |
| **Repo** | `Lasebobo/PastQ-Hub`, branch `main` |

## Three things need you

1. **The database is currently open.** Security rules are written and tested but not
   deployed. Anyone with the site URL can read and write everything.
2. **Vercel deployments have been blocked since 6 September.** It's an account
   setting, not a code problem.
3. **The Gemini API key isn't set**, so the AI features return fake data that looks
   real.

Do **Part 1 before Part 2** — Part 1 closes the database *before* the site becomes
public.

---

## Part 1 — Lock down the database

*~20 minutes. Do this before the site is public.*

### 1.1 Switch to the right database first

The app uses a **named** database, not the default one:

```text
ai-studio-6e4f1bfa-e270-4433-8911-181211d11793
```

The console opens `(default)`, which is **empty**. Use the database picker at the top
of the Firestore Data page to switch, or you'll think the data is missing.

This trips people up more than anything else here. If a step below shows no data,
check this first.

### 1.2 Confirm sign-in methods are on

Console → **Authentication** → **Sign-in method**. Both must be enabled:

- Email/Password
- Google

### 1.3 Promote the first admin — ⚠️ before 1.4

**This is the one step that is painful to get wrong.**

1. Have someone sign up in the app normally (running it locally with `npm run dev` is
   fine — it doesn't need to be deployed).
2. Console → **Firestore Database** → switch to the named database.
3. Open the `users` collection, find their document — the ID is their Auth UID.
4. Change `role` from `student` to `admin`. Save.

**Why before 1.4:** once the rules are live, signing up only ever creates a *student*,
and the screen that grants roles is *admin-only*. If no admin exists at that moment,
nobody can promote anyone from inside the app.

> Not fatal if you do it backwards — console access bypasses the rules, so you can
> still edit the document by hand. You just can't do it from the app.

### 1.4 Deploy the security rules

```bash
firebase login
firebase deploy --only firestore:rules
```

The rules live in `firestore.rules`. `firebase.json` already targets the named
database, so this goes to the right place.

They've been tested against the Firestore emulator — **48 assertions** covering every
collection and role. Anyone on the team can re-run them with `npm run test:rules`.

#### What changes once they're live

- Signing up only ever creates a **student**. The role picker and the
  `OAU_ADMIN_2024` code stop working — that was the security hole.
- Lecturers and admins are promoted from **Admin Panel → Manage Roles**.
- Lecturers can submit questions, but only as `pending`. Only admins approve.
- Students can't read pending questions.
- Nobody can rewrite someone else's forum post or steal its authorship.

### 1.5 Check it actually applied

1. Console → **Firestore Database** → **Rules** tab. Confirm the **named database** is
   selected and the rules match `firestore.rules`.
2. Sign up a fresh test account in the app. **It must come out as a student.**
3. As that student, try to reach the Upload screen — it shouldn't be there.
4. As your admin, go to **Admin Panel → Manage Roles** and promote the test account to
   lecturer. It should work.

**If step 2 gives you anything other than a student, the rules didn't apply.** Almost
always this means they went to `(default)` instead of the named database.

---

## Part 2 — Get Vercel deploying

*~25 minutes.*

### 2.1 Unblock deployments

Every deployment since 6 September failed with **"Deployment was blocked"** — not a
build failure. The pattern is exact:

| Commit author | Result |
| --- | --- |
| Lasebobo | ✅ deployed |
| Everyone else | ❌ blocked |

The project is on a personal **Hobby** account. Hobby plans only build commits authored
by the account owner; pushes from collaborators are blocked. **Nothing in the code
causes this.**

Pick one:

1. **Move the project to a Vercel Team** — the proper fix; teams allow multiple git
   authors.
2. **Deploy manually yourself:** `npx vercel --prod` from your machine. Your
   authorship, so it builds. Perfectly fine for a defence.
3. **Keep deploys with you** — the team pushes to GitHub, you press deploy.

Please confirm the exact reason in the Vercel dashboard before paying for anything.
The GitHub API tells us *that* deploys were blocked and *whose*, not Vercel's own
reason string.

### 2.2 Set the Gemini API key

Vercel → **Settings → Environment Variables**:

| Name | Value | Environments |
| --- | --- | --- |
| `GEMINI_API_KEY` | your Gemini key | Production, Preview, Development |

**This one is easy to skip because skipping it doesn't look broken.** Without the key,
OCR, AI marking, text cleanup and quiz generation all return realistic *mock* data. The
demo appears to work while the AI does nothing.

Redeploy after adding it.

### 2.3 Deploy

Push to `main`, or run `npx vercel --prod`. No configuration needed — `vercel.json` is
already in the repo and sets the build, the function timeouts and the routing.

### 2.4 Add the deployed URL to Firebase

Console → **Authentication** → **Settings** → **Authorized domains** → add your Vercel
domain.

`localhost` is allowed by default, which is exactly why this only ever breaks *after*
deploying. Google sign-in silently refuses to work on unlisted domains.

### 2.5 Verify the live site

```bash
# The API must answer. A 404 means the functions didn't deploy.
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Content-Type: application/json" -d '{"text":"hello"}' \
  https://YOUR-URL.vercel.app/api/clean-text

# The demo credentials must NOT be in the live bundle.
curl -s https://YOUR-URL.vercel.app/assets/index-*.js | grep -c "admin123"
```

Expect **200** and **0**.

Then in a browser:

- Sign in with Google — proves 2.4 worked.
- Upload a real photo of an exam paper and run OCR — proves 2.2 worked, and that the
  output isn't the canned sample text.
- Sign up a fresh account — it must be a **student**, proving Part 1 worked.

---

## Checklist

### Firebase

- [ ] Switched to the named database, not `(default)`
- [ ] Email/Password and Google sign-in both enabled
- [ ] First admin promoted by hand — **before** deploying rules
- [ ] `firebase deploy --only firestore:rules` run
- [ ] A fresh sign-up comes out as a student
- [ ] Manage Roles can promote someone

### Vercel

- [ ] Deployments unblocked
- [ ] `GEMINI_API_KEY` set for Production and Preview
- [ ] Redeployed after adding the key
- [ ] `/api/clean-text` returns 200 on the live URL
- [ ] Demo credentials absent from the live bundle
- [ ] Vercel domain added to Firebase Authorized domains
- [ ] Google sign-in works on the live site
- [ ] OCR tested with a real photo, output is not the sample text

---

## Two things worth knowing

**The Firebase config in the repo is not a secret.** A Firebase Web `apiKey` is a
public project identifier that ships in every client bundle. It identifies; it doesn't
authorise. Access is controlled entirely by the Firestore rules — which is exactly why
Part 1 matters.

**Don't deploy to GitHub Pages or any static host.** The four AI endpoints need a
runtime. On static hosting the site loads and looks fine while every AI feature returns
404. Vercel (configured) or any Node host via `npm start` both work.

---

## If something goes wrong

| Symptom | Cause |
| --- | --- |
| Console shows no data | You're on `(default)`, not the named database |
| "Missing or insufficient permissions" | Rules deployed but no admin was promoted first (1.3) |
| Fresh sign-up can still pick a role | Rules went to the wrong database |
| Google sign-in fails on the live site | Domain missing from Authorized domains (2.4) |
| AI output looks canned | `GEMINI_API_KEY` not set, or not redeployed after (2.2) |
| `/api/*` returns 404 | Deployed to static hosting instead of Vercel |
| "The query requires an index" | The error contains a one-click link that creates it |

---

## What to send back

1. The live Vercel URL.
2. Confirmation the rules are deployed — or a shout if `firebase deploy` errors.
3. Which option you chose in 2.1, so the team knows whether to expect their pushes to
   deploy.

---

*Deeper detail: [FIREBASE-SETUP.md](FIREBASE-SETUP.md) and
[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) · Feature walkthrough:
[DEMO-SCRIPT.md](DEMO-SCRIPT.md) · Project state: [STATUS.md](STATUS.md)*
