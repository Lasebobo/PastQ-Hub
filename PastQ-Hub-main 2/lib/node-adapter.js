/**
 * Bridges the framework-agnostic handlers in ./ai-handlers.js to Node's
 * req/res objects. Used by both the Vite dev middleware and server.js, so
 * request parsing and error shapes stay identical in dev and production.
 */

import { routes } from './ai-handlers.js';

const MAX_BODY_BYTES = 25 * 1024 * 1024; // scanned exam pages are large

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Request body was not valid JSON.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Handles one API request. Returns true if the route was recognised and answered.
 */
export async function handleApiRequest(req, res, routePath) {
  const handler = routes[routePath];
  if (!handler) return false;

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method Not Allowed' });
    return true;
  }

  try {
    const body = await readJsonBody(req);
    const { status, body: payload } = await handler(body, process.env.GEMINI_API_KEY);
    send(res, status, payload);
  } catch (err) {
    console.error(`[api] ${routePath} failed:`, err);
    send(res, err?.status || 500, { error: err?.message || 'Internal Server Error' });
  }
  return true;
}

export { routes };
