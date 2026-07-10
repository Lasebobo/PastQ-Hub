import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
export const db = getFirestore(app, "ai-studio-6e4f1bfa-e270-4433-8911-181211d11793");
export const auth = getAuth(app);
