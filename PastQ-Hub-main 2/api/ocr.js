// POST /api/ocr — transcribe an uploaded exam paper.
// Logic lives in lib/ai-handlers.js, shared with the dev server and server.js.
import { ocr } from '../lib/ai-handlers.js';
import { vercelHandler } from '../lib/vercel-adapter.js';

export default vercelHandler(ocr);
