// POST /api/clean-text — tidy raw OCR output into readable Markdown.
// Logic lives in lib/ai-handlers.js, shared with the dev server and server.js.
import { cleanText } from '../lib/ai-handlers.js';
import { vercelHandler } from '../lib/vercel-adapter.js';

export default vercelHandler(cleanText);
