const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'pastq-hub-2d992.firebasestorage.app'
});

const bucket = getStorage().bucket();

bucket.setCorsConfiguration([
  {
    origin: ['*'],
    method: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    maxAgeSeconds: 3600
  }
]).then(() => {
  console.log("CORS set successfully! Your storage bucket is now ready to receive uploads.");
  process.exit(0);
}).catch(err => {
  console.error("Failed to set CORS:", err);
  process.exit(1);
});
