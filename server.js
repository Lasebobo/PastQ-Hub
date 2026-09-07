/**
 * Production server.
 *
 * `vite build` produces static files only, so the /api/* routes that live in the
 * Vite dev middleware simply do not exist in a deployed build — OCR, AI grading,
 * OCR cleanup and quiz generation all 404. This serves them for real, alongside
 * the built front-end.
 *
 *   npm run build && npm start
 *
 * Set GEMINI_API_KEY to enable the real AI calls; without it every endpoint
 * returns mock data and the app still works end to end.
 *
 * No dependencies — Node's built-in http module is enough for four JSON routes
 * and a static directory.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './api/node-adapter.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

async function serveFile(res, filePath, { immutable = false } = {}) {
  const data = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] || 'application/octet-stream');
  // Vite fingerprints everything under /assets, so those are safe to cache hard.
  res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.end(data);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  // 1. API routes — shared with the dev server, so behaviour cannot drift.
  if (await handleApiRequest(req, res, pathname)) return;

  // 2. Static files from dist/. normalize() + the prefix check keep "../" traversal out.
  const candidate = normalize(join(DIST, pathname));
  if (!candidate.startsWith(DIST)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const info = await stat(candidate);
    if (info.isFile()) {
      await serveFile(res, candidate, { immutable: pathname.startsWith('/assets/') });
      return;
    }
  } catch {
    // fall through to the SPA entry point
  }

  // 3. Single-page app fallback — any unmatched path renders index.html.
  try {
    await serveFile(res, join(DIST, 'index.html'));
  } catch {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('dist/index.html not found. Run "npm run build" first.');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PastQ-Hub running on http://${HOST}:${PORT}`);
  console.log(
    process.env.GEMINI_API_KEY
      ? '  AI endpoints: live (GEMINI_API_KEY is set)'
      : '  AI endpoints: mock data (set GEMINI_API_KEY to enable real calls)'
  );
});
