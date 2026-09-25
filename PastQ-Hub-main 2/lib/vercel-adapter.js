/**
 * Bridges the shared handlers in ./ai-handlers.js to Vercel's Serverless Function
 * signature, so `api/*.js` stays a thin routing layer with no logic of its own.
 *
 * Three adapters now wrap the same handlers — Vite dev middleware, server.js, and
 * this one. That is deliberate: the logic exists once, in ai-handlers.js. Adding an
 * endpoint means adding it there plus a four-line file under api/.
 */

/** Vercel Serverless Functions reject request bodies above this. */
const VERCEL_BODY_LIMIT_MB = 4.5;

/**
 * Wraps a handler from ai-handlers.js as a Vercel function.
 * @param {(body: any, apiKey?: string) => Promise<{status: number, body: any}>} handler
 */
export function vercelHandler(handler) {
  return async function (req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      // Vercel parses application/json into req.body. Guard against it arriving as a
      // raw string (a wrong or missing Content-Type) rather than throwing on access.
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          res.status(400).json({ error: 'Request body was not valid JSON.' });
          return;
        }
      }

      const { status, body: payload } = await handler(body || {}, process.env.GEMINI_API_KEY);
      res.status(status).json(payload);
    } catch (err) {
      // A scan that squeaks past the client-side downscale lands here as a platform
      // 413. Say so plainly rather than surfacing a generic 500.
      if (err?.statusCode === 413 || /too large|entity too large/i.test(err?.message || '')) {
        res.status(413).json({
          error: `Image is too large to upload. Vercel caps request bodies at ${VERCEL_BODY_LIMIT_MB} MB. `
               + 'Try a smaller photo, or crop it before uploading.',
        });
        return;
      }
      console.error('[api] handler failed:', err);
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  };
}
