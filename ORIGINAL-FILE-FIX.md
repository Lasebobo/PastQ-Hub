# Original-File Preservation Fix

Addresses defense feedback: *"the system should be able to analyse the PQ but
still give the uploaded doc when users want to download"* and *"the format
should look like a real PQ."*

## Root cause

`UploadView.tsx` converted the uploaded file to base64, sent it to `/api/ocr`
for text extraction, then discarded it. Only the extracted text ever reached
Firestore. `PQViewer.tsx`'s "Download" button then rebuilt a brand-new PDF
from that text via jsPDF — different fonts, no letterhead, no diagrams, none
of the real paper's layout. The original document did not exist anywhere in
the system by the time a student clicked Download, which is why it couldn't
look like — or be — the real thing.

Firebase Storage was configured (a bucket exists in `firebase.ts`) but the
Storage SDK was never imported or used anywhere in the codebase.

## What changed

| File | Change |
|---|---|
| `src/app/lib/firebase.ts` | Added and exported `storage` (`getStorage(app)`) |
| `src/app/types.ts` | Added `originalFileUrl` / `originalFileName` / `originalFileType` to `QuestionRecord` and `PQFile` |
| `src/app/features/upload/UploadView.tsx` | Uploads the raw file to Storage (`papers/{courseCode}/{session}/{timestamp}_{filename}`) before writing question docs; attaches the resulting URL to every row from that paper; added upload progress state and error surfacing |
| `src/app/services/papers.ts` | `reconstructPQFiles` now passes the original-file fields through onto the grouped `PQFile` |
| `src/app/components/papers/PQViewer.tsx` | Added `downloadOriginal()` (fetches and saves the real file); kept the old jsPDF logic as `downloadReconstructed()`, now used **only** as a fallback for papers with no stored original; added an "Original Paper" / "Analysis & Practice" tab toggle — the original tab embeds the real PDF/image directly, so what students see by default *is* the real paper |
| `storage.rules` (new) | Read: any signed-in user. Write: staff only (admin/lecturer), capped at 25 MB, PDF or image only. Mirrors the role-check pattern in `firestore.rules` |
| `firebase.json` | Registered `storage.rules` and added the Storage emulator (port 9199) |

## What this does not fix yet

- **Papers already in the database** were uploaded before this fix and have
  no original file on Storage. They fall back to `downloadReconstructed()`
  and show only the "Analysis & Practice" view — there's nothing to embed.
  Re-uploading them is the only way to backfill a real scan.
- **Storage rules are unverified for this project's setup.** This Firestore
  database is named (`ai-studio-6e4f1bfa-e270-4433-8911-181211d11793`), not
  `(default)`, and the cross-service `firestore.get()` call from Storage
  rules is documented and commonly tested only against `(default)`. Test
  both roles (student, lecturer) against the emulator before deploying —
  see the warning comment at the top of `storage.rules` for a fallback plan
  (custom claims) if the cross-database call doesn't work.
- **No automated test coverage for `storage.rules`** — `rules-test.mjs`
  only exercises Firestore. The 48/48 assertion count in `STATUS.md` does
  not include these new rules.
- Typecheck and production build both pass with these changes (verified
  9 Sep 2026). Nobody has clicked through the actual upload → download
  round-trip against live Firebase yet — that still needs a human pass,
  same as everything else on the outstanding list in `STATUS.md`.
