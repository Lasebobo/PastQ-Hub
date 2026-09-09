# Deploying to Vercel

The repo is wired for Vercel. This is what to click, in order.

**Two of these steps are not optional**, and both are easy to skip:

- **Set `GEMINI_API_KEY`** or OCR, grading, cleanup and quiz generation silently
  return canned demo data on the live site.
- **Deploy the Firestore rules** (see [FIREBASE-SETUP.md](FIREBASE-SETUP.md)) or the
  database stays open to anyone with the URL.

---

## Why deployments are currently blocked

Every deployment since `bb30ad5` has failed with **"Deployment was blocked"** — not a
build failure. The pattern:

| Commit author | Result |
| --- | --- |
| Lasebobo | ✅ deployed |
| Everyone else | ❌ blocked |

The Vercel project sits under a personal **Hobby** account (`lasebobos-projects`).
Hobby plans only build commits authored by the account owner; pushes from other
collaborators are blocked. Nothing in the code causes this.

**Pick one:**

1. **Transfer the project to a Vercel Team** — the proper fix. Teams allow multiple
   git authors. Free for small teams at time of writing; check current pricing.
2. **The owner deploys manually.** From their machine:
   `npx vercel --prod`. Their authorship, so it builds. Fine for a defence.
3. **Own the deploys from one account.** Everyone pushes to GitHub; the owner presses
   deploy. Slowest loop, no cost.

Confirm the exact reason in the Vercel dashboard before paying for anything — the
GitHub API reports *that* a deploy was blocked, not *why*.

---

## 1. Environment variable

Vercel dashboard → **Settings → Environment Variables**:

| Name | Value | Environments |
| --- | --- | --- |
| `GEMINI_API_KEY` | your Gemini API key | Production, Preview, Development |

Without it the app still works end to end — every AI endpoint returns realistic mock
data. That is deliberate, and it is also the trap: **the demo looks fine while the AI
does nothing.** If you are demonstrating OCR or AI marking, set the key and confirm
the output is not the canned sample text.

Redeploy after adding it. Environment variables are read at request time, but existing
deployments keep the build they shipped with.

---

## 2. Deploy

Push to `main`, or run `npx vercel --prod`.

`vercel.json` already sets everything:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": { "api/*.js": { "maxDuration": 60, "memory": 1024 } },
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

Two of those lines exist for specific reasons:

- **`maxDuration: 60`** — the default is 10 seconds. Gemini OCR on a full exam page
  routinely takes longer, so on the default the flagship feature would time out.
- **The rewrite excludes `/api/`** — a blanket SPA rewrite would swallow the API
  routes and serve `index.html` to every endpoint.

---

## 3. Verify the live site

Run the checks from [DEMO-SCRIPT.md](DEMO-SCRIPT.md) §12 against the deployed URL, plus:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Content-Type: application/json" -d '{"text":"hello"}' \
  https://YOUR-URL.vercel.app/api/clean-text        # expect 200, not 404
```

**A 404 there means the functions didn't deploy** — the single most likely failure,
and invisible from the UI because the app degrades to mock data.

Then confirm the demo credentials are absent:

```bash
curl -s https://YOUR-URL.vercel.app/assets/index-*.js | grep -c "admin123"   # expect 0
```

---

## How the API is wired

The four endpoints exist once, in `lib/ai-handlers.js`. Three thin adapters call them,
so dev, a Node host and Vercel cannot drift apart:

| Adapter | Used by |
| --- | --- |
| `lib/node-adapter.js` | `vite.config.ts` (dev) and `server.js` (any Node host) |
| `lib/vercel-adapter.js` | `api/*.js` (Vercel Serverless Functions) |

`api/` holds only routing — four files, five lines each. **Adding an endpoint means
adding it to `lib/ai-handlers.js` and dropping a matching file in `api/`.** Never put
logic in `api/`; that split is what caused the original OCR field-name bug.

`server.js` is still supported and still tested. Use it for any non-Vercel Node host —
Render, Railway, Cloud Run, a VPS — with `npm run build && npm start`.

> **Do not deploy to GitHub Pages or any static host.** They serve `dist/` only, so
> all four AI routes return 404 while the app looks like it loaded fine.

---

## The 4.5 MB upload limit

Vercel rejects request bodies over 4.5 MB. Base64 inflates a file by about a third, so
a 3.4 MB phone photo already exceeds the cap — and most photos of an exam page are
larger than that.

`src/app/utils/downscale.ts` handles this: before an image is sent to `/api/ocr` it is
scaled to a 2200 px longest edge and re-encoded as JPEG, stepping the quality down
until it fits under 4 MB. Text stays legible, and OCR is no slower for it. PDFs pass
through untouched. If the canvas path fails for any reason it falls back to the
original bytes, so a browser quirk degrades rather than blocks.

Anything that still exceeds the cap returns a **413** explaining why, rather than a
generic 500.

This is the one limit that behaves differently in dev than in production — the dev
server has no body cap, so an oversized upload works locally and fails deployed.

---

## Checklist

- [ ] Deployment unblocked (team, or owner deploys)
- [ ] `GEMINI_API_KEY` set for Production and Preview
- [ ] Redeployed after adding it
- [ ] `/api/clean-text` returns 200 on the live URL
- [ ] AI output is real, not the canned sample text
- [ ] Demo credentials absent from the live bundle
- [ ] OCR tested with a real phone photo
- [ ] **Firestore rules deployed** — [FIREBASE-SETUP.md](FIREBASE-SETUP.md)
- [ ] Deployed domain added to Firebase **Authorized domains**, or Google sign-in fails

---

*Firebase setup: [FIREBASE-SETUP.md](FIREBASE-SETUP.md) ·
Feature walkthrough: [DEMO-SCRIPT.md](DEMO-SCRIPT.md) ·
Current state: [STATUS.md](STATUS.md)*
