import type { FirestoreDate, PQFile, PQQuestion, QuestionRecord } from "../types";

function toDateLabel(value?: FirestoreDate) {
  if (value && typeof value === "object" && "toMillis" in value) {
    return new Date(value.toMillis()).toISOString().split("T")[0];
  }
  return new Date(value || Date.now()).toISOString().split("T")[0];
}

function sessionFor(question: QuestionRecord) {
  if (question.session) return question.session;
  return question.year ? `${question.year}/${question.year + 1}` : "2024/2025";
}

export function reconstructPQFiles(questions: QuestionRecord[]): PQFile[] {
  const groups: Record<string, QuestionRecord[]> = {};
  const topicCounts = questions.reduce<Record<string, number>>((acc, q) => {
    const topic = q.topic || "General";
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {});

  questions.forEach(q => {
    const key = `${q.courseCode || "General"}_${sessionFor(q)}_${q.semester || "First"}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  });

  return Object.keys(groups).map(key => {
    const qs = groups[key];
    const sample = qs[0];
    const mappedQuestions: PQQuestion[] = qs.map(q => {
      const topic = q.topic || "General";
      return {
        id: q.id,
        section: q.section || "A",
        number: q.number || "1",
        text: q.questionText || q.text || "",
        marks: q.marks || 1,
        topic,
        frequency: topicCounts[topic] || 1,
        answer: q.answer || "",
        solution: q.solutionText || q.solution || "",
        type: q.type || "theory",
        options: q.options || undefined
      };
    });

    mappedQuestions.sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });

    return {
      id: key,
      courseCode: sample.courseCode || "General",
      courseTitle: sample.courseTitle || sample.courseCode || "General",
      department: sample.department || "General",
      faculty: sample.faculty || "Technology",
      session: sessionFor(sample),
      semester: sample.semester || "First",
      year: sample.year || 2024,
      instructions: sample.instructions || "TIME ALLOWED: 2 Hours. Attempt all questions.",
      uploadedBy: sample.createdBy === "system" ? "Dr. Kwame Asante" : "Lecturer",
      uploadDate: toDateLabel(sample.createdAt),
      totalMarks: mappedQuestions.reduce((sum, q) => sum + q.marks, 0) || 100,
      approved: sample.status === "approved",
      questions: mappedQuestions
    };
  });
}
