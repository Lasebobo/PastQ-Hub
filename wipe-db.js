import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "pastq-hub-b66a6"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function wipe() {
  const snap = await getDocs(collection(db, 'questions'));
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'questions', d.id));
    count++;
  }
  console.log(`Wiped ${count} questions.`);
}
wipe().catch(console.error);
