import { handleApiRequest } from '../lib/node-adapter.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Extract the pathname from req.url (e.g. /api/extract-text)
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  
  if (await handleApiRequest(req, res, pathname)) {
    return;
  }
  
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'API route not found' }));
}
