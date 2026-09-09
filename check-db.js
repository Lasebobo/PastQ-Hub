import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function check() {
  const qsSnap = await getDocs(collection(db, 'questions'));
  console.log(`There are ${qsSnap.docs.length} questions in the database.`);
  if (qsSnap.docs.length > 0) {
    const first = qsSnap.docs[0].data();
    console.log("Example question courseCode:", first.courseCode);
  }
}

check().catch(console.error);
