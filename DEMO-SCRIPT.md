# Demo Script

An ordered click-through that exercises every feature, with what you should see at
each step. **Roughly 30 minutes.**

Use it twice:

- **Now, locally** — to verify the code. Needs nothing from the Firebase admin.
- **Again after deploying** — to verify the configuration. Behaviour differs; the
  differences are flagged as **After deploy** notes throughout.

```bash
npm install
npm run dev          # http://localhost:5173
```

> **Why nothing is needed from the admin yet:** in dev, the demo login gives you an
> admin account and the security rules aren't deployed, so nothing blocks writes.
> Both of those change in production — see [FIREBASE-SETUP.md](FIREBASE-SETUP.md).

Keep the **browser console open** throughout. Firestore permission errors surface
there, not in the UI.

---

## 0. Start clean *(optional but recommended)*

If the database already has demo content, wipe it so you see the empty states —
they're part of what you're checking.

**Admin Panel → Dangerous Zone → Reset Database.** Confirm the dialog, let the page
reload.

> ⚠️ This deletes all questions, threads and bookmarks. Never run it against anything
> you care about.

---

## 1. Sign in

1. Open the app. The auth screen appears.
2. Click the **`admin@oau.edu / admin123`** link under "Admin demo". Fields fill in.
3. Click **Sign In**.

**Expect:** you land on PQ Library, sidebar shows your name and the role `admin`.

**Sidebar should list:** PQ Library · Quiz · Bookmarks · Forum · Trends · Upload ·
Repository · Admin Panel *(the last three are role-gated)*.

> **After deploy:** the demo login button is gone — it's stripped from production
> builds. Sign in with the account you promoted by hand.

---

## 2. The empty state *(this is the bug that started all this)*

Before seeding, look at **PQ Library**.

**Expect:** "0 papers found" and an empty-state card.

**This is the important check.** Before the fix, the Library showed four demo papers
that lived only in the code — so it looked full while the database was empty, and
uploaded papers never appeared. If you see papers here on an empty database, the
regression is back.

Check **Quiz** and **Trends** too — both should show empty states, not four papers.

---

## 3. Seed the sample data

1. **Admin Panel** → scroll to **Demo Data**.
2. Read the line — it names how many papers and questions it will publish.
3. Click **Seed demo data**.

**Expect:** button shows "Seeding…", then a green confirmation.

**Then check all three screens now agree:**

| Screen | Expect |
| --- | --- |
| PQ Library | 4 papers |
| Quiz | the same 4 papers in the picker |
| Trends | topic bars, real counts |

**Click Seed demo data a second time.** It should refuse or report nothing to do —
not create duplicates.

---

## 4. Browse and read a paper

1. **PQ Library** → click **CPE 508**.
2. Expand a Section A question.

**Expect:** the question, its answer, and a worked solution. Fill-in-the-blank
questions show "Answer"; others show "Model Answer".

3. Try search and the department/session filters. Clear them again.

---

## 5. Bookmarks

1. Still in the paper, click the **bookmark icon** on two or three questions.
2. **Expect:** the icon fills in.
3. Go to **Bookmarks** in the sidebar.

**Expect:** exactly the questions you marked, grouped by paper.

4. Unbookmark one from the Bookmarks screen. It disappears.
5. **Reload the page** and return to Bookmarks — your marks survived.

> Reloading matters: it proves the bookmarks are in Firestore, not just React state.

---

## 6. PDF export

1. Open any paper → click **Download**.

**Expect:** a real `.pdf` file, not `.txt`.

2. **Open it.** Check: header, questions in order, answers and solutions, page numbers,
   and that long solutions wrap rather than running off the edge.

---

## 7. Take a quiz

1. **Quiz** → pick **CPE 508**.
2. Select one or two topics, set questions to 5, turn **Timed Quiz** on (5 min),
   leave **Immediate Feedback** on.
3. **Start Quiz.**

**Check as you go:**

- Timer counts down.
- On a multiple-choice question, pick a wrong answer — it marks incorrect and reveals
  the solution.
- On a theory question, type a real answer and submit — it's graded with feedback.
- Question count advances correctly.

4. Finish. **Expect:** marks earned, percentage, and a per-question breakdown.

> **Note:** without `GEMINI_API_KEY`, theory grading returns canned feedback. It looks
> real. If you're demonstrating AI marking, set the key first.

---

## 8. Forum

1. **Forum** → pick a course → **New Thread**. Give it a title and body. Post.
2. **Expect:** the thread appears at the top.
3. Open it, post a reply, like the thread and the reply.
4. **Reload.** Everything persisted.

### Check it's live *(new — 8 Sep)*

5. Open the same thread in **two browser windows** side by side.
6. Post a reply in one.

**Expect:** it appears in the other **without a reload.** Threads and replies both
stream now, so the reply count and views update live too.

> This changed on 8 Sep. Replies moved into their own subcollection, so two people
> replying at the same moment no longer overwrite each other — worth trying with a
> teammate.

### Report a post

7. On a thread, click **Report**. Enter a reason at the prompt.
8. Go to **Admin Panel → Flagged Posts**.

**Expect:** the thread you reported, with its reason.

9. Dismiss or remove it. **Reload** and confirm the action stuck.

---

## 9. Upload and approval — the full loop

This is the pipeline the whole project is about. Do it end to end.

1. **Upload** in the sidebar.
2. Drop in an image or PDF of a past paper. *(No scan handy? Any image works — OCR
   returns sample text without an API key.)*
3. **Expect:** metadata auto-detected from the filename, shown under "Auto-detected".
4. Click **Extract Text.** Text appears in the box.
5. *(Optional)* **Clean with AI** to tidy the transcription.
6. Click **Submit for Admin Review.**

**Expect:** "Submitted! Awaiting admin approval."

### Approve it

7. **Repository** in the sidebar → **Pending Approval**.
8. **Expect:** your submission listed with a text preview.
9. Click **Approve.**

### Confirm it reaches students

10. Go to **PQ Library.**

**Expect: your paper is now there.** This is the single most important check in the
script — this exact path was broken, and it's what the whole fix was for.

11. Check **Quiz** and **Trends** show it too.

---

## 10. Roles

1. **Admin Panel → Manage Roles.**
2. **Expect:** every registered user with a role dropdown.
3. Change someone to **lecturer**.
4. **Expect:** the change saves, and the role counts above update immediately.
5. Try changing **your own** role — it should be blocked. *(Otherwise you'd remove
   your own access to this screen.)*

> **After deploy, test this properly:** sign up a fresh account. It must come out as a
> **student** — no role picker, no admin code. Then promote it here and confirm the
> new permissions apply. If a fresh sign-up can pick a role, the rules didn't apply —
> check you deployed to the named database, not `(default)`.

---

## 11. Student's view

1. Sign out. Sign up a new account as a student.

**Expect the sidebar to show only:** PQ Library · Quiz · Bookmarks · Forum · Trends.
No Upload, Repository or Admin Panel.

2. Confirm they can read approved papers, take quizzes, bookmark, and post in the
   forum.

> **After deploy:** also confirm a student can't see *pending* questions. Submit
> something as a lecturer, leave it unapproved, and check it's invisible to students.

---

## 12. Production build *(before deploying)*

```bash
npm run build
npm start          # http://localhost:3000
```

1. Open it. **Expect:** the demo login button is **gone**, and sign-up offers
   **Student only**.
2. Sign in with a real account and spot-check the Library and a quiz.
3. Confirm the AI features respond — they 404'd in production before `server.js`.

Quick automated confirmation the credentials aren't shipped:

```bash
grep -c "admin123\|OAU_ADMIN_2024" dist/assets/*.js    # expect 0
```

---

## Checklist

- [ ] Empty state correct before seeding *(the original bug)*
- [ ] Seed publishes; second run doesn't duplicate
- [ ] Library, Quiz and Trends all agree
- [ ] Bookmarks persist across reload
- [ ] Download produces a readable PDF
- [ ] Quiz scores, times, and shows solutions
- [ ] Forum thread, reply and like persist
- [ ] Reply appears in a second window without reloading
- [ ] Report reaches the Admin Panel
- [ ] **Upload → approve → appears in Library**
- [ ] Manage Roles works; self-demotion blocked
- [ ] Student sidebar is correctly limited
- [ ] Production build hides demo credentials
- [ ] *(After deploy)* fresh sign-up is a student
- [ ] *(After deploy)* students can't see pending questions

---

## If something fails

| Symptom | Likely cause |
| --- | --- |
| "Missing or insufficient permissions" | Rules deployed but the first admin was never promoted — see [FIREBASE-SETUP.md](FIREBASE-SETUP.md) |
| Library empty after seeding | Check the browser console; confirm you're signed in as admin |
| Google sign-in fails in production | Deployed domain not in Authentication → Authorized domains |
| AI features 404 | Deployed statically instead of running `npm start` |
| AI output looks canned | `GEMINI_API_KEY` not set — mock data, by design |
| Fresh sign-up can pick a role | Rules didn't apply; check you targeted the named database |

---

*Setup: [FIREBASE-SETUP.md](FIREBASE-SETUP.md) · Current state: [STATUS.md](STATUS.md) ·
Open work: [TODO.md](TODO.md)*
