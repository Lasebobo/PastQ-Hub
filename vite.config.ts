import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function ocrMiddlewarePlugin() {
  return {
    name: 'ocr-middleware',
    configureServer(server) {
      server.middlewares.use('/api/ocr', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { imageBase64, mimeType } = data;

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              const mockText = `OBAFEMI AWOLOWO UNIVERSITY ILE-IFE, NIGERIA
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
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: mockText }));
              return;
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: "Please extract all text from this exam question paper. Format the output cleanly, identifying question numbers, sub-questions (a, b, c), and any instructions. Do not solve the questions, just transcribe them accurately." },
                    {
                      inlineData: {
                        mimeType: mimeType || "image/jpeg",
                        data: imageBase64
                      }
                    }
                  ]
                }]
              })
            });

            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "No text extracted.";
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
        });
      });

      server.middlewares.use('/api/grade', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { question, solution, studentAnswer, marks } = data;

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              const correct = studentAnswer.toLowerCase().trim().length > 3;
              const score = correct ? (marks || 5) : 0;
              const feedback = correct 
                ? "Excellent attempt. Your calculations match the expected answer."
                : "The answer seems incomplete or incorrect. Please review the step-by-step solution.";
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ score, feedback }));
              return;
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      text: `You are an expert university examiner grading a student's answer to a past exam question.
                      
                      Question: "${question}"
                      Reference Solution/Answer: "${solution}"
                      Student's Answer: "${studentAnswer}"
                      Total Question Marks: ${marks || 5}
                      
                      Evaluate the student's answer. Give a score (integer) out of ${marks || 5} and a short, encouraging feedback message (max 2 sentences) describing what they did right or wrong.
                      Respond ONLY with a JSON object in this format:
                      {
                        "score": number,
                        "feedback": "string"
                      }`
                    }
                  ]
                }],
                generationConfig: {
                  responseMimeType: "application/json"
                }
              })
            });

            const result = await response.json();
            const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            
            res.setHeader('Content-Type', 'application/json');
            res.end(responseText);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
        });
      });

      server.middlewares.use('/api/clean-text', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { text } = data;

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ cleanedText: text + "\n\n[Demo AI: Text cleaned and formatted successfully]" }));
              return;
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `You are an expert transcriber. Clean up and format this raw OCR text of a university exam question paper.
                    - Fix obvious typos, misspelled words, and OCR formatting glitches.
                    - Format it cleanly using Markdown, maintaining question numbers and sub-questions (a, b, c).
                    - Align equations and math notations clearly.
                    - Remove scanner noise, page headers, or random artifacts.
                    - Do not solve the questions, just return the beautifully formatted transcript.
                    
                    Raw OCR Text:
                    "${text}"`
                  }]
                }]
              })
            });

            const result = await response.json();
            const cleanedText = result?.candidates?.[0]?.content?.parts?.[0]?.text || text;
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ cleanedText }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
        });
      });

      server.middlewares.use('/api/generate-quizzes', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { courseCode, session, semester, paperText } = data;

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              const demoMCQs = [
                {
                  questionText: `What is the schedule variance (SV) if EV = 780 and PV = 810?`,
                  options: ["SV = -30 (behind schedule)", "SV = +30 (ahead of schedule)", "SV = -10 (behind schedule)", "SV = +10 (ahead of schedule)"],
                  answer: "SV = -30 (behind schedule)",
                  solution: "SV = EV - PV = 780 - 810 = -30. A negative variance means the project is behind schedule.",
                  topic: "Earned Value Management",
                  marks: 5
                },
                {
                  questionText: `What does a Schedule Performance Index (SPI) value of 1.0 mean?`,
                  options: ["Project is behind schedule", "Project is on schedule", "Project is ahead of schedule", "Project is over budget"],
                  answer: "Project is on schedule",
                  solution: "An SPI of 1.0 indicates that the project is progressing exactly as planned/on schedule.",
                  topic: "Earned Value Management",
                  marks: 5
                }
              ];
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ quizzes: demoMCQs }));
              return;
            }

            const prompt = `Based on the following university past question paper, generate 5 high-quality practice multiple-choice questions (MCQs) for students studying this course (${courseCode || "General"}).
            
            Course Code: ${courseCode || "General"}
            Session: ${session || "2024/2025"}
            Semester: ${semester || "First"}
            
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
            {
              "quizzes": [
                {
                  "questionText": "string",
                  "options": ["string", "string", "string", "string"],
                  "answer": "string",
                  "solution": "string",
                  "topic": "string",
                  "marks": number
                }
              ]
            }`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{ text: prompt }]
                }],
                generationConfig: {
                  responseMimeType: "application/json"
                }
              })
            });

            const result = await response.json();
            const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "{\"quizzes\": []}";
            
            res.setHeader('Content-Type', 'application/json');
            res.end(responseText);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    ocrMiddlewarePlugin(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
