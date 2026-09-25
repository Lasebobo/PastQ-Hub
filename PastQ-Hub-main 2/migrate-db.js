import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

// OLD PROJECT
const oldApp = initializeApp({
  projectId: "gen-lang-client-0333512564",
  appId: "1:100362481824:web:d74441c76b53d2fa0019c5",
  apiKey: "AIzaSyCfcsbGlDm7JAY8YjkSOq8xX_52zKQopso",
  authDomain: "gen-lang-client-0333512564.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793",
}, "oldApp");
const oldDb = getFirestore(oldApp, "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793");

// NEW PROJECT
const newApp = initializeApp({
  apiKey: "AIzaSyBm2xmFefDs3p4KKzv7khXTNidf9ReB1xg",
  authDomain: "pastq-hub-2d992.firebaseapp.com",
  projectId: "pastq-hub-2d992",
}, "newApp");
const newDb = getFirestore(newApp);

async function migrate() {
  console.log("Fetching questions from old database...");
  const snapshot = await getDocs(collection(oldDb, "questions"));
  
  console.log(`Found ${snapshot.docs.length} questions. Migrating...`);
  
  let count = 0;
  for (const oldDoc of snapshot.docs) {
    const data = oldDoc.data();
    await setDoc(doc(newDb, "questions", oldDoc.id), data);
    count++;
    console.log(`Migrated document ${count}/${snapshot.docs.length}: ${oldDoc.id}`);
  }
  
  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
