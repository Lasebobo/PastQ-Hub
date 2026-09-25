import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function run() {
  console.log("Cleaning up redundant asterisks from database...");
  const snapshot = await getDocs(collection(db, 'questions'));
  let count = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let updated = false;
    const newData = {};
    
    const clean = (str) => {
      if (typeof str !== 'string') return str;
      let res = str.replace(/\*\*/g, ''); 
      res = res.replace(/^\s*\*\s*$/gm, ''); 
      return res;
    };

    ['text', 'questionText', 'answer', 'solution', 'solutionText'].forEach(field => {
      if (data[field]) {
        const cleaned = clean(data[field]);
        if (cleaned !== data[field]) {
          newData[field] = cleaned;
          updated = true;
        }
      }
    });

    if (updated) {
      await updateDoc(doc(db, 'questions', docSnap.id), newData);
      count++;
    }
  }
  
  console.log(`Finished cleaning. Successfully updated ${count} questions in the database.`);
  process.exit(0);
}

run().catch(console.error);
