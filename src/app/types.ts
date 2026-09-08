export type Role = "student" | "lecturer" | "admin";
export type View = "library" | "quiz" | "forum" | "upload" | "trends" | "admin" | "repository" | "bookmarks";
export type AuthMode = "login" | "register";
export type QuizStep = "setup" | "taking" | "results";

export interface User { name: string; email: string; role: Role; avatar: string; }

export interface PQQuestion {
  id: string;
  section: string;
  number: string;
  text: string;
  marks: number;
  topic: string;
  frequency: number;
  answer: string;
  solution: string;
  type: "fillblank" | "theory" | "calculation" | "objective" | "mcq";
  options?: string[];
}

export interface PQFile {
  id: string;
  courseCode: string;
  courseTitle: string;
  department: string;
  faculty: string;
  session: string;
  semester: string;
  year: number;
  instructions: string;
  uploadedBy: string;
  uploadDate: string;
  totalMarks: number;
  approved: boolean;
  questions: PQQuestion[];
}

export type FirestoreDate = number | string | Date | { toMillis: () => number };
export type QuestionStatus = "pending" | "approved" | "rejected";

export interface QuestionRecord {
  id: string;
  courseCode?: string;
  courseTitle?: string;
  department?: string;
  faculty?: string;
  session?: string;
  semester?: string;
  year?: number;
  instructions?: string;
  section?: string;
  number?: string;
  marks?: number;
  topic?: string;
  frequency?: number;
  questionText?: string;
  text?: string;
  solutionText?: string;
  solution?: string;
  answer?: string;
  type?: PQQuestion["type"];
  options?: string[];
  status?: QuestionStatus;
  createdAt?: FirestoreDate;
  createdBy?: string;
}

export type QuestionWriteRecord = Omit<QuestionRecord, "id">;

export interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  role?: Role;
  bookmarkedQuestions?: string[];
}

export interface FlaggedThreadRecord {
  id: string;
  title?: string;
  authorName?: string;
  flaggedBy?: string;
  flagReason?: string;
}

export interface GeneratedQuizRecord {
  questionText?: string;
  solution?: string;
  answer?: string;
  options?: string[];
  marks?: number;
  topic?: string;
}

export type ForumRoleLabel = "Admin" | "Lecturer" | "Student";

export interface ForumComment {
  id: string;
  author: string;
  role: ForumRoleLabel;
  avatar: string;
  date: string;
  text: string;
  likes: number;
  isLiked: boolean;
  rawLikes: string[];
  legacy?: boolean;
}

export interface ForumThread {
  id: string;
  courseId: string;
  title: string;
  author: string;
  authorAvatar: string;
  date: string;
  views: number;
  likes: number;
  replies: number;
  pinned: boolean;
  flagged: boolean;
  body: string;
  legacyComments: ForumComment[];
  rawLikes: string[];
}
