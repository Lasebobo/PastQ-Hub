/**
 * The four AI endpoints, as plain functions.
 *
 * This is the ONE implementation. The Vite dev server (vite.config.ts) and the
 * production server (server.js) both import from here, so a change to a payload
 * shape can no longer land in one and not the other — which is exactly how the
 * OCR field-name mismatch survived for months.
 *
 * Each handler takes the parsed request body and returns { status, body }.
 * No framework types, no Node globals beyond fetch and process.env.
 *
 * With no GEMINI_API_KEY set, every handler returns realistic mock data so the app
 * is fully demoable offline. Note that mock responses do not exercise the request
 * shape at all — if you change a payload, test it with a real key.
 */

const GEMINI_MODEL = 'gemini-2.5-flash';

function geminiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

async function callGemini(apiKey, payload) {
  const response = await fetch(geminiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini responded ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

function firstText(result) {
  return result?.candidates?.[0]?.content?.parts?.[0]?.text;
}

// ─── mock data (used when GEMINI_API_KEY is unset) ────────────────────────────

const MOCK_OCR_TEXT = `OBAFEMI AWOLOWO UNIVERSITY ILE-IFE, NIGERIA
FACULTY OF TECHNOLOGY
DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING

CPE 508 Computer System Project Management
Rain Semester Examination — 2022/2023 Academic Session
July, 2024

TIME ALLOWED: 2 Hours
ATTEMPT ALL QUESTIONS IN SECTION A AND ANY FOUR (4) QUESTIONS IN SECTION B

────────────────────────────────────────────
SECTION A (10 Marks) — Fill in the Blank

1) The output of every activity is known as Deliverable.
2) A dependency relationship type where the successor activity cannot start unless the predecessor activity finishes is called Finish-to-Start (FS).
3) A mark that signifies the end of a set of activities in a project is known as Milestone.
4) Work Breakdown Structure (WBS) is an amazing tool in project management that shows a hierarchical breakdown of work activities...
5) A type of dependency where activities stay the same, yet, the order changes, is called Discretionary Dependency (Soft Logic).
6) A process to 'mitigate the adverse effects of loss' in Project Management is called: Risk Management / Risk Mitigation.
7) The ultimate aim of a Project is to Achieve specific goals/objectives within defined time, cost, and scope constraints.
8) External stakeholders can be Customers/Clients and Government/Regulatory bodies.
9) Decision tree analysis is majorly used for Risk analysis and decision making under uncertainty.
10) In making decision, it means you have Alternatives / Choices.

────────────────────────────────────────────
SECTION B

QUESTION #1 (15 Marks)
a) Correlate between Openness in the group and confidentiality as norms of a project team.
b) There is diversity in IT project; why do you need a legal adviser?
c) A project is proposed to develop a transcript system for the university...

QUESTION #5 (15 Marks) — Calculations
a) What does SPI value of 1 mean?
b) AC = 800, EV = 780, PV = 810. Calculate the schedule variance.
c) AC = 2100, EV = 1500. What is the cost variance?`;

const MOCK_QUIZZES = [
  {
    questionText: 'What is the schedule variance (SV) if EV = 780 and PV = 810?',
    options: [
      'SV = -30 (behind schedule)',
      'SV = +30 (ahead of schedule)',
      'SV = -10 (behind schedule)',
      'SV = +10 (ahead of schedule)',
    ],
    answer: 'SV = -30 (behind schedule)',
    solution: 'SV = EV - PV = 780 - 810 = -30. A negative variance means the project is behind schedule.',
    topic: 'Earned Value Management',
    marks: 5,
  },
  {
    questionText: 'What does a Schedule Performance Index (SPI) value of 1.0 mean?',
    options: [
      'Project is behind schedule',
      'Project is on schedule',
      'Project is ahead of schedule',
      'Project is over budget',
    ],
    answer: 'Project is on schedule',
    solution: 'An SPI of 1.0 indicates that the project is progressing exactly as planned/on schedule.',
    topic: 'Earned Value Management',
    marks: 5,
  },
];

// ─── handlers ─────────────────────────────────────────────────────────────────

/** POST /api/ocr — { imageBase64, mimeType, filename? } → { text } */
export async function ocr(body, apiKey) {
  const { imageBase64, mimeType } = body || {};

  if (!apiKey) return { status: 200, body: { text: MOCK_OCR_TEXT } };

  if (!imageBase64) {
    return { status: 400, body: { error: 'No image provided. Expected an "imageBase64" field.' } };
  }

  const result = await callGemini(apiKey, {
    contents: [{
      parts: [
        {
          text: 'Please extract all text from this exam question paper. Format the output cleanly, '
              + 'identifying question numbers, sub-questions (a, b, c), and any instructions. '
              + 'Do not solve the questions, just transcribe them accurately.',
        },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
      ],
    }],
  });

  return { status: 200, body: { text: firstText(result) || 'No text extracted.' } };
}

/** POST /api/grade — { question, solution, studentAnswer, marks } → { score, feedback } */
export async function grade(body, apiKey) {
  const { question, solution, studentAnswer, marks } = body || {};
  const total = marks || 5;

  if (!apiKey) {
    const looksAnswered = String(studentAnswer || '').trim().length > 3;
    return {
      status: 200,
      body: {
        score: looksAnswered ? total : 0,
        feedback: looksAnswered
          ? 'Excellent attempt. Your calculations match the expected answer.'
          : 'The answer seems incomplete or incorrect. Please review the step-by-step solution.',
      },
    };
  }

  const result = await callGemini(apiKey, {
    contents: [{
      parts: [{
        text: `You are an expert university examiner grading a student's answer to a past exam question.

Question: "${question}"
Reference Solution/Answer: "${solution}"
Student's Answer: "${studentAnswer}"
Total Question Marks: ${total}

Evaluate the student's answer. Give a score (integer) out of ${total} and a short, encouraging feedback message (max 2 sentences) describing what they did right or wrong.
Respond ONLY with a JSON object in this format:
{ "score": number, "feedback": "string" }`,
      }],
    }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  let parsed;
  try {
    parsed = JSON.parse(firstText(result) || '{}');
  } catch {
    parsed = {};
  }

  // Never let the model hand back a score outside the mark range.
  const raw = Number(parsed.score);
  const score = Number.isFinite(raw) ? Math.max(0, Math.min(total, Math.round(raw))) : 0;

  return {
    status: 200,
    body: { score, feedback: parsed.feedback || 'Answer submitted.' },
  };
}

/** POST /api/clean-text — { text } → { cleanedText } */
export async function cleanText(body, apiKey) {
  const { text } = body || {};

  if (!apiKey) {
    return {
      status: 200,
      body: { cleanedText: `${text}\n\n[Demo AI: Text cleaned and formatted successfully]` },
    };
  }

  const result = await callGemini(apiKey, {
    contents: [{
      parts: [{
        text: `You are an expert transcriber. Clean up and format this raw OCR text of a university exam question paper.
- Fix obvious typos, misspelled words, and OCR formatting glitches.
- Format it cleanly using Markdown, maintaining question numbers and sub-questions (a, b, c).
- Align equations and math notations clearly.
- Remove scanner noise, page headers, or random artifacts.
- Do not solve the questions, just return the beautifully formatted transcript.

Raw OCR Text:
"${text}"`,
      }],
    }],
  });

  return { status: 200, body: { cleanedText: firstText(result) || text } };
}

/** POST /api/generate-quizzes — { courseCode, session, semester, paperText } → { quizzes } */
export async function generateQuizzes(body, apiKey) {
  const { courseCode, session, semester, paperText } = body || {};

  if (!apiKey) return { status: 200, body: { quizzes: MOCK_QUIZZES } };

  const result = await callGemini(apiKey, {
    contents: [{
      parts: [{
        text: `Based on the following university past question paper, generate 5 high-quality practice multiple-choice questions (MCQs) for students studying this course (${courseCode || 'General'}).

Course Code: ${courseCode || 'General'}
Session: ${session || '2024/2025'}
Semester: ${semester || 'First'}

Paper Content:
"${paperText}"

Each question MUST test key concepts from the paper. Provide:
- questionText (clear, multiple-choice question)
- options (exactly 4 options, including the correct one)
- answer (the exact correct option string)
- solution (a detailed, step-by-step explanation of why it is correct and how to solve it)
- topic (a relevant topic category)
- marks (an integer number of marks, e.g. 5)

Respond ONLY with a JSON object in this format:
{ "quizzes": [ { "questionText": "string", "options": ["string","string","string","string"], "answer": "string", "solution": "string", "topic": "string", "marks": number } ] }`,
      }],
    }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  let parsed;
  try {
    parsed = JSON.parse(firstText(result) || '{"quizzes":[]}');
  } catch {
    parsed = { quizzes: [] };
  }

  return { status: 200, body: { quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [] } };
}

/** Route table shared by the dev middleware and the production server. */
export const routes = {
  '/api/ocr': ocr,
  '/api/grade': grade,
  '/api/clean-text': cleanText,
  '/api/generate-quizzes': generateQuizzes,
};
