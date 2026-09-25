import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBm2xmFefDs3p4KKzv7khXTNidf9ReB1xg",
  authDomain: "pastq-hub-2d992.firebaseapp.com",
  projectId: "pastq-hub-2d992",
  storageBucket: "pastq-hub-2d992.firebasestorage.app",
  messagingSenderId: "813343721732",
  appId: "1:813343721732:web:a9fa0726ba630dff6ca851",
  measurementId: "G-SX8RP0HMP4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// Holds the actual uploaded past-question files (PDF/photo), so a paper can
// be downloaded exactly as it was submitted instead of being reconstructed
// from OCR text. See UploadView.tsx and PQViewer.tsx.
export const storage = getStorage(app);
// Increase timeout to 10 minutes to prevent large PDFs from timing out on slow connections
storage.maxUploadRetryTime = 600000;
