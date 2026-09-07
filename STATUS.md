# PastQ-Hub — Delivery Report

**CPE 508 · Obafemi Awolowo University** · 7 September 2026 · branch `main`

Companion to the [6 September baseline review](BASELINE-REVIEW.md). Same ten features,
re-checked against the code — plus what was verified, and the one task left.

| | Working | Awaiting you | Not built |
| --- | --- | --- | --- |
| **6 Sep (baseline)** | 3 | 5 | 2 |
| **7 Sep (now)** | **9** | **1** | **0** |

The baseline review said the gap was *connection, not construction* — that the
finished pieces had never been wired to each other. That turned out to be right.
Everything is now built and connected. One task remains, and it is yours rather than
the code's: deploying the database rules.

---

## 1. Feature by feature

| Feature | Before | Now |
| --- | --- | --- |
| Sign in & accounts | anyone could become admin | demo credentials stripped from production builds |
| Quiz engine | working | unchanged — was already working |
| Discussion forum | moderation was decorative | Report control writes real flags |
| Upload & approval | AI routes died on deploy | served by `server.js` in production |
| PQ Library | showed 4 demo papers forever | reads the database |
| Trend analysis | hand-typed frequency numbers | counts topics across every paper |
| Bookmarks | saved, but no way to see them | Bookmarks screen + sidebar link |
| Admin panel | buttons did nothing | real flags, plus Manage Roles |
| Download paper | produced a `.txt` file | real PDF via jsPDF |
| Database security | no rules existed | **written & verified — not yet deployed** |

---

## 2. What was actually verified

The baseline review was reasoning about code. This is evidence from running it.

| Check | Result | What it proves |
| --- | --- | --- |
| Type check | 0 errors | Strict mode, including unused locals and parameters — the setting that catches the exact "prop passed but never declared" bug that broke the Library. |
| Security rules | **34 / 34** | Every collection, every role, against a real Firestore emulator. |
| Sabotage test | detected | The rules suite fails when a rule regresses — see below. |
| Production build | passing | Compiles and bundles without errors. |
| Credential leaks | 0 in bundle | Admin email, password, admin code and one-click login all absent from a production build, verified by searching the built JavaScript. |
| Server routes | 4 / 4 | All AI endpoints answer in production, with correct 405s on wrong methods. |
| Path traversal | 0 leaks | Seven attack shapes against the file server, checking response *bodies* rather than status codes. |

### The rules suite was itself tested

A test that always passes proves nothing. So the privilege-escalation hole was
deliberately reintroduced — letting sign-up pick any role — and the suite failed
exactly the two relevant assertions and exited with an error. Restoring the rules
returned it to 34/34. **The suite detects the thing it guards.**

```bash
npm run test:rules   # boots the emulator, runs 34 assertions, tears down
```

### Two bugs found were in the test, not the rules

A fixture user was promoted mid-run, silently turning every later "student" assertion
into a lecturer one. And created documents were never cleaned up, so a second run
failed with conflicts that looked exactly like a rules regression. Both fixed; the
suite is now idempotent.

### What was *not* verified

Nobody has logged into the deployed app and clicked through it. The Seed button,
Manage Roles, the Report flow and Bookmarks are all correct by inspection and pass
their type and rules checks, but have not been exercised against live Firebase by a
human. **Budget thirty minutes to click every new button before the defence.**

---

## 3. The one task left

The rules are written and verified. Until they are deployed, the database is still
open and every role check in the app is decoration.

**Deploy them in this order:**

1. **Promote your first admin by hand** in the Firebase console — set one user's
   `role` to `admin`.
2. **Then deploy:**

   ```bash
   firebase deploy --only firestore:rules
   ```

The order matters and is not reversible by guessing. Once the rules are live, sign-up
only ever creates students, and the screen that grants roles is admin-only. Deploy
first and there is no admin to grant anything — **you lock yourself out of your own
app.**

---

## 4. Known limitations

Still true, and worth saying out loud rather than being asked.

- **The forum is not real-time.** It refetches after you act, rather than updating
  live. The Implementation Summary claims real-time — worth correcting one sentence
  in the report.
- **Forum attachments still don't upload.** The paperclip selects a file that goes
  nowhere. Firebase Storage is not used anywhere in the app.
- **Two different frequency numbers.** Trends now counts topics properly, but the
  older stored `frequency` field still exists and is still what the paper cards
  display. Pick one before the defence.
- **JSON/CSV upload doesn't exist.** Upload is image/PDF with OCR only. Also claimed
  in the report.
- **Not twenty-five years.** Four papers, 45 questions, three sessions.
- **Comments can collide.** Two people replying to the same thread at the same moment
  can overwrite each other. It needs a data-model change, so it is deliberately left
  alone this close to a defence.

The original brief also asks for four things nobody has ruled in or out: **level
selection**, **difficulty tagging**, **solution attribution** (lecturer / student /
online), and **search history**. These are the questions an examiner reaches for.
Decide the answers now rather than discovering them on the day.

---

## Verdict

The baseline review called this *"further along than it looks in the code, and less
far along than it looks on the screen."* That gap is closed. The features that existed
as disconnected parts are now one system, and the claims in the Implementation Summary
are true — with the four exceptions listed above, which are cheaper to correct in the
report than in the code.

What changed most is not the feature count. It is that the project now has **checks
that fail**: a strict type check, and a rules suite proven to catch its own
regression. The bug that made the Library ignore the database for months would be
caught in seconds today.

Deploy the rules, in the order above. Then spend thirty minutes clicking through it
yourself — that is the last unverified thing, and it is the one a demo will expose.

---

*Open work: [TODO.md](TODO.md) · Change history: [CHANGELOG.md](CHANGELOG.md) ·
Architecture notes: [CLAUDE.md](CLAUDE.md)*
