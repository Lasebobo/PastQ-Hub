// POST /api/generate-quizzes — derive practice MCQs from a paper.
// Logic lives in lib/ai-handlers.js, shared with the dev server and server.js.
import { generateQuizzes } from '../lib/ai-handlers.js';
import { vercelHandler } from '../lib/vercel-adapter.js';

export default vercelHandler(generateQuizzes);
