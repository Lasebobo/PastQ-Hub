const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

async function listBuckets() {
  const [buckets] = await getStorage().getBuckets();
  console.log("Available buckets:");
  buckets.forEach(bucket => {
    console.log(bucket.name);
  });
  process.exit(0);
}

listBuckets().catch(err => {
  console.error(err);
  process.exit(1);
});
