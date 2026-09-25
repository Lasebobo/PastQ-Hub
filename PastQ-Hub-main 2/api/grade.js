// POST /api/grade — mark a free-text answer against the model solution.
// Logic lives in lib/ai-handlers.js, shared with the dev server and server.js.
import { grade } from '../lib/ai-handlers.js';
import { vercelHandler } from '../lib/vercel-adapter.js';

export default vercelHandler(grade);
