export type Role = 'student' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  name: string;
  bookmarkedQuestions: string[];
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department: string;
  level: string; // e.g. "100", "200"
  semester: string; // e.g. "1st", "2nd"
}

export interface Question {
  id: string;
  courseId: string;
  courseCode: string; // denormalized for easier query
  year: number; // e.g. 2024
  topic: string; // e.g. "Calculus"
  questionText: string;
  solutionText: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'objective' | 'theory';
  status: 'pending' | 'approved';
  tags: string[];
  createdAt: number;
  createdBy: string;
}

export interface TrendData {
  topic: string;
  count: number;
}
