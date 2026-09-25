import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";

import { db } from "../lib/firebase";

export async function deleteThreadAndComments(threadId: string) {
  const commentsSnap = await getDocs(collection(db, 'threads', threadId, 'comments'));
  for (let i = 0; i < commentsSnap.docs.length; i += 450) {
    const batch = writeBatch(db);
    commentsSnap.docs.slice(i, i + 450).forEach(commentDoc => batch.delete(commentDoc.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'threads', threadId));
}
