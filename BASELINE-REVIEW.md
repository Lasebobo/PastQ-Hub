# PastQ-Hub — Baseline Review

**CPE 508 · Obafemi Awolowo University** · 6 September 2026 · commit `bb30ad5`

> **This is a historical snapshot, kept as a record.** Most of what it describes has
> since been fixed — see [STATUS.md](STATUS.md) for the current state.

A file-by-file check of the code against every claim made in the CPE 508
Implementation Summary — what works, what doesn't, and what to fix first.

| Fully working | Need fixing | Not built |
| --- | --- | --- |
| 3 | 5 | 2 |

Ten features were checked. **Nothing here needs rebuilding from scratch** — almost all
the code is already written. The gap is that the finished pieces were never connected
to each other.

---

## 1. What's actually in the repo

There are three copies of this project in the folder. Only one of them runs.

| Path | What it is |
| --- | --- |
| `src/` | **The real app.** React + Vite + Tailwind. Every screen lives in one 2,619-line file. Builds cleanly in 1.2 seconds. |
| `science-repository/` | An **older, different** version of the same idea, built in Google AI Studio. Nothing imports it. It never runs. |
| `science-repository-temp/` | An **exact byte-for-byte copy** of the folder above. Pure duplication. |

Don't delete the two dead folders yet — they contain four things the live app is
missing: the database security rules, a real server for the AI features, a Bookmarks
screen, and working PDF export. Copy those over first, then delete.

---

## 2. The one problem to understand first

If you read nothing else, read this. It explains why the app looks finished but
doesn't hold together.

The app stores past questions in a Firebase database. Uploading works. Approving
works. But **the Library — the main screen students use — was never connected to that
database.** It shows the same four demo papers no matter what anyone uploads.

```text
Lecturer uploads  →  Admin approves  →  Database
                                          │
                                          ├─ ✓ Quiz        reads the database
                                          ├─ ✓ Repository  reads the database
                                          ├─ ✗ Library     shows 4 demo papers forever
                                          └─ ✗ Trends      shows 4 demo papers forever
```

The cause is two lines. The main component *sends* the database data to all four
screens — but the Library and Trends screens were written to not accept it, so it is
silently dropped and they fall back to a hardcoded list.

`App.tsx:2594` and `App.tsx:2602` send the data. `App.tsx:1012` (Library) and
`App.tsx:2043` (Trends) don't take it in. The hardcoded list is at `App.tsx:398`.

### Careful: there's a trap in this fix

The Trends screen starts by looking for a paper with a fixed id (`pq_cpe508_2223`) and
uses `.find(...)!` — code that promises it will always be found. It never is, in a
database that doesn't contain that exact id. **Connecting Trends without also fixing
that line will turn the screen white.** Do the two together.

*(`App.tsx:2045` — the non-null assertion; `App.tsx:2047` crashes on the next line.)*

### The second effect of the same split

Nothing ever loads the four demo papers *into* the database. So on a fresh database
the **Quiz has zero questions** — while the Library sits next to it confidently
showing four papers. Two screens, two truths.

---

## 3. Feature-by-feature status

| Feature | Status | What that means |
| --- | --- | --- |
| Sign in & accounts | ✅ Working | Email/password and Google sign-in both work. But anyone can make themselves an admin — see section 5. |
| Quiz engine | ✅ Working | Topic filters, timer, scoring, model solutions, AI marking for theory answers. Genuinely good — but empty if the database is empty. |
| Discussion forum | ✅ Working | Threads, replies and likes all save correctly. Not live-updating as the report claims; attachments are selected but never uploaded; course tabs hardcoded to the same 4 demo courses. |
| Upload & approval | ⚠️ Needs fixing | The whole pipeline works on your laptop. It stops working the moment the app is deployed — see section 4. |
| PQ Library | ⚠️ Needs fixing | Wired to the wrong source. Shows 4 demo papers; approved uploads never appear. |
| Trend analysis | ⚠️ Needs fixing | The frequency numbers are typed into the code by hand, not counted from the papers. Every uploaded topic reports "5×" forever. |
| Bookmarks | ⚠️ Needs fixing | Bookmarks save to the database correctly. There is no screen anywhere in the app to view them again. |
| Admin panel | ⚠️ Needs fixing | User and paper counts are real and correct. The "Flagged Posts" moderation section is permanently empty and its buttons do nothing. |
| Download paper | ❌ Not built | Produces a plain `.txt` file, not a PDF. The PDF library is already installed and unused. |
| Database security | ❌ Not built | No security rules exist in this project. The database is currently open. |

---

## 4. What's broken

Four problems that aren't visible from the screen but will bite during a demo or a
deployment.

### The AI features only exist on your laptop

OCR, AI marking, text cleanup and quiz generation are written inside the development
server's config file. When you build the app for real, that file is not included.
Deploy it anywhere and all four features return "not found".

*`vite.config.ts:21–300` — should be a real server.*

### OCR will break the moment you add a real API key

The app sends the scanned image under one name; the server reads a different one.
Right now this is hidden, because with no API key the server just returns fake sample
text. Add a real Gemini key and OCR stops working immediately.

*Sends `file` at `App.tsx:1843` — reads `imageBase64` at `vite.config.ts:39`.*

### Trend analysis doesn't analyse anything

The report describes tracking topic frequency across exam years. The code doesn't
count anything — it reads a number that was typed in next to each question by hand.
"Years Covered: 25+" on the Library screen is also just text, not a calculation.

*`App.tsx:2047` (assigns instead of counting) · `App.tsx:2480` (defaults every upload
to 5) · `App.tsx:1048`.*

### No type checking, which is how the above got missed

The project has no TypeScript configuration and no check step. The two disconnected
screens in section 2 would both have been caught instantly by a standard type check.
Nothing currently catches this class of mistake.

---

## 5. Security

Fine for a closed demo. Not fine the moment the link goes to a class group.

### The database has no rules

There is no `firestore.rules`, `firebase.json` or `.firebaserc` in this project, so
nothing restricts who can read or write. The database connection details ship inside
the public JavaScript.

### The admin credentials are printed on the login screen

This is worse than it first looks. The sign-up form **displays the administrator code
on screen** — "Demo code: OAU_ADMIN_2024" sits directly under the field that asks for
it. The login screen also has a **one-click button** labelled
`admin@oau.edu / admin123` that fills in working admin credentials. Nobody needs
developer tools; they just need the link.

*`App.tsx:486` (the check) · `App.tsx:626` (code shown on screen) · `App.tsx:660–664`
(one-click admin login).*

### A failed login silently creates an account

If sign-in fails, the app quietly registers the person instead. It then assigns roles
by guessing from the email address: `admin@oau.edu` becomes an admin, and any address
containing "lecturer" becomes a lecturer.

*`App.tsx:456–464`.*

**All three have the same fix:** roles must be decided by the server, not the browser.

---

## 6. The to-do list

In priority order. The first group is the difference between a demo that works screen
by screen and a system that actually works.

### Before you demo — *must do, roughly one afternoon*

1. **Connect the Library and Trends screens to the database** *(small)* — two function
   signatures. Fix the `.find(...)!` on `App.tsx:2045` in the same change, or Trends
   will go white.
2. **Load the four demo papers into the database, once** *(small)* — a "Seed demo
   data" button beside the Reset button that already exists.
3. **Fix the OCR request** *(small)* — rename one field so the app and server agree.
   Do it before adding a real API key, not after.
4. **Lock down the database** *(medium)* — write and deploy the security rules, move
   roles to the server, remove the hardcoded admin code.

### To match what the report promises — *should do*

5. **Make the AI features survive deployment** *(medium)* — move the four endpoints
   out of the dev config into a real server.
6. **Count topic frequency for real** *(small)*.
7. **Add the Bookmarks screen** *(small)* — the data is already being saved.
8. **Make "Download" produce a real PDF** *(small)* — the report's #1 roadmap item.

### Housekeeping — *before submission*

9. **Fix the README** *(small)* — it still contains merge conflict markers.
10. **Delete the duplicate folder and stop committing the build output** *(small)*.
11. **Add TypeScript checking** *(small)* — this is what would have caught problem #1.
12. **Remove unused packages** *(small)* — 46 UI components and roughly 30 packages
    are imported nowhere.

---

## 7. Decide before the defence

The original project brief asks for five things that neither the code nor the
Implementation Summary mentions. Better to rule them in or out now than to be asked
about them on the day.

- **Level selection** — the brief asks students to pick department, *level*, semester
  and course. There is no level field anywhere in the data.
- **Difficulty tagging** — questions are tagged by topic, year and type, not difficulty.
- **Solution source** — the brief says each solution should state whether it came from
  a lecturer, a student, or online. Not recorded.
- **Search history and usage records** — listed as a core feature in the brief. Not built.
- **Twenty-five years of questions** — the brief and the app both promise this. There
  are four papers, 45 questions, across three sessions.

---

## Verdict

The project is **further along than it looks in the code, and less far along than it
looks on the screen.** Every headline feature in the Implementation Summary exists in
some form. Three of them work end to end. The rest stop one connection short.

The strongest asset is the content itself: 35 real CPE 508 questions with genuinely
good step-by-step EVM and critical-path solutions. That is the part a marker will
actually read, and it is finished.

Items 1 to 4 are small, specific edits to code that is already written — realistically
an afternoon — and they are what turns this from four good screens into one working
system.

> **The one thing not to leave undone:** the database currently has no rules and the
> admin code is printed in the JavaScript that ships to every visitor. That's
> acceptable for a demo on your own laptop. It is not acceptable once the link is
> shared with a class.

---

*Superseded by [STATUS.md](STATUS.md) · Open work: [TODO.md](TODO.md) ·
Change history: [CHANGELOG.md](CHANGELOG.md)*
