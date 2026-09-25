import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// NEW PROJECT
const newApp = initializeApp({
  apiKey: "AIzaSyBm2xmFefDs3p4KKzv7khXTNidf9ReB1xg",
  authDomain: "pastq-hub-2d992.firebaseapp.com",
  projectId: "pastq-hub-2d992",
}, "newApp");
const newDb = getFirestore(newApp);

const dummyQuestions = [
  {
    courseCode: "CPE 508",
    courseTitle: "ARTIFICIAL INTELLIGENCE",
    department: "Computer Engineering",
    faculty: "Technology",
    session: "2023/2024",
    semester: "Second semester/Rain semester",
    year: 2023,
    level: "500 Level",
    instructions: "Attempt all questions.",
    section: "A",
    number: "1",
    marks: 20,
    topic: "Search Algorithms",
    frequency: 3,
    questionText: "Explain the difference between A* search and Dijkstra's algorithm. Provide an example heuristic.",
    solutionText: "Awaiting lecturer/admin solution.",
    type: "theory",
    status: "pending",
    createdAt: Date.now(),
    createdBy: "admin_user"
  },
  {
    courseCode: "MTH 101",
    courseTitle: "ELEMENTARY MATHEMATICS I",
    department: "Mathematics",
    faculty: "Science",
    session: "2023/2024",
    semester: "First semester/Harmattan semester",
    year: 2023,
    level: "100 Level",
    instructions: "Answer any 3 questions.",
    section: "A",
    number: "1",
    marks: 15,
    topic: "Calculus",
    frequency: 5,
    questionText: "Find the derivative of f(x) = 3x^2 + 2x - 5 using first principles.",
    solutionText: "Awaiting lecturer/admin solution.",
    type: "theory",
    status: "pending",
    createdAt: Date.now(),
    createdBy: "admin_user"
  }
];

async function seed() {
  console.log("Seeding dummy data to new database...");
  for (const q of dummyQuestions) {
    await addDoc(collection(newDb, "questions"), q);
    console.log(`Added ${q.courseCode} question.`);
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
