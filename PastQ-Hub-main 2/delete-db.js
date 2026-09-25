import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0333512564",
  appId: "1:100362481824:web:d74441c76b53d2fa0019c5",
  apiKey: "AIzaSyCfcsbGlDm7JAY8YjkSOq8xX_52zKQopso",
  authDomain: "gen-lang-client-0333512564.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793",
  storageBucket: "gen-lang-client-0333512564.firebasestorage.app",
  messagingSenderId: "100362481824",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793");

async function wipe() {
  console.log("Fetching questions...");
  const qsSnap = await getDocs(collection(db, 'questions'));
  console.log(`Found ${qsSnap.docs.length} questions. Deleting...`);
  
  let deletedCount = 0;
  await Promise.all(qsSnap.docs.map(async (doc) => {
    await deleteDoc(doc.ref);
    deletedCount++;
  }));
  console.log(`Deleted ${deletedCount} questions.`);
  
  console.log("Fetching threads...");
  const thSnap = await getDocs(collection(db, 'threads'));
  console.log(`Found ${thSnap.docs.length} threads. Deleting...`);
  
  deletedCount = 0;
  await Promise.all(thSnap.docs.map(async (doc) => {
    await deleteDoc(doc.ref);
    deletedCount++;
  }));
  console.log(`Deleted ${deletedCount} threads.`);
}

wipe().then(() => console.log("Done")).catch(console.error);
