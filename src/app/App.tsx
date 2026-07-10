import { useState, useRef, useEffect } from "react";
import {
  BookOpen, Search, Download, TrendingUp, MessageSquare, Users,
  Upload, Clock, CheckCircle, XCircle, ChevronRight, ChevronDown,
  Eye, EyeOff, Heart, Share2, Plus, X, Camera, FileText, LogOut,
  Play, Award, Send, ChevronLeft, AlertCircle, Check, Loader2,
  Star, Settings, Paperclip, Image, GraduationCap, Menu, Flame,
  Zap, Pin, Library, FolderOpen, ShieldCheck, BookMarked, Bookmark, Sparkles,
} from "lucide-react";

import { AuthProvider, useAuth } from './lib/AuthContext';
import { auth, db } from './lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, getDocs, where, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc, orderBy, deleteDoc } from 'firebase/firestore';

// ─── TYPES ───────────────────────────────────────────────────

type Role = "student" | "lecturer" | "admin";
type View = "library" | "quiz" | "forum" | "upload" | "trends" | "admin" | "repository";
type AuthMode = "login" | "register";
type QuizStep = "setup" | "taking" | "results";

interface User { name: string; email: string; role: Role; avatar: string; }

interface PQQuestion {
  id: string;
  section: string;     // "A" | "B"
  number: string;      // "1", "5b", "Q3a"
  text: string;
  marks: number;
  topic: string;
  frequency: number;   // how many times this topic appeared across all years
  answer: string;
  solution: string;
  type: "fillblank" | "theory" | "calculation" | "objective";
  options?: string[];
}

interface PQFile {
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

// ─── MOCK DATA ────────────────────────────────────────────────

const CPE508_2223: PQFile = {
  id: "pq_cpe508_2223",
  courseCode: "CPE 508",
  courseTitle: "Computer System Project Management",
  department: "Computer Science & Engineering",
  faculty: "Faculty of Technology",
  session: "2022/2023",
  semester: "Rain",
  year: 2024,
  instructions: "TIME ALLOWED: 2 Hours. Attempt ALL questions in Section A and any FOUR (4) questions in Section B.",
  uploadedBy: "Dr. Kwame Asante",
  uploadDate: "2024-07-10",
  totalMarks: 100,
  approved: true,
  questions: [
    // ── SECTION A ─────────────────────────────────────────────
    {
      id: "c508_a1", section: "A", number: "1", marks: 1, type: "fillblank",
      text: "The output of every activity is known as ______________",
      topic: "Project Basics", frequency: 6,
      answer: "Deliverable",
      solution: "A Deliverable is a tangible or intangible product, result, or capability produced to complete a project phase. Every activity in a project must produce a deliverable — it is the fundamental unit of project output.",
    },
    {
      id: "c508_a2", section: "A", number: "2", marks: 1, type: "fillblank",
      text: "A dependency relationship type where the successor activity cannot start unless the predecessor activity finishes is called ______________",
      topic: "Dependencies", frequency: 7,
      answer: "Finish-to-Start (FS)",
      solution: "Finish-to-Start (FS) is the most common dependency in PDM. The successor cannot begin until the predecessor is complete.\nExample: Testing cannot start until coding finishes.",
    },
    {
      id: "c508_a3", section: "A", number: "3", marks: 1, type: "fillblank",
      text: "A mark that signifies the end of a set of activities in a project is known as _____________",
      topic: "Project Scheduling", frequency: 9,
      answer: "Milestone",
      solution: "A Milestone is a significant checkpoint in a project marking the completion of a major deliverable or phase. Milestones have zero duration — they are points in time, not activities.",
    },
    {
      id: "c508_a4", section: "A", number: "4", marks: 1, type: "fillblank",
      text: "_________ is an amazing tool in project management that shows a hierarchical breakdown of work activities used to define the scope of the project.",
      topic: "WBS", frequency: 8,
      answer: "Work Breakdown Structure (WBS)",
      solution: "WBS (Work Breakdown Structure) is a hierarchical decomposition of the total project scope into manageable work packages. It organises and defines the total scope of the project.",
    },
    {
      id: "c508_a5", section: "A", number: "5", marks: 1, type: "fillblank",
      text: "A type of dependency where activities stay the same, yet the order changes, is called ___________",
      topic: "Dependencies", frequency: 7,
      answer: "Discretionary Dependency (Soft Logic)",
      solution: "Discretionary dependencies (soft logic) are based on best practices or preferences. The activities remain the same but the sequence can change.\nHard logic is mandatory; soft logic is preferred but flexible.",
    },
    {
      id: "c508_a6", section: "A", number: "6", marks: 1, type: "fillblank",
      text: "A process to 'mitigate the adverse effects of loss' in Project Management is called: ________________",
      topic: "Risk Management", frequency: 10,
      answer: "Risk Management / Risk Mitigation",
      solution: "Risk Management encompasses identifying, analysing, and responding to project risks. Risk Mitigation specifically reduces the probability or impact of an adverse risk event — often implemented through contingency planning or insurance.",
    },
    {
      id: "c508_a7", section: "A", number: "7", marks: 1, type: "fillblank",
      text: "The ultimate aim of a Project is to ___________________________",
      topic: "Project Basics", frequency: 6,
      answer: "Achieve specific goals/objectives within defined time, cost, and scope constraints",
      solution: "A project's ultimate aim is to deliver a unique product, service, or result that achieves defined objectives within agreed constraints of time, cost, and scope — thereby satisfying stakeholder requirements.",
    },
    {
      id: "c508_a8", section: "A", number: "8", marks: 1, type: "fillblank",
      text: "External stakeholders can be __________ and _____________",
      topic: "Stakeholders", frequency: 7,
      answer: "Customers / Clients  AND  Government / Regulatory bodies (or Suppliers, Community)",
      solution: "External stakeholders are individuals or groups outside the project organisation who have an interest in or are affected by the project outcomes. They include customers, government regulators, suppliers, competitors, and the public.",
    },
    {
      id: "c508_a9", section: "A", number: "9", marks: 1, type: "fillblank",
      text: "Decision tree analysis is majorly used for ______________________",
      topic: "Risk Management", frequency: 10,
      answer: "Risk analysis and decision making under uncertainty",
      solution: "Decision tree analysis is a graphical tool mapping possible outcomes, their probabilities, and costs/benefits. It is primarily used in risk analysis and complex decision-making to choose the best course of action under uncertainty.",
    },
    {
      id: "c508_a10", section: "A", number: "10", marks: 1, type: "fillblank",
      text: "In making a decision, it means you have ______________________",
      topic: "Decision Making", frequency: 5,
      answer: "Alternatives / Choices",
      solution: "Decision-making presupposes the existence of alternatives. If only one course of action exists, no decision is needed. The essence of decision-making is evaluating and selecting from two or more alternatives.",
    },
    // ── SECTION B ─────────────────────────────────────────────
    {
      id: "c508_b1a", section: "B", number: "Q1a", marks: 5, type: "theory",
      text: "Correlate between Openness in the group and confidentiality as norms of a project team.",
      topic: "Team Management", frequency: 4,
      answer: "Openness promotes internal transparency; confidentiality protects sensitive project information externally. Both must be balanced.",
      solution: "Openness (transparency) as a team norm encourages members to share ideas, concerns, and feedback freely — building trust and improving decision quality.\n\nConfidentiality protects sensitive project information (client data, trade secrets, strategic plans) from external parties.\n\nBalance: Team members should be open with each other internally while collectively maintaining confidentiality from external parties. This creates a safe environment for honest communication while protecting the project's integrity.\n\nExample: A team openly discusses design flaws in their sprint review (openness) while agreeing not to share client financial data with competitors (confidentiality).",
    },
    {
      id: "c508_b1b", section: "B", number: "Q1b", marks: 5, type: "theory",
      text: "There is diversity in IT project; why do you need a legal adviser in the project?",
      topic: "Legal & Ethics", frequency: 3,
      answer: "Legal advisers handle contracts, IP rights, compliance, data privacy laws, and dispute resolution.",
      solution: "In diverse IT projects, a legal adviser is essential for:\n1. Contract Management: Reviewing vendor, client, and partner agreements\n2. Intellectual Property: Protecting software copyrights, patents, trade secrets\n3. Compliance: Ensuring adherence to data protection laws (GDPR, NDPR) and industry regulations\n4. Employment Law: Managing diverse international teams with varying labour laws\n5. Liability: Handling disputes, breach of contract, limitation of liability\n6. Data Privacy: Managing personal data across different legal jurisdictions",
    },
    {
      id: "c508_b1c", section: "B", number: "Q1c", marks: 5, type: "theory",
      text: "A project is proposed to develop a transcript system for the university. (i) What are the ethics of the project? (ii) Why do you need the commitment of Top management? (iii) What will make this project successful? (iv) As a member of the team, what are your obligations?",
      topic: "Project Planning", frequency: 5,
      answer: "Covers ethics of student data, importance of top management buy-in, success factors, and team obligations.",
      solution: "(i) Ethics: Data privacy for student records, accuracy and integrity of transcripts, equal access for all students, confidentiality of academic performance, non-discrimination in system design.\n\n(ii) Top Management: Provides resources (budget, personnel), removes barriers, lends authority and credibility, ensures alignment with institutional goals, motivates the project team.\n\n(iii) Success Factors: Clear requirements, stakeholder engagement, adequate funding, skilled team, realistic timeline, rigorous testing with real data, user training, post-deployment support.\n\n(iv) Obligations: Deliver assigned tasks on time, communicate progress and risks, maintain data confidentiality, follow coding standards, participate in reviews, document work thoroughly.",
    },
    {
      id: "c508_b2a", section: "B", number: "Q2a", marks: 5, type: "theory",
      text: "What are the characteristics of organizational structure?",
      topic: "Organizational Structure", frequency: 6,
      answer: "Key characteristics: chain of command, span of control, centralisation, formalisation, departmentalisation.",
      solution: "Characteristics of Organizational Structure:\n1. Chain of Command: Line of authority from top to bottom\n2. Span of Control: Number of subordinates a manager directly supervises\n3. Centralisation vs Decentralisation: Degree to which decisions are concentrated at the top\n4. Formalisation: Extent jobs and procedures are standardised\n5. Departmentalisation: How jobs are grouped (function, product, geography, customer)\n6. Work Specialisation: Degree tasks are divided into distinct jobs\n7. Types: Functional, Matrix, Projectised — each with different authority and resource allocation",
    },
    {
      id: "c508_b2b", section: "B", number: "Q2b", marks: 5, type: "theory",
      text: "When do you need Monte Carlo simulation?",
      topic: "Risk Management", frequency: 10,
      answer: "When multiple uncertain variables interact and you need probability distributions of project outcomes.",
      solution: "Monte Carlo simulation is needed when:\n1. Multiple Uncertainties: Several variables (duration, cost, resources) have ranges of possible values\n2. Complex Dependencies: Variables interact in non-linear ways that are hard to calculate analytically\n3. Risk Quantification: You need probability distributions for completion dates or final costs\n4. Schedule/Cost Analysis: To determine the probability of completing on time or within budget\n5. Sensitivity Analysis: To identify which risks most impact outcomes\n\nProcess: Run thousands of iterations using random values within defined ranges → generate probability distributions of outcomes (e.g., '80% probability of completing within 12 months').",
    },
    {
      id: "c508_b2c", section: "B", number: "Q2c", marks: 5, type: "theory",
      text: "As a project leader, develop a traffic control system for OAU. (i) Explain your planning decisions. (ii) How will you manage change decisions? (iii) Give the tracking decisions you will use. (iv) What are your relationship decisions?",
      topic: "Project Planning", frequency: 5,
      answer: "Comprehensive project leadership plan for OAU traffic control system.",
      solution: "(i) Planning: Define scope (intersections, smart signals, pedestrian crossings), create WBS, estimate resources (sensors, cameras, software licences), develop Gantt chart, set budget, identify risks (power outages, vandalism, weather).\n\n(ii) Change Management: Establish Change Control Board (CCB), document all change requests, assess impact on scope/cost/time, communicate approved changes to all stakeholders.\n\n(iii) Tracking: Use Earned Value Management (EV, AC, PV), weekly progress reports, milestone tracking, SPI and CPI monitoring, issue logs, risk register updates.\n\n(iv) Relationships: Regular meetings with OAU management, clear communication channels with Security Dept., vendor management protocols, team conflict resolution procedures.",
    },
    {
      id: "c508_b3a", section: "B", number: "Q3a", marks: 5, type: "theory",
      text: "Describe with examples the different types of dependencies that exist in Precedence Diagramming Method (PDM).",
      topic: "Dependencies", frequency: 7,
      answer: "PDM has four types: Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), Start-to-Finish (SF).",
      solution: "PDM Dependency Types:\n\n1. Finish-to-Start (FS): Successor starts only after predecessor finishes.\n   Example: Testing can only begin after coding is complete.\n\n2. Start-to-Start (SS): Successor can start only after predecessor starts.\n   Example: Documentation can start after development starts (not before).\n\n3. Finish-to-Finish (FF): Successor can finish only after predecessor finishes.\n   Example: Quality review can finish only after all coding finishes.\n\n4. Start-to-Finish (SF): Successor can finish only after predecessor starts. (Rare)\n   Example: New system shutdown can only happen after the replacement system starts.",
    },
    {
      id: "c508_b3b", section: "B", number: "Q3b", marks: 5, type: "theory",
      text: "Distinguish with full description the difference between Strategic planning and Tactical planning.",
      topic: "Planning", frequency: 6,
      answer: "Strategic = long-term, org-wide, top management. Tactical = short-term, department-level, middle management.",
      solution: "Strategic Planning:\n- Timeframe: Long-term (3–5+ years)\n- Scope: Organisation-wide\n- Who: Top management/executives\n- Focus: Mission, vision, long-term goals\n- Example: 'Digitise all university records within 5 years'\n- Nature: Broad, flexible, direction-setting\n\nTactical Planning:\n- Timeframe: Short to medium-term (≤1 year)\n- Scope: Department or project level\n- Who: Middle management/project managers\n- Focus: How to achieve strategic goals through specific actions\n- Example: 'Digitise transcript department records in Q1 using a team of 5'\n- Nature: Specific, detailed, operational",
    },
    {
      id: "c508_b3c", section: "B", number: "Q3c", marks: 5, type: "theory",
      text: "Discuss the processes involved in Project Scheduling.",
      topic: "Project Scheduling", frequency: 9,
      answer: "Activity definition → Sequencing → Resource estimating → Duration estimating → Schedule development → Control.",
      solution: "Project Scheduling Processes:\n1. Activity Definition: Break work packages into schedule activities\n2. Activity Sequencing: Determine dependencies using PDM; create network diagram\n3. Activity Resource Estimating: Determine required resources (people, equipment, materials)\n4. Activity Duration Estimating: Estimate time per activity (PERT, analogous, parametric)\n5. Schedule Development: Create schedule using CPM, Gantt charts, network diagrams; identify critical path\n6. Schedule Control: Monitor progress, manage changes, update schedule baseline using EVM\n\nKey Tools: Gantt Chart, Network Diagram, Critical Path Method (CPM), PERT",
    },
    {
      id: "c508_b4a", section: "B", number: "Q4a", marks: 5, type: "theory",
      text: "Using the acronym SMART, discuss the essential characteristics of a good Computer Project Management.",
      topic: "Project Management Principles", frequency: 7,
      answer: "SMART = Specific, Measurable, Achievable, Realistic, Time-bound.",
      solution: "S — Specific: Objectives must be clearly defined. Not 'improve the system' but 'reduce query response time by 40%'.\n\nM — Measurable: Progress must be quantifiable. Define KPIs, milestones, and metrics (e.g., test coverage %, defect rate).\n\nA — Achievable: Goals must be attainable given available resources and constraints. Unrealistic goals demotivate teams.\n\nR — Realistic/Relevant: Objectives must align with organisational strategy. Resources and constraints must be honestly considered.\n\nT — Time-bound: Every objective must have a defined deadline. Use schedules, Gantt charts, and milestones for time discipline.",
    },
    {
      id: "c508_b4b", section: "B", number: "Q4b", marks: 5, type: "theory",
      text: "Propose a medium-scale Computer Project and discuss the salient features of a good Project Management Technique for your team.",
      topic: "Project Planning", frequency: 5,
      answer: "Proposed: OAU Student Portal — Online Course Registration and Result Management System using Agile/Scrum.",
      solution: "Project: 'OAU Student Portal — Online Course Registration & Result Management System'\n\nTechnique: Agile (Scrum)\n\nSalient Features:\n1. Iterative Sprints: 2-week cycles with tangible deliverables each sprint\n2. Daily Standups: Brief sync meetings to surface blockers\n3. Product Backlog: Prioritised feature list (registration, results, timetable, notifications)\n4. Sprint Reviews: Demo to stakeholders at end of each sprint\n5. Retrospectives: Team reflection on process improvement\n6. Risk Management: Regular risk assessments and mitigation strategies\n7. Clear Roles: Product Owner (OAU IT Director), Scrum Master, Development Team\n8. Definition of Done: Clear completion criteria for each feature",
    },
    {
      id: "c508_b4c", section: "B", number: "Q4c", marks: 5, type: "theory",
      text: "Explain five (5) stages of Project Management and mention the deliverables at the end of each stage.",
      topic: "Project Lifecycle", frequency: 9,
      answer: "Initiation, Planning, Execution, Monitoring & Control, Closure — each with specific deliverables.",
      solution: "5 Stages of Project Management:\n\n1. Initiation\n   Activities: Define project, identify stakeholders, feasibility study\n   Deliverables: Project Charter, Stakeholder Register\n\n2. Planning\n   Activities: Develop scope, schedule, budget, risk plan, communications plan\n   Deliverables: Project Management Plan, WBS, Schedule Baseline, Budget Baseline\n\n3. Execution\n   Activities: Coordinate team, produce deliverables, manage communications\n   Deliverables: Project Deliverables, Work Performance Data, Change Requests\n\n4. Monitoring & Control\n   Activities: Track performance (EVM), manage changes, control scope/schedule/cost\n   Deliverables: Performance Reports, Change Log, Updated Project Plan\n\n5. Closure\n   Activities: Formal acceptance, release resources, document lessons learned, archive records\n   Deliverables: Final Product/Service, Lessons Learned Document, Closure Report",
    },
    {
      id: "c508_b5a", section: "B", number: "Q5a", marks: 1.5, type: "calculation",
      text: "What does SPI value of 1 mean?",
      topic: "Earned Value Management", frequency: 12,
      answer: "SPI = 1 means the project is exactly on schedule.",
      solution: "SPI (Schedule Performance Index) = EV ÷ PV\n\nSPI = 1: Project is EXACTLY ON SCHEDULE\n  Earned Value = Planned Value\n  Work is being completed at exactly the planned rate.\n\nSPI > 1: Ahead of schedule (performing better than planned)\nSPI < 1: Behind schedule (performing worse than planned)\n\nSPI = 1 is the ideal target for schedule performance.",
    },
    {
      id: "c508_b5b", section: "B", number: "Q5b", marks: 1.5, type: "calculation",
      text: "A project controlling shows an actual cost of 800, an earned value of 780, and the planned value is 810. Calculate the schedule variance.",
      topic: "Earned Value Management", frequency: 12,
      answer: "SV = EV − PV = 780 − 810 = −30 (project is behind schedule)",
      solution: "Schedule Variance (SV) = EV − PV\n\nGiven:\n  AC (Actual Cost)   = 800\n  EV (Earned Value)  = 780\n  PV (Planned Value) = 810\n\nSV = EV − PV = 780 − 810 = −30\n\nSV is NEGATIVE → project is BEHIND SCHEDULE by 30 units.\nLess work has been completed than was planned at this point.",
    },
    {
      id: "c508_b5c", section: "B", number: "Q5c", marks: 1.5, type: "calculation",
      text: "A project's actual cost is 2100 and the earned value is 1500. What is your cost variance?",
      topic: "Earned Value Management", frequency: 12,
      answer: "CV = EV − AC = 1500 − 2100 = −600 (project is over budget)",
      solution: "Cost Variance (CV) = EV − AC\n\nGiven:\n  AC (Actual Cost)  = 2100\n  EV (Earned Value) = 1500\n\nCV = EV − AC = 1500 − 2100 = −600\n\nCV is NEGATIVE → project is OVER BUDGET by 600 units.\nMore money has been spent than the value of work completed.",
    },
    {
      id: "c508_b5d", section: "B", number: "Q5d", marks: 1.5, type: "calculation",
      text: "What is the current state of a project if the CPI is > 1?",
      topic: "Earned Value Management", frequency: 12,
      answer: "CPI > 1 means the project is under budget (cost efficient).",
      solution: "CPI (Cost Performance Index) = EV ÷ AC\n\nCPI > 1: Project is UNDER BUDGET (cost efficient)\n  More value is earned for every unit of money spent.\n  Example: CPI = 1.2 → for every ₦1 spent, ₦1.20 of work is produced.\n\nCPI = 1: Exactly on budget\nCPI < 1: Over budget (cost inefficient)",
    },
    {
      id: "c508_b5e", section: "B", number: "Q5e", marks: 1.5, type: "calculation",
      text: "Your SPI is 1.1 and your CPI 0.9. What is the current project status?",
      topic: "Earned Value Management", frequency: 12,
      answer: "Ahead of schedule (SPI > 1) but over budget (CPI < 1).",
      solution: "SPI = 1.1 (> 1) → AHEAD OF SCHEDULE by 10%\n  The team is completing 10% more work than planned.\n\nCPI = 0.9 (< 1) → OVER BUDGET by ~11%\n  For every ₦1 planned, ₦1.11 is being spent.\n\nOverall: The project is progressing faster than planned but at higher cost. The team may be using more expensive resources to accelerate delivery. Immediate cost control measures are recommended.",
    },
    {
      id: "c508_b5f", section: "B", number: "Q5f", marks: 1.5, type: "calculation",
      text: "The cost performance index of a project is 1.15 and the earned value is 2590. Calculate the actual cost.",
      topic: "Earned Value Management", frequency: 12,
      answer: "AC = EV ÷ CPI = 2590 ÷ 1.15 = 2252.17",
      solution: "CPI = EV ÷ AC  →  AC = EV ÷ CPI\n\nGiven:\n  CPI = 1.15\n  EV  = 2590\n\nAC = 2590 ÷ 1.15 = 2252.17\n\nThe actual cost is 2252.17 units.\nSince CPI > 1, AC < EV → project is under budget. ✓",
    },
    {
      id: "c508_b5g", section: "B", number: "Q5g", marks: 1.5, type: "calculation",
      text: "What does a cost variance of 0 mean?",
      topic: "Earned Value Management", frequency: 12,
      answer: "CV = 0 means the project is exactly on budget.",
      solution: "CV = EV − AC\n\nCV = 0 → EV = AC\nThe value of work completed exactly equals the money spent.\nThe project is EXACTLY ON BUDGET — the ideal cost performance scenario.",
    },
    {
      id: "c508_b5h", section: "B", number: "Q5h", marks: 1.5, type: "calculation",
      text: "A project controlling shows an actual cost of 3300, an earned value of 3000, and the planned value is 2900. Calculate the schedule performance index.",
      topic: "Earned Value Management", frequency: 12,
      answer: "SPI = EV ÷ PV = 3000 ÷ 2900 ≈ 1.034 (slightly ahead of schedule)",
      solution: "SPI = EV ÷ PV\n\nGiven:\n  AC = 3300\n  EV = 3000\n  PV = 2900\n\nSPI = 3000 ÷ 2900 = 1.0345\n\nSPI ≈ 1.034 (> 1) → project is AHEAD OF SCHEDULE by ~3.4%.\nThe team is completing slightly more work than was planned.",
    },
    {
      id: "c508_b5i", section: "B", number: "Q5i", marks: 1.5, type: "calculation",
      text: "What does a CPI of 1 indicate?",
      topic: "Earned Value Management", frequency: 12,
      answer: "CPI = 1 means the project is exactly on budget.",
      solution: "CPI = EV ÷ AC\n\nCPI = 1 → EV = AC\nEvery unit of money spent produces exactly one unit of value.\nThe project is EXACTLY ON BUDGET — ideal cost efficiency.",
    },
    {
      id: "c508_b5j", section: "B", number: "Q5j", marks: 1.5, type: "calculation",
      text: "How do you interpret a SPI value of 1.3842?",
      topic: "Earned Value Management", frequency: 12,
      answer: "Project is 38.42% ahead of schedule — significantly faster than planned.",
      solution: "SPI = 1.3842 (significantly > 1)\n\nInterpretation: AHEAD OF SCHEDULE by 38.42%.\nFor every unit of work planned, 1.3842 units are being completed.\n\nImplications:\n• Team is highly efficient at task completion\n• Resources may be over-allocated (risk of burnout)\n• Scope/quality should be reviewed — is speed compromising standards?\n• Check CPI simultaneously — speed may come at extra cost\n\nGenerally positive, but this high SPI warrants investigation.",
    },
    {
      id: "c508_b6a", section: "B", number: "Q6a", marks: 5, type: "theory",
      text: "Mention and explain 4 software testing techniques.",
      topic: "Software Testing", frequency: 6,
      answer: "Unit, Integration, System, and User Acceptance Testing (UAT).",
      solution: "4 Software Testing Techniques:\n\n1. Unit Testing: Tests individual components/functions in isolation. Done by developers.\n   Example: Testing a single SPI calculation function.\n\n2. Integration Testing: Tests interactions between integrated modules. Ensures components work together.\n   Example: Testing the login module's connection to the database.\n\n3. System Testing: Tests the complete integrated system against requirements in a production-like environment.\n   Example: Testing the entire student portal end-to-end.\n\n4. User Acceptance Testing (UAT): Testing by end-users to validate the system meets their needs. Final gate before deployment.\n   Example: Students and registrars validating the transcript system.",
    },
    {
      id: "c508_b6b", section: "B", number: "Q6b", marks: 5, type: "theory",
      text: "What are the common software metrics? Give brief explanation.",
      topic: "Software Metrics", frequency: 5,
      answer: "LOC, Function Points, Defect Density, Code Coverage, Cyclomatic Complexity, MTBF.",
      solution: "Common Software Metrics:\n\n1. Lines of Code (LOC): Measures software size. Simple but crude.\n\n2. Function Points (FP): Measures functionality from user perspective — inputs, outputs, queries, files, interfaces.\n\n3. Defect Density: Number of defects per 1000 LOC. Measures software quality.\n\n4. Code Coverage: % of code exercised by tests. Higher = better tested.\n\n5. Cyclomatic Complexity: Number of independent paths through code. Higher = more complex, harder to maintain.\n\n6. Mean Time Between Failures (MTBF): Average time between system failures. Measures reliability.\n\n7. Velocity (Agile): Work completed per sprint. Measures team productivity.",
    },
    {
      id: "c508_b6c", section: "B", number: "Q6c", marks: 5, type: "theory",
      text: "There are principles of software quality assurance that ensure products deliver value. Explain 4 of these key principles and how they affect SQA.",
      topic: "Software Quality", frequency: 6,
      answer: "Testing shows defects, exhaustive testing is impossible, early testing, defect clustering.",
      solution: "4 Key SQA Principles:\n\n1. Testing Shows Presence of Defects (not their absence)\n   Testing can prove defects exist — not that the software is defect-free.\n   Effect: Teams must design tests to find defects aggressively, not to prove the system works.\n\n2. Exhaustive Testing is Impossible\n   Cannot test every possible input combination.\n   Effect: Test prioritisation using risk analysis and equivalence partitioning is essential.\n\n3. Early Testing (Shift Left)\n   Testing should begin as early as possible in the SDLC.\n   Effect: Defects found early are 10–100× cheaper to fix. Promotes TDD.\n\n4. Defect Clustering (Pareto Principle)\n   ~80% of defects are found in ~20% of modules.\n   Effect: Focus testing efforts on high-risk, complex, or historically defect-prone modules.",
    },
  ],
};

const MTH101_2223: PQFile = {
  id: "pq_mth101_2223", courseCode: "MTH 101", courseTitle: "Calculus I",
  department: "Mathematics", faculty: "Faculty of Science",
  session: "2022/2023", semester: "First", year: 2023,
  instructions: "TIME ALLOWED: 2 Hours. Answer all questions in Section A and any 3 in Section B.",
  uploadedBy: "Dr. Kwame Asante", uploadDate: "2023-12-15", totalMarks: 100, approved: true,
  questions: [
    { id: "m101_a1", section: "A", number: "1", marks: 2, type: "objective",
      text: "Evaluate lim(x→0) [sin(3x) / x]",
      options: ["A. 0", "B. 1", "C. 3", "D. ∞"],
      topic: "Limits", frequency: 12, answer: "C. 3",
      solution: "Standard limit: lim(x→0)[sin(kx)/x] = k\nlim(x→0)[sin(3x)/x] = 3 · lim(x→0)[sin(3x)/(3x)] = 3 × 1 = 3" },
    { id: "m101_a2", section: "A", number: "2", marks: 2, type: "objective",
      text: "Evaluate the definite integral ∫₀¹ (2x + 3) dx.",
      options: ["A. 4", "B. 5", "C. 6", "D. 7"],
      topic: "Integration", frequency: 9, answer: "A. 4",
      solution: "∫₀¹ (2x + 3) dx = [x² + 3x]₀¹ = (1 + 3) − 0 = 4" },
    { id: "m101_b1", section: "B", number: "Q1", marks: 15, type: "theory",
      text: "Find the derivative of f(x) = x³ sin(x) using the product rule, and evaluate f′(π/2).",
      topic: "Differentiation", frequency: 15, answer: "f′(x) = 3x² sin(x) + x³ cos(x); f′(π/2) = 3π²/4",
      solution: "Product rule: d/dx[uv] = u′v + uv′\nu = x³, v = sin(x), u′ = 3x², v′ = cos(x)\nf′(x) = 3x² sin(x) + x³ cos(x)\nAt x = π/2: f′(π/2) = 3(π²/4)(1) + (π³/8)(0) = 3π²/4 ≈ 7.40" },
    { id: "m101_b2", section: "B", number: "Q2", marks: 15, type: "theory",
      text: "Find all critical points of f(x) = x³ − 6x² + 9x + 2 and determine their nature.",
      topic: "Differentiation", frequency: 15, answer: "Critical points at x=1 (local max) and x=3 (local min)",
      solution: "f′(x) = 3x² − 12x + 9 = 3(x² − 4x + 3) = 3(x−1)(x−3)\nCritical points: x = 1, x = 3\nf″(x) = 6x − 12\nf″(1) = −6 < 0 → local MAXIMUM at x=1, f(1) = 6\nf″(3) = 6 > 0  → local MINIMUM at x=3, f(3) = 2" },
  ],
};

const PHY101_2122: PQFile = {
  id: "pq_phy101_2122", courseCode: "PHY 101", courseTitle: "Mechanics",
  department: "Physics", faculty: "Faculty of Science",
  session: "2021/2022", semester: "First", year: 2022,
  instructions: "TIME ALLOWED: 2½ Hours. Attempt ALL questions in Section A and any 4 in Section B.",
  uploadedBy: "Dr. Kwame Asante", uploadDate: "2022-12-10", totalMarks: 100, approved: true,
  questions: [
    { id: "p101_a1", section: "A", number: "1", marks: 2, type: "objective",
      text: "Newton's Second Law states that Force equals:",
      options: ["A. mass × velocity", "B. mass × acceleration", "C. mass × displacement", "D. mass × time"],
      topic: "Newton's Laws", frequency: 14, answer: "B. mass × acceleration",
      solution: "Newton's Second Law: F = ma\nForce = mass × acceleration\nThis is the fundamental relationship between force, mass, and acceleration." },
    { id: "p101_b1", section: "B", number: "Q1", marks: 15, type: "theory",
      text: "A block of mass 5 kg sits on a frictionless surface. A horizontal force of 20 N is applied. Find the acceleration and the velocity after 4 seconds.",
      topic: "Newton's Laws", frequency: 14, answer: "a = 4 m/s², v = 16 m/s",
      solution: "F = ma → a = F/m = 20/5 = 4 m/s²\nv = u + at = 0 + 4×4 = 16 m/s" },
    { id: "p101_b2", section: "B", number: "Q2", marks: 15, type: "theory",
      text: "A 10 kg object is lifted 5 m vertically. Calculate the work done against gravity and the gain in potential energy (g = 10 m/s²).",
      topic: "Work and Energy", frequency: 8, answer: "W = 500 J; ΔPE = 500 J",
      solution: "W = F × d = mg × h = 10 × 10 × 5 = 500 J\nΔPE = mgh = 500 J\n(Work done against gravity equals PE gained)" },
  ],
};

const CSC201_2324: PQFile = {
  id: "pq_csc201_2324", courseCode: "CSC 201", courseTitle: "Data Structures and Algorithms",
  department: "Computer Science & Engineering", faculty: "Faculty of Technology",
  session: "2023/2024", semester: "Second", year: 2024,
  instructions: "TIME ALLOWED: 2 Hours. Answer ALL questions.",
  uploadedBy: "Dr. Kwame Asante", uploadDate: "2024-06-01", totalMarks: 100, approved: true,
  questions: [
    { id: "c201_a1", section: "A", number: "1", marks: 2, type: "objective",
      text: "What is the worst-case time complexity of Merge Sort?",
      options: ["A. O(n)", "B. O(n log n)", "C. O(n²)", "D. O(log n)"],
      topic: "Sorting", frequency: 9, answer: "B. O(n log n)",
      solution: "Merge Sort always divides the array in half (log n levels) and merges in O(n) per level → O(n log n) in all cases." },
    { id: "c201_a2", section: "A", number: "2", marks: 2, type: "objective",
      text: "Which data structure operates on LIFO (Last In First Out) principle?",
      options: ["A. Queue", "B. Array", "C. Stack", "D. Linked List"],
      topic: "Data Structures", frequency: 11, answer: "C. Stack",
      solution: "A Stack follows LIFO — the last element pushed onto the stack is the first to be popped off.\nExample: Browser back button, function call stack." },
    { id: "c201_b1", section: "B", number: "Q1", marks: 20, type: "theory",
      text: "Describe with examples: (a) Binary Search Tree (BST) insertion and search operations. (b) The difference between BFS and DFS graph traversal algorithms.",
      topic: "Trees", frequency: 8, answer: "BST property, O(log n) ops; BFS uses queue (level-order), DFS uses stack (depth-first)",
      solution: "(a) BST: Left child < parent < right child.\nInsertion: Compare with root, go left if smaller, right if larger, recurse.\nSearch: Same comparison logic. O(log n) average, O(n) worst (skewed tree).\n\n(b) BFS (Breadth-First Search): Uses a queue. Visits all nodes at depth d before depth d+1. Good for shortest paths.\n\nDFS (Depth-First Search): Uses a stack (or recursion). Explores as far as possible before backtracking. Good for detecting cycles and topological sort." },
  ],
};

const ALL_PQ_FILES: PQFile[] = [CPE508_2223, MTH101_2223, PHY101_2122, CSC201_2324];

// Topic frequency colour
function freqMeta(n: number): { label: string; cls: string; icon: "flame" | "zap" | "pin" } {
  if (n >= 10) return { label: `${n}× — Very High`, cls: "bg-red-100 text-red-600", icon: "flame" };
  if (n >= 7) return { label: `${n}× — High`, cls: "bg-amber-100 text-amber-700", icon: "zap" };
  return { label: `${n}× — Moderate`, cls: "bg-blue-100 text-blue-600", icon: "pin" };
}

function FreqIcon({ type }: { type: "flame" | "zap" | "pin" }) {
  if (type === "flame") return <Flame size={11} />;
  if (type === "zap") return <Zap size={11} />;
  return <Pin size={11} />;
}

// Dept colour
const DEPT_COLORS: Record<string, string> = {
  "Computer Science & Engineering": "bg-blue-600",
  "Mathematics": "bg-purple-600",
  "Physics": "bg-green-600",
  "Chemistry": "bg-orange-600",
  "Biology": "bg-teal-600",
  "Statistics": "bg-pink-600",
};

function deptColor(dept: string) { return DEPT_COLORS[dept] || "bg-gray-600"; }

function cn(...cls: (string | boolean | undefined | null)[]) { return cls.filter(Boolean).join(" "); }

const FORUM_THREADS: any[] = [];

// ─── AUTH MODAL ───────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();

function AuthModal() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [adminCode, setAdminCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (mode === "login") {
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
          // If login fails (user not found or invalid credential), check if we can auto-register as a demo login helper
          if (email && password.length >= 6 && 
              (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password")) {
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              const uid = userCredential.user.uid;
              const raw = email.split("@")[0].replace(/[._-]/g, " ");
              const name = raw.charAt(0).toUpperCase() + raw.slice(1);
              let role: Role = "student";
              if (email === "admin@oau.edu") {
                role = "admin";
              } else if (email.includes("lecturer")) {
                role = "lecturer";
              }
              await setDoc(doc(db, 'users', uid), {
                id: uid,
                email,
                name: email === "admin@oau.edu" ? "Dr. Kwame Asante" : name,
                role,
                bookmarkedQuestions: []
              });
              return;
            } catch (regErr) {
              console.error("Auto-registration failed:", regErr);
            }
          }
          throw err;
        }
      } else {
        if (!name || !email || password.length < 6) {
          setError("Fill all fields. Password must be at least 6 characters.");
          setLoading(false);
          return;
        }
        if (role === "admin" && adminCode !== "OAU_ADMIN_2024") {
          setError("Invalid administrator code. Contact the system administrator.");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        await setDoc(doc(db, 'users', uid), {
          id: uid,
          email,
          name,
          role,
          bookmarkedQuestions: []
        });
      }
    } catch (err: any) {
      let msg = err.message || "Authentication failed.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Incorrect email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "Email is already registered.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const googleAuth = async () => {
    setLoading(true); setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          id: user.uid,
          email: user.email || "",
          name: user.displayName || "Google User",
          role: "student",
          bookmarkedQuestions: []
        });
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };



  const ROLES: { value: Role; label: string; desc: string }[] = [
    { value: "student", label: "Student", desc: "Browse PQs, take quizzes, join forums" },
    { value: "lecturer", label: "Lecturer", desc: "All student features + suggest uploads" },
    { value: "admin", label: "Administrator", desc: "Full access — upload PQs, approve content" },
  ];

  return (
    <div className="fixed inset-0 bg-[#0F2340]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#0F2340] px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8A020] flex items-center justify-center shrink-0">
              <GraduationCap size={20} className="text-[#0F2340]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">PastQ Hub</p>
              <p className="text-white/50 text-xs mt-0.5">Obafemi Awolowo University · Science Repository</p>
            </div>
          </div>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(["login", "register"] as AuthMode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
                  mode === m ? "bg-white shadow text-[#0F2340]" : "text-gray-400 hover:text-gray-600")}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Adaeze Okonkwo"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/25 focus:border-[#0F2340] transition-all" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@oau.edu.ng"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/25 focus:border-[#0F2340] transition-all" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/25 focus:border-[#0F2340] transition-all" />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Account Type</label>
                  <div className="space-y-2">
                    {ROLES.map(r => (
                      <label key={r.value}
                        className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                          role === r.value ? "border-[#0F2340] bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                        <input type="radio" name="role" value={r.value} checked={role === r.value}
                          onChange={() => setRole(r.value)} className="accent-[#0F2340]" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                          <p className="text-xs text-gray-400">{r.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {role === "admin" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Administrator Code <span className="text-red-500">*</span>
                    </label>
                    <input value={adminCode} onChange={e => setAdminCode(e.target.value)}
                      placeholder="Contact system admin for code"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/25 focus:border-[#0F2340] transition-all" />
                    <p className="text-[10px] text-gray-400 mt-1">Demo code: OAU_ADMIN_2024</p>
                  </div>
                )}
              </>
            )}

            {error && <p className="text-red-500 text-xs flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-[#0F2340] text-white rounded-xl py-3 font-bold text-sm hover:bg-[#1a3a6b] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button onClick={googleAuth} disabled={loading}
            className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-60">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {mode === "login" && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Admin demo:{" "}
              <button className="text-[#E8A020] font-semibold hover:underline"
                onClick={() => { setEmail("admin@oau.edu"); setPassword("admin123"); }}>
                admin@oau.edu / admin123
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────

function Sidebar({ view, setView, user, onLogout, mobile, onClose }: {
  view: View; setView: (v: View) => void; user: User; onLogout: () => void;
  mobile?: boolean; onClose?: () => void;
}) {
  const nav = [
    { id: "library" as View, icon: Library, label: "PQ Library" },
    { id: "quiz" as View, icon: Play, label: "Quiz" },
    { id: "forum" as View, icon: MessageSquare, label: "Forum" },
    { id: "trends" as View, icon: TrendingUp, label: "Trends" },
    ...(user.role !== "student" ? [{ id: "upload" as View, icon: Upload, label: "Upload" }] : []),
    ...(user.role === "admin" ? [
      { id: "repository" as View, icon: FolderOpen, label: "Repository" },
      { id: "admin" as View, icon: ShieldCheck, label: "Admin Panel" },
    ] : []),
  ];

  const go = (v: View) => { setView(v); onClose?.(); };

  return (
    <aside className="bg-[#0F2340] flex flex-col h-full w-60">
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E8A020] flex items-center justify-center shrink-0">
            <GraduationCap size={18} className="text-[#0F2340]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">PastQ Hub</p>
            <p className="text-white/40 text-[10px] mt-0.5">OAU Science Repository</p>
          </div>
        </div>
        {mobile && <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => go(id)}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
              view === id ? "bg-[#E8A020] text-[#0F2340]" : "text-white/60 hover:bg-white/10 hover:text-white")}>
            <Icon size={17} className="shrink-0" />{label}
          </button>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E8A020] flex items-center justify-center text-xs font-bold text-[#0F2340] shrink-0">
            {user.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user.name}</p>
            <p className="text-white/40 text-[10px] capitalize">{user.role}</p>
          </div>
          <button onClick={onLogout} className="text-white/30 hover:text-white/80 transition-colors" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── PQ FILE CARD ─────────────────────────────────────────────

function PQCard({ pq, onOpen }: { pq: PQFile; onOpen: () => void }) {
  const topTopics = [...new Map(pq.questions.map(q => [q.topic, q.frequency])).entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group cursor-pointer flex flex-col"
      onClick={onOpen}>
      <div className={cn("h-2 rounded-t-2xl", deptColor(pq.department))} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={cn("text-xs font-bold text-white px-2.5 py-1 rounded-lg shrink-0", deptColor(pq.department))}>
            {pq.courseCode}
          </span>
          {pq.approved && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <Check size={9} /> Verified
            </span>
          )}
        </div>

        <h3 className="font-bold text-[#0F2340] text-sm leading-snug mb-1 group-hover:text-blue-700 transition-colors">
          {pq.courseCode} Exam Question {pq.session}
        </h3>
        <p className="text-xs text-gray-500 mb-1">{pq.courseTitle}</p>
        <p className="text-xs text-gray-400 mb-3">{pq.department}</p>

        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <span className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">{pq.session}</span>
          <span className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">{pq.semester} Sem</span>
          <span className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">{pq.questions.length} Qs</span>
        </div>

        <div className="flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Top Topics</p>
          <div className="space-y-1">
            {topTopics.map(([topic, freq]) => {
              const { label, cls, icon } = freqMeta(freq);
              return (
                <div key={topic} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 truncate">{topic}</span>
                  <span className={cn("flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-2 shrink-0", cls)}>
                    <FreqIcon type={icon} />{freq}×
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">by {pq.uploadedBy.split(" ").slice(-1)[0]}</span>
          <span className="text-xs font-bold text-[#0F2340] group-hover:text-[#E8A020] flex items-center gap-1 transition-colors">
            View Paper <ChevronRight size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PQ VIEWER ────────────────────────────────────────────────

function PQViewer({ pq, onBack, onStartQuiz, userProfile, fetchQuestions }: {
  pq: PQFile;
  onBack: () => void;
  onStartQuiz: (pq: PQFile) => void;
  userProfile: any;
  fetchQuestions: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set(userProfile?.bookmarkedQuestions || []));

  useEffect(() => {
    if (userProfile?.bookmarkedQuestions) {
      setBookmarked(new Set(userProfile.bookmarkedQuestions));
    }
  }, [userProfile]);

  const toggleBookmark = async (qId: string) => {
    if (!userProfile) return;
    const isBookmarked = bookmarked.has(qId);
    const userRef = doc(db, 'users', userProfile.id);
    try {
      if (isBookmarked) {
        await updateDoc(userRef, { bookmarkedQuestions: arrayRemove(qId) });
        setBookmarked(prev => { const next = new Set(prev); next.delete(qId); return next; });
      } else {
        await updateDoc(userRef, { bookmarkedQuestions: arrayUnion(qId) });
        setBookmarked(prev => { const next = new Set(prev); next.add(qId); return next; });
      }
      fetchQuestions();
    } catch (err) {
      console.error("Error toggling bookmark:", err);
    }
  };

  const toggle = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sections = [...new Set(pq.questions.map(q => q.section))];

  const downloadPaper = () => {
    const lines = [
      `${pq.faculty.toUpperCase()}`,
      `DEPARTMENT OF ${pq.department.toUpperCase()}`,
      `${pq.courseCode} — ${pq.courseTitle}`,
      `${pq.semester} Semester Examination, ${pq.session} Academic Session`,
      ``,
      `INSTRUCTIONS: ${pq.instructions}`,
      `Total Marks: ${pq.totalMarks}`,
      `${"─".repeat(60)}`,
      ``,
    ];
    sections.forEach(sec => {
      const qs = pq.questions.filter(q => q.section === sec);
      lines.push(`SECTION ${sec}`);
      lines.push("");
      qs.forEach(q => {
        lines.push(`${q.number}. (${q.marks} mark${q.marks !== 1 ? "s" : ""}) [Topic: ${q.topic}]`);
        lines.push(q.text);
        if (q.options) q.options.forEach(o => lines.push(`   ${o}`));
        lines.push(`ANSWER: ${q.answer}`);
        lines.push(`SOLUTION: ${q.solution}`);
        lines.push("");
      });
    });
    const filename = `${pq.courseCode.replace(" ", "_")}_Exam_${pq.session.replace("/", "_")}.txt`;
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#0F2340] mb-5 transition-colors">
        <ChevronLeft size={15} /> Back to Library
      </button>

      {/* Paper header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("text-xs font-bold text-white px-2.5 py-1 rounded-lg", deptColor(pq.department))}>
                {pq.courseCode}
              </span>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Check size={10} /> Verified
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#0F2340]">{pq.courseCode} Exam Question {pq.session}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{pq.courseTitle}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
              <span>{pq.faculty}</span><span>·</span>
              <span>{pq.department}</span><span>·</span>
              <span>{pq.semester} Semester</span><span>·</span>
              <span>{pq.session} Session</span><span>·</span>
              <span>{pq.totalMarks} marks</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={downloadPaper}
              className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <Download size={14} /> Download
            </button>
            <button onClick={() => onStartQuiz(pq)}
              className="flex items-center gap-2 bg-[#E8A020] text-[#0F2340] rounded-xl px-4 py-2 text-sm font-bold hover:bg-[#d49018] transition-colors">
              <Play size={14} fill="currentColor" /> Practice Quiz
            </button>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <strong>Instructions:</strong> {pq.instructions}
        </div>
      </div>

      {/* Questions by section */}
      {sections.map(sec => {
        const qs = pq.questions.filter(q => q.section === sec);
        return (
          <div key={sec} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest px-3">
                Section {sec} {sec === "A" ? "— Fill in the Blank" : "— Essay / Theory"}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="space-y-3">
              {qs.map(q => {
                const open = expanded.has(q.id);
                const saved = bookmarked.has(q.id);
                const fm = freqMeta(q.frequency);
                return (
                  <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-bold text-gray-300 w-8 shrink-0 mt-0.5">{q.number}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span className="text-xs font-semibold bg-[#0F2340]/10 text-[#0F2340] px-2 py-0.5 rounded-lg">
                              {q.marks} mk{q.marks !== 1 ? "s" : ""}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">{q.topic}</span>
                            <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg", fm.cls)}
                              title={`${q.topic} appeared ${q.frequency} times in past exams`}>
                              <FreqIcon type={fm.icon} /> {fm.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 leading-relaxed">
                            {q.type === "fillblank"
                              ? q.text.replace(/__+/g, "______")
                              : q.text}
                          </p>
                          {q.options && !open && (
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              {q.options.map(opt => (
                                <span key={opt} className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">{opt}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => toggleBookmark(q.id)}
                            className={cn("p-1.5 rounded-lg transition-all", saved ? "text-[#E8A020]" : "text-gray-200 hover:text-[#E8A020]")}>
                            {saved ? <BookMarked size={15} /> : <Bookmark size={15} />}
                          </button>
                          <button onClick={() => toggle(q.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 transition-all">
                            <ChevronDown size={15} className={cn("transition-transform duration-200", open && "rotate-180")} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {open && (
                      <div className="border-t border-gray-50 bg-[#F7F8FA] p-4">
                        {q.options && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {q.options.map(opt => (
                              <div key={opt} className={cn("text-xs px-3 py-2 rounded-xl border font-medium",
                                opt === q.answer ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-gray-100 text-gray-500")}>
                                {opt === q.answer && <Check size={11} className="inline mr-1 text-emerald-600" />}{opt}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                          {q.type === "fillblank" ? "Answer" : "Model Answer"}
                        </p>
                        <div className="bg-white border border-gray-100 rounded-xl p-3 mb-2">
                          <p className="text-sm font-semibold text-emerald-700">{q.answer}</p>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Detailed Solution</p>
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed font-mono">{q.solution}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── LIBRARY VIEW ─────────────────────────────────────────────

function LibraryView({ onOpenPQ, onStartQuiz, user }: {
  onOpenPQ: (pq: PQFile) => void;
  onStartQuiz: (pq: PQFile) => void;
  user: User;
}) {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const depts = [...new Set(ALL_PQ_FILES.map(p => p.department))];
  const years = [...new Set(ALL_PQ_FILES.map(p => p.session))];

  const filtered = ALL_PQ_FILES.filter(p => {
    if (filterDept && p.department !== filterDept) return false;
    if (filterYear && p.session !== filterYear) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.courseCode.toLowerCase().includes(s) || p.courseTitle.toLowerCase().includes(s) ||
        p.department.toLowerCase().includes(s) || p.session.includes(s);
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">PQ Library</h1>
        <p className="text-gray-500 text-sm mt-1">Browse past question papers. Click any paper to view questions and solutions.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Papers Available", value: ALL_PQ_FILES.length, icon: FileText, bg: "bg-blue-50", fg: "text-blue-600" },
          { label: "Total Questions", value: ALL_PQ_FILES.reduce((s, p) => s + p.questions.length, 0), icon: BookOpen, bg: "bg-amber-50", fg: "text-amber-600" },
          { label: "Departments", value: depts.length, icon: GraduationCap, bg: "bg-purple-50", fg: "text-purple-600" },
          { label: "Years Covered", value: "25+", icon: TrendingUp, bg: "bg-emerald-50", fg: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, bg, fg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2.5", bg)}>
              <Icon size={17} className={fg} />
            </div>
            <p className="text-xl font-bold text-[#0F2340]">{value}</p>
            <p className="text-gray-400 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search papers, courses, departments..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 focus:border-[#0F2340] transition-all" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 bg-white text-gray-600">
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 bg-white text-gray-600">
          <option value="">All Sessions</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(search || filterDept || filterYear) && (
          <button onClick={() => { setSearch(""); setFilterDept(""); setFilterYear(""); }}
            className="text-xs text-[#E8A020] font-semibold hover:underline flex items-center gap-1">
            <X size={11} /> Clear
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">{filtered.length} paper{filtered.length !== 1 ? "s" : ""} found</p>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No papers match your search.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(pq => (
          <PQCard key={pq.id} pq={pq} onOpen={() => onOpenPQ(pq)} />
        ))}
      </div>
    </div>
  );
}

// ─── QUIZ VIEW ────────────────────────────────────────────────

function QuizView({ preloadPQ, allPqFilesList }: { preloadPQ?: PQFile | null; allPqFilesList: PQFile[] }) {
  const ALL_PQ_FILES = allPqFilesList;
  const [step, setStep] = useState<QuizStep>(preloadPQ ? "setup" : "setup");
  const [selPQ, setSelPQ] = useState<string>(preloadPQ?.id || ALL_PQ_FILES[0]?.id || "pq_cpe508_2223");
  const [selTopics, setSelTopics] = useState<string[]>([]);
  const [numQ, setNumQ] = useState(5);
  const [timed, setTimed] = useState(false);
  const [limitMin, setLimitMin] = useState(10);
  const [immediate, setImmediate] = useState(true);
  const [questions, setQuestions] = useState<PQQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [gradingLoading, setGradingLoading] = useState(false);
  const [showSol, setShowSol] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [theoryInput, setTheoryInput] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (ALL_PQ_FILES.length > 0 && !ALL_PQ_FILES.find(p => p.id === selPQ)) {
      setSelPQ(ALL_PQ_FILES[0].id);
    }
  }, [ALL_PQ_FILES, selPQ]);

  const pqFile = ALL_PQ_FILES.find(p => p.id === selPQ);
  const topics = [...new Set((pqFile?.questions || []).map(q => q.topic))];

  const start = () => {
    let pool = (pqFile?.questions || []).filter(q =>
      selTopics.length === 0 || selTopics.includes(q.topic));
    if (!pool.length) pool = pqFile?.questions || [];
    if (!pool.length) pool = ALL_PQ_FILES.flatMap(p => p.questions);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, numQ);
    setQuestions(shuffled);
    setIdx(0); setAnswers({}); setQuestionScores({}); setFeedbacks({}); setShowSol(false); setTheoryInput("");
    if (timed) {
      setTimeLeft(limitMin * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current!); setStep("results"); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    setStep("taking");
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const q = questions[idx];

  const totalMarksEarned = Object.values(questionScores).reduce((a, b) => a + b, 0);
  const totalPossibleMarks = questions.reduce((sum, qx) => sum + (qx.marks || 5), 0);
  const percentage = totalPossibleMarks > 0 ? Math.round((totalMarksEarned / totalPossibleMarks) * 100) : 0;

  const userAns = q && answers[q.id];

  const answer = (a: string) => {
    if (answers[q.id]) return;
    setAnswers(p => ({ ...p, [q.id]: a }));
    const isCorrect = a === q.answer;
    setQuestionScores(p => ({ ...p, [q.id]: isCorrect ? (q.marks || 5) : 0 }));
    setFeedbacks(p => ({ ...p, [q.id]: isCorrect ? "Correct!" : `Incorrect. The correct answer is: ${q.answer}` }));
    if (immediate) setShowSol(true);
  };

  const submitTheory = async () => {
    if (!theoryInput.trim()) return;
    setAnswers(p => ({ ...p, [q.id]: theoryInput }));
    setGradingLoading(true);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: q.text,
          solution: q.solution,
          studentAnswer: theoryInput,
          marks: q.marks || 5
        })
      });
      const gradeResult = await res.json();
      setQuestionScores(p => ({ ...p, [q.id]: gradeResult.score ?? 0 }));
      setFeedbacks(p => ({ ...p, [q.id]: gradeResult.feedback || "Answer submitted." }));
    } catch (err) {
      console.error(err);
      setQuestionScores(p => ({ ...p, [q.id]: 0 }));
      setFeedbacks(p => ({ ...p, [q.id]: "Failed to grade theory answer." }));
    } finally {
      setGradingLoading(false);
      if (immediate) setShowSol(true);
    }
  };

  const next = () => {
    if (idx < questions.length - 1) { setIdx(i => i + 1); setShowSol(false); setTheoryInput(""); }
    else { if (timerRef.current) clearInterval(timerRef.current!); setStep("results"); }
  };

  const Toggle = ({ on, toggle, label, sub }: { on: boolean; toggle: () => void; label: string; sub: string }) => (
    <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl">
      <div><p className="text-sm font-semibold text-gray-700">{label}</p><p className="text-xs text-gray-400">{sub}</p></div>
      <button onClick={toggle} className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", on ? "bg-[#0F2340]" : "bg-gray-200")}>
        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );

  if (step === "setup") return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Generate Quiz</h1>
        <p className="text-gray-500 text-sm mt-1">Build a custom quiz from any past question paper.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Question Paper</label>
          <select value={selPQ} onChange={e => { setSelPQ(e.target.value); setSelTopics([]); }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 focus:border-[#0F2340]">
            {ALL_PQ_FILES.map(p => <option key={p.id} value={p.id}>{p.courseCode} — {p.session} ({p.semester})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Topics <span className="font-normal text-gray-300 normal-case">(empty = all)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {topics.map(t => (
              <button key={t} onClick={() => setSelTopics(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  selTopics.includes(t) ? "bg-[#0F2340] text-white border-[#0F2340]" : "border-gray-200 text-gray-500 hover:border-[#0F2340] hover:text-[#0F2340]")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Questions: <span className="text-[#E8A020] text-sm font-bold">{numQ}</span>
          </label>
          <input type="range" min={3} max={Math.min(20, pqFile?.questions.length || 20)} value={numQ}
            onChange={e => setNumQ(Number(e.target.value))} className="w-full accent-[#E8A020]" />
          <div className="flex justify-between text-[10px] text-gray-300 mt-1"><span>3</span><span>20</span></div>
        </div>
        <div className="space-y-2">
          <Toggle on={timed} toggle={() => setTimed(p => !p)} label="Timed Quiz" sub="Adds a countdown timer" />
          {timed && (
            <div className="px-4">
              <label className="block text-xs text-gray-500 mb-1">Time: <span className="text-[#E8A020] font-bold">{limitMin} min</span></label>
              <input type="range" min={5} max={60} step={5} value={limitMin} onChange={e => setLimitMin(Number(e.target.value))} className="w-full accent-[#E8A020]" />
            </div>
          )}
          <Toggle on={immediate} toggle={() => setImmediate(p => !p)} label="Immediate Feedback" sub="Show answer after each question" />
        </div>
        <button onClick={start}
          className="w-full bg-[#E8A020] text-[#0F2340] font-bold py-3.5 rounded-2xl hover:bg-[#d49018] transition-colors flex items-center justify-center gap-2">
          <Play size={16} fill="currentColor" /> Start Quiz
        </button>
      </div>
    </div>
  );

  if (step === "results") return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
          percentage >= 70 ? "bg-emerald-100" : "bg-amber-100")}>
          <Award size={36} className={percentage >= 70 ? "text-emerald-600" : "text-amber-600"} />
        </div>
        <h2 className="text-2xl font-bold text-[#0F2340]">Quiz Complete!</h2>
        <p className="text-gray-400 text-sm mt-1 mb-6">
          {percentage >= 70 ? "Excellent work — keep this up!" : "Good effort — review the solutions below."}
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { l: "Marks Earned", v: `${totalMarksEarned}/${totalPossibleMarks}`, c: "text-[#0F2340]" },
            { l: "Accuracy Rating", v: `${percentage}%`, c: "text-emerald-600" },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-gray-50 rounded-2xl p-4">
              <p className={cn("text-2xl font-bold", c)}>{v}</p>
              <p className="text-xs text-gray-400 mt-1">{l}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3 mb-6 text-left max-h-60 overflow-y-auto">
          {questions.map(qx => {
            const earned = questionScores[qx.id] || 0;
            const possible = qx.marks || 5;
            const ok = earned >= possible * 0.6;
            const fb = feedbacks[qx.id] || "";
            return (
              <div key={qx.id} className={cn("p-3.5 rounded-xl border text-sm", ok ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
                <div className="flex items-start gap-2.5">
                  {ok ? <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 text-xs font-semibold">Question {questions.indexOf(qx) + 1}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{qx.text}</p>
                    <div className="mt-2 text-xs">
                      <span className="font-semibold text-gray-700">Your Answer: </span>
                      <span className="text-gray-600 italic">"{answers[qx.id] || "No answer"}"</span>
                    </div>
                    {fb && (
                      <div className="mt-1.5 text-xs text-[#0F2340]">
                        <span className="font-semibold">Grading Feedback: </span>
                        <span>{fb} ({earned}/{possible} Marks)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setStep("setup"); if (timerRef.current) clearInterval(timerRef.current!); }}
            className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">New Quiz</button>
          <button onClick={start}
            className="flex-1 bg-[#0F2340] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#1a3a6b]">Retry</button>
        </div>
      </div>
    </div>
  );

  if (!q) return null;
  const fm = freqMeta(q.frequency);

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Question {idx + 1} of {questions.length}</p>
          <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-2">
            <div className="h-full bg-[#E8A020] rounded-full transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
          </div>
        </div>
        {timed && (
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-bold text-sm",
            timeLeft < 60 ? "bg-red-100 text-red-600 animate-pulse" : "bg-gray-100 text-gray-700")}>
            <Clock size={14} /> {fmt(timeLeft)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs font-bold text-[#0F2340] bg-blue-50 px-2.5 py-0.5 rounded-lg">{q.section === "A" ? "Section A" : "Section B"}</span>
          <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-lg">{q.topic}</span>
          <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg", fm.cls)}>
            <FreqIcon type={fm.icon} /> {fm.label}
          </span>
        </div>

        <p className="text-sm text-gray-800 leading-relaxed mb-5">{q.text}</p>

        {q.options ? (
          <div className="space-y-2">
            {q.options.map(opt => (
              <button key={opt} onClick={() => answer(opt)} disabled={!!userAns}
                className={cn("w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                  !userAns && "border-gray-200 text-gray-700 hover:border-[#0F2340] hover:bg-blue-50",
                  userAns && opt === q.answer && "bg-emerald-100 border-emerald-300 text-emerald-800",
                  userAns && opt === userAns && opt !== q.answer && "bg-red-100 border-red-300 text-red-700",
                  userAns && opt !== userAns && opt !== q.answer && "border-gray-100 text-gray-400 opacity-50",
                )}>
                <span className="flex items-center gap-2">
                  {userAns && opt === q.answer && <Check size={13} className="text-emerald-600 shrink-0" />}
                  {userAns && opt === userAns && opt !== q.answer && <X size={13} className="text-red-500 shrink-0" />}
                  {opt}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <textarea rows={4} placeholder="Write your answer here..."
              value={theoryInput} onChange={e => !userAns && setTheoryInput(e.target.value)} disabled={!!userAns || gradingLoading}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 resize-none mb-2 disabled:bg-gray-50" />
            {!userAns && (
              <button onClick={submitTheory} disabled={gradingLoading || !theoryInput.trim()}
                className="bg-[#0F2340] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#1a3a6b] transition-colors flex items-center gap-2 disabled:opacity-40">
                {gradingLoading ? <><Loader2 size={13} className="animate-spin" /> Grading Answer...</> : "Submit"}
              </button>
            )}
          </div>
        )}

        {(showSol || (userAns && immediate)) && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-2">Solution</p>
            <p className="text-xs text-blue-900 whitespace-pre-line leading-relaxed font-mono">{q.solution}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <button onClick={() => setShowSol(p => !p)} disabled={!userAns || gradingLoading}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 disabled:opacity-40">
            <Eye size={13} /> {showSol ? "Hide" : "Reveal"} solution
          </button>
          <button onClick={next} disabled={!userAns || gradingLoading}
            className="bg-[#E8A020] text-[#0F2340] px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#d49018] disabled:opacity-40 flex items-center gap-2">
            {idx < questions.length - 1 ? "Next" : "Finish"} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FORUM VIEW ───────────────────────────────────────────────

function ForumView({ user }: { user: User }) {
  const [selCourse, setSelCourse] = useState("CPE 508");
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selThread, setSelThread] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [comment, setComment] = useState("");
  const [attached, setAttached] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchThreads = async () => {
    try {
      const q = query(collection(db, 'threads'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          courseId: data.courseCode || data.courseId || "General",
          title: data.title || "",
          author: data.authorName || "Anonymous",
          authorAvatar: (data.authorName || "AN").substring(0, 2).toUpperCase(),
          date: new Date(data.createdAt || Date.now()).toISOString().split("T")[0],
          views: data.views || 0,
          likes: data.likes ? data.likes.length : 0,
          replies: data.comments ? data.comments.length : 0,
          pinned: data.pinned || false,
          body: data.content || "",
          comments: (data.comments || []).map((c: any, index: number) => ({
            id: c.id || `c_${index}`,
            author: c.authorName || c.author || "Anonymous",
            role: c.role || "Student",
            avatar: (c.authorName || c.author || "AN").substring(0, 2).toUpperCase(),
            date: new Date(c.createdAt || Date.now()).toISOString().split("T")[0],
            text: c.content || c.text || "",
            likes: c.likes ? c.likes.length : 0,
            isLiked: c.likes ? c.likes.includes(auth.currentUser?.uid || "") : false
          })),
          rawLikes: data.likes || []
        };
      });
      setThreads(fetched);
    } catch (err) {
      console.error("Error fetching forum threads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  const courses = [...new Set(ALL_PQ_FILES.map(p => p.courseCode))];
  const courseThreads = threads.filter(t => t.courseId === selCourse);
  const thread = threads.find(t => t.id === selThread);

  const postThread = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    try {
      await addDoc(collection(db, 'threads'), {
        courseCode: selCourse.toUpperCase(),
        title: newTitle,
        content: newBody,
        authorId: auth.currentUser?.uid || "anonymous",
        authorName: user.name,
        createdAt: Date.now(),
        likes: [],
        comments: []
      });
      setNewTitle(""); setNewBody(""); setNewOpen(false); setAttached(null);
      await fetchThreads();
    } catch (err) {
      console.error(err);
    }
  };

  const postComment = async (tid: string) => {
    if (!comment.trim()) return;
    try {
      const threadRef = doc(db, 'threads', tid);
      const newComment = {
        id: `c_${Date.now()}`,
        authorName: user.name,
        role: user.role === "admin" ? "Admin" : user.role === "lecturer" ? "Lecturer" : "Student",
        content: comment,
        createdAt: Date.now(),
        likes: []
      };
      await updateDoc(threadRef, {
        comments: arrayUnion(newComment)
      });
      setComment("");
      await fetchThreads();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleThreadLike = async (tid: string) => {
    const th = threads.find(t => t.id === tid);
    if (!th) return;
    const hasLiked = th.rawLikes.includes(auth.currentUser?.uid || "");
    const threadRef = doc(db, 'threads', tid);
    try {
      await updateDoc(threadRef, {
        likes: hasLiked ? arrayRemove(auth.currentUser?.uid) : arrayUnion(auth.currentUser?.uid)
      });
      await fetchThreads();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCommentLike = async (tid: string, cid: string) => {
    const threadRef = doc(db, 'threads', tid);
    try {
      const threadSnap = await getDoc(threadRef);
      if (!threadSnap.exists()) return;
      const data = threadSnap.data();
      const updatedComments = (data.comments || []).map((c: any) => {
        if (c.id !== cid) return c;
        const currentLikes = c.likes || [];
        const uid = auth.currentUser?.uid || "anonymous";
        const hasLiked = currentLikes.includes(uid);
        return {
          ...c,
          likes: hasLiked ? currentLikes.filter((id: string) => id !== uid) : [...currentLikes, uid]
        };
      });
      await updateDoc(threadRef, { comments: updatedComments });
      await fetchThreads();
    } catch (err) {
      console.error(err);
    }
  };

  const roleBadge = (role: string) => {
    if (role === "Admin" || role === "Lecturer") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-500";
  };

  if (selThread && thread) return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <button onClick={() => setSelThread(null)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#0F2340] mb-5 transition-colors">
        <ChevronLeft size={15} /> Back to forum
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <h1 className="text-xl font-bold text-[#0F2340] mb-3">{thread.title}</h1>
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#0F2340] flex items-center justify-center text-white text-[10px] font-bold">{thread.authorAvatar}</div>
            <span className="font-semibold text-gray-600">{thread.author}</span>
          </div>
          <span>·</span><span>{thread.date}</span><span>·</span>
          <span className="flex items-center gap-1"><Eye size={11} />{thread.views}</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{thread.body}</p>
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-50">
          <button onClick={() => toggleThreadLike(thread.id)}
            className={cn("flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition-all",
              thread.rawLikes?.includes(auth.currentUser?.uid || "") ? "bg-red-50 text-red-500" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600")}>
            <Heart size={14} fill={thread.rawLikes?.includes(auth.currentUser?.uid || "") ? "currentColor" : "none"} /> {thread.likes}
          </button>
          <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {thread.comments.length === 0 && <p className="text-sm text-gray-300 text-center py-4">No replies yet — be the first!</p>}
        {thread.comments.map((c: any) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-[#E8A020] flex items-center justify-center text-[10px] font-bold text-[#0F2340]">{c.avatar}</div>
              <span className="text-sm font-bold text-gray-800">{c.author}</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wide", roleBadge(c.role))}>{c.role}</span>
              <span className="text-xs text-gray-300 ml-auto">{c.date}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{c.text}</p>
            <button onClick={() => toggleCommentLike(thread.id, c.id)}
              className={cn("flex items-center gap-1.5 text-xs font-semibold mt-2.5 px-2 py-1 rounded-lg transition-all",
                c.isLiked ? "text-red-500 bg-red-50" : "text-gray-300 hover:bg-gray-50 hover:text-gray-500")}>
              <Heart size={11} fill={c.isLiked ? "currentColor" : "none"} /> {c.likes}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <textarea rows={3} placeholder="Write a reply..." value={comment} onChange={e => setComment(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 focus:border-[#0F2340] mb-3 transition-all" />
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
              <Image size={13} /> Image
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
              <Paperclip size={13} /> PDF
            </button>
            {attached && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={10} />{attached.name}</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => setAttached(e.target.files?.[0] || null)} />
          <button onClick={() => postComment(thread.id)}
            className="bg-[#0F2340] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#1a3a6b] flex items-center gap-1.5">
            <Send size={13} /> Reply
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2340]">Discussion Forum</h1>
          <p className="text-gray-500 text-sm mt-1">Course-specific threads — discuss questions, share solutions, post papers.</p>
        </div>
        <button onClick={() => setNewOpen(true)}
          className="bg-[#E8A020] text-[#0F2340] px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#d49018] flex items-center gap-2 shrink-0">
          <Plus size={15} /> New Thread
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {courses.map(c => (
          <button key={c} onClick={() => setSelCourse(c)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              selCourse === c ? "bg-[#0F2340] text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-[#0F2340] hover:text-[#0F2340]")}>
            {c}
          </button>
        ))}
      </div>

      {newOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[#0F2340]">New Thread — {selCourse}</h2>
              <button onClick={() => setNewOpen(false)} className="text-gray-300 hover:text-gray-600"><X size={18} /></button>
            </div>
            <input placeholder="Thread title..." value={newTitle} onChange={e => setNewTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <textarea rows={5} placeholder="Describe your question or topic in detail..." value={newBody} onChange={e => setNewBody(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-50">
                <Image size={13} /> Attach Image or PDF
              </button>
              {attached && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={10} />{attached.name}</span>}
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => setAttached(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNewOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={postThread} className="px-4 py-2 text-sm bg-[#0F2340] text-white rounded-xl font-bold hover:bg-[#1a3a6b]">Post Thread</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {courseThreads.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <MessageSquare size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No threads yet for {selCourse}.</p>
            <button onClick={() => setNewOpen(true)} className="mt-3 text-sm text-[#E8A020] font-semibold hover:underline">Start one →</button>
          </div>
        )}
        {courseThreads.map((t: any) => (
          <div key={t.id} onClick={() => setSelThread(t.id)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md cursor-pointer transition-all group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {t.pinned && <Star size={12} className="text-[#E8A020] shrink-0" fill="currentColor" />}
                  <h3 className="font-bold text-gray-800 text-sm group-hover:text-[#0F2340] line-clamp-1">{t.title}</h3>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{t.body}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-5 h-5 rounded-full bg-[#0F2340] flex items-center justify-center text-white text-[9px] font-bold">{t.authorAvatar}</div>
                  <span>{t.author}</span><span>·</span><span>{t.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-300 shrink-0">
                <span className="flex items-center gap-1"><Eye size={11} />{t.views}</span>
                <span className="flex items-center gap-1"><Heart size={11} />{t.likes}</span>
                <span className="flex items-center gap-1"><MessageSquare size={11} />{t.replies}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UPLOAD VIEW ──────────────────────────────────────────────

const MOCK_OCR_CPE508 = `OBAFEMI AWOLOWO UNIVERSITY ILE-IFE, NIGERIA
FACULTY OF TECHNOLOGY
DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING

CPE 508 Computer System Project Management
Rain Semester Examination — 2022/2023 Academic Session
July, 2024

TIME ALLOWED: 2 Hours
ATTEMPT ALL QUESTIONS IN SECTION A AND ANY FOUR (4) QUESTIONS IN SECTION B

────────────────────────────────────────────
SECTION A (10 Marks) — Fill in the Blank

1) The output of every activity is known as ______________
2) A dependency relationship type where the successor activity cannot start unless the predecessor activity finishes is called ______________
3) A mark that signifies the end of a set of activities in a project is known as _____________
4) _________ is an amazing tool in project management that shows a hierarchical breakdown of work activities...
5) A type of dependency where activities stay the same, yet, the order changes, is called ___________
6) A process to 'mitigate the adverse effects of loss' in Project Management is called: ________________
7) The ultimate aim of a Project is to ___________________________
8) External stakeholders can be __________ and _____________
9) Decision tree analysis is majorly used for ______________________
10) In making decision, it means you have ______________________

────────────────────────────────────────────
SECTION B

QUESTION #1 (15 Marks)
a) Correlate between Openness in the group and confidentiality as norms of a project team.
b) There is diversity in IT project; why do you need a legal adviser?
c) A project is proposed to develop a transcript system for the university...

QUESTION #5 (15 Marks) — Calculations
a) What does SPI value of 1 mean?
b) AC = 800, EV = 780, PV = 810. Calculate the schedule variance.
c) AC = 2100, EV = 1500. What is the cost variance?
...`;

function UploadView({ userProfile, fetchQuestions }: { userProfile: any; fetchQuestions: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autoTitle, setAutoTitle] = useState("");
  const [selCourse, setSelCourse] = useState("");
  const [selSession, setSelSession] = useState("");
  const [selSem, setSelSem] = useState("First");
  const [submitted, setSubmitted] = useState(false);
  const [cleaningText, setCleaningText] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cleanOCRText = async () => {
    if (!ocrText) return;
    setCleaningText(true);
    try {
      const res = await fetch("/api/clean-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: ocrText })
      });
      const data = await res.json();
      if (data.cleanedText) {
        setOcrText(data.cleanedText);
      }
    } catch (err) {
      console.error("AI Cleaning failed:", err);
    } finally {
      setCleaningText(false);
    }
  };

  const detectMeta = (filename: string, content?: string) => {
    const codeMatch = filename.match(/CPE[_\s]?(\d+)/i) ||
      filename.match(/MTH[_\s]?(\d+)/i) || filename.match(/PHY[_\s]?(\d+)/i) ||
      filename.match(/CSC[_\s]?(\d+)/i) || filename.match(/CHE[_\s]?(\d+)/i);
    const yearMatch = filename.match(/(\d{2})(\d{2})/) || filename.match(/(\d{4})/);

    if (codeMatch) {
      const prefix = filename.match(/^([A-Z]+)/i)?.[1]?.toUpperCase() || "CPE";
      const code = `${prefix} ${codeMatch[1]}`;
      setSelCourse(code);
      const year1 = yearMatch ? `20${yearMatch[1]}` : "2022";
      const year2 = yearMatch ? `20${yearMatch[2]}` : "2023";
      const session = `${year1}/${year2}`;
      setSelSession(session);
      setAutoTitle(`${code} Exam Question ${session}`);
    }
  };

  const load = (f: File) => {
    setFile(f); setOcrText(""); setOcrDone(false); setSubmitted(false);
    detectMeta(f.name);
    if (f.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = e => setPreview(e.target?.result as string);
      r.readAsDataURL(f);
    } else setPreview(null);
  };

  const runOCR = async () => {
    if (!file) return;
    setOcrLoading(true); setOcrText("");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch("/api/ocr", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              file: base64Data,
              filename: file.name
            })
          });
          const data = await res.json();
          if (data.text) {
            setOcrText(data.text);
            setOcrDone(true);
          } else {
            setOcrText(data.error || "OCR Extraction failed.");
          }
        } catch (err: any) {
          setOcrText(err.message || "Failed to contact OCR API.");
        } finally {
          setOcrLoading(false);
        }
      };
    } catch (err: any) {
      console.error(err);
      setOcrLoading(false);
    }
  };

  const submitForReview = async () => {
    if (!selCourse || !selSession || !ocrText) return;
    try {
      const qRegex = /(?:Question|Q|QUESTION)\s*\d+[:\.\s]*/gi;
      const parts = ocrText.split(qRegex);
      const matches = ocrText.match(qRegex);
      
      const toInsert: any[] = [];
      if (parts.length > 1) {
        parts.forEach((content, idx) => {
          if (idx === 0) return;
          const qNum = matches ? matches[idx - 1].replace(/[^0-9]/g, '') : String(idx);
          toInsert.push({
            courseCode: selCourse.toUpperCase(),
            courseTitle: selCourse.toUpperCase(),
            department: "General",
            faculty: "Technology",
            session: selSession,
            semester: selSem,
            year: Number(selSession.split('/')[0]) || 2024,
            instructions: parts[0].trim().substring(0, 200) || "Attempt all questions.",
            section: "A",
            number: qNum || String(idx),
            marks: 20,
            topic: "General",
            frequency: 5,
            questionText: content.trim(),
            solutionText: "Awaiting lecturer/admin solution.",
            type: "theory",
            status: "pending",
            createdAt: Date.now(),
            createdBy: userProfile?.id || "anonymous"
          });
        });
      } else {
        toInsert.push({
          courseCode: selCourse.toUpperCase(),
          courseTitle: selCourse.toUpperCase(),
          department: "General",
          faculty: "Technology",
          session: selSession,
          semester: selSem,
          year: Number(selSession.split('/')[0]) || 2024,
          instructions: "Attempt all questions.",
          section: "A",
          number: "1",
          marks: 100,
          topic: "General",
          frequency: 5,
          questionText: ocrText,
          solutionText: "Awaiting lecturer/admin solution.",
          type: "theory",
          status: "pending",
          createdAt: Date.now(),
          createdBy: userProfile?.id || "anonymous"
        });
      }
      
      await Promise.all(toInsert.map(item => addDoc(collection(db, 'questions'), item)));
      setSubmitted(true);
      fetchQuestions();
    } catch (err) {
      console.error("Error submitting paper for review:", err);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Upload Question Paper</h1>
        <p className="text-gray-500 text-sm mt-1">Upload an image or PDF — metadata is auto-detected from the filename, and OCR extracts the full text.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
            onClick={() => fileRef.current?.click()}
            className={cn("border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all min-h-[160px] flex flex-col items-center justify-center",
              dragging ? "border-[#E8A020] bg-amber-50" : "border-gray-200 hover:border-[#0F2340] hover:bg-blue-50/20")}>
            {preview
              ? <img src={preview} alt="Preview" className="w-full h-36 object-contain rounded-xl mb-2" />
              : <><Camera size={32} className="text-gray-200 mb-3" /><p className="text-sm font-semibold text-gray-500">Drop image or PDF here</p><p className="text-xs text-gray-300 mt-1">PNG · JPG · PDF · HEIC</p></>
            }
            {file && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><Check size={11} />{file.name}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => { if (e.target.files?.[0]) load(e.target.files[0]); }} />

          {autoTitle && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Auto-detected</p>
              <p className="text-sm font-bold text-emerald-800">{autoTitle}</p>
            </div>
          )}

          <div className="space-y-2">
            <input value={selCourse} onChange={e => setSelCourse(e.target.value)}
              placeholder="Course Code (e.g. CPE 508)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <input value={selSession} onChange={e => setSelSession(e.target.value)}
              placeholder="Session (e.g. 2022/2023)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <select value={selSem} onChange={e => setSelSem(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20">
              <option value="First">First Semester</option>
              <option value="Second">Second Semester</option>
              <option value="Rain">Rain Semester</option>
              <option value="Harmattan">Harmattan Semester</option>
            </select>
          </div>

          {file && !ocrDone && (
            <button onClick={runOCR} disabled={ocrLoading}
              className="w-full bg-[#0F2340] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#1a3a6b] disabled:opacity-60 flex items-center justify-center gap-2">
              {ocrLoading ? <><Loader2 size={15} className="animate-spin" /> Extracting text...</> : <><FileText size={15} /> Extract Text (OCR)</>}
            </button>
          )}

          {!file && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><AlertCircle size={13} /> How it works</p>
              <ol className="text-xs text-blue-600 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Upload a photo or PDF of any past question paper</li>
                <li>Metadata (course, session) is auto-detected from the filename</li>
                <li>Click "Extract Text" — OCR reads and transcribes the paper</li>
                <li>Review and edit the extracted text, then submit for admin review</li>
              </ol>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Extracted Text</label>
            {ocrDone && (
              <div className="flex items-center gap-3">
                <button onClick={cleanOCRText} disabled={cleaningText}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:underline font-semibold disabled:opacity-50">
                  {cleaningText ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Clean with AI
                </button>
                <button onClick={() => {
                  const blob = new Blob([ocrText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob); const a = document.createElement("a");
                  a.href = url; a.download = `${(selCourse || "paper").replace(" ", "_")}_${selSession?.replace("/", "_")}.txt`; a.click();
                  URL.revokeObjectURL(url);
                }} className="flex items-center gap-1 text-xs text-blue-500 hover:underline font-semibold">
                  <Download size={12} /> Save
                </button>
              </div>
            )}
          </div>
          <textarea value={ocrText} onChange={e => setOcrText(e.target.value)}
            placeholder="Extracted text will appear here after OCR..."
            rows={18}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-xs leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 bg-gray-50 font-mono" />
          {ocrDone && !submitted && (
            <button onClick={submitForReview}
              className="mt-3 w-full bg-[#E8A020] text-[#0F2340] rounded-xl py-3 text-sm font-bold hover:bg-[#d49018] flex items-center justify-center gap-2">
              <CheckCircle size={15} /> Submit for Admin Review
            </button>
          )}
          {submitted && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-sm text-emerald-700 font-semibold">
              <CheckCircle size={15} /> Submitted! Awaiting admin approval.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TRENDS VIEW ──────────────────────────────────────────────

function TrendsView() {
  const [selPQ, setSelPQ] = useState("pq_cpe508_2223");
  const pq = ALL_PQ_FILES.find(p => p.id === selPQ)!;
  const topicMap = new Map<string, number>();
  pq.questions.forEach(q => topicMap.set(q.topic, q.frequency));
  const topicStats = [...topicMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxFreq = topicStats[0]?.[1] || 1;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Trend Analysis</h1>
        <p className="text-gray-500 text-sm mt-1">See which topics appear most frequently across 25 years of past questions.</p>
      </div>
      <div className="mb-6">
        <select value={selPQ} onChange={e => setSelPQ(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20">
          {ALL_PQ_FILES.map(p => <option key={p.id} value={p.id}>{p.courseCode} — {p.session}</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Topic Frequency Ranking</h2>
          <div className="space-y-4">
            {topicStats.map(([topic, freq], i) => {
              const fm = freqMeta(freq);
              return (
                <div key={topic}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold w-5 h-5 rounded-md flex items-center justify-center",
                        i === 0 ? "bg-[#E8A020] text-[#0F2340]" : i <= 2 ? "bg-gray-200 text-gray-600" : "bg-gray-100 text-gray-400")}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{topic}</span>
                      {i === 0 && <span className="text-[10px] font-bold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-lg uppercase">HOT</span>}
                    </div>
                    <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg", fm.cls)}>
                      <FreqIcon type={fm.icon} /> {freq}×
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700",
                      freq >= 10 ? "bg-red-400" : freq >= 7 ? "bg-[#E8A020]" : "bg-[#0F2340]")}
                      style={{ width: `${(freq / maxFreq) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#0F2340] rounded-2xl p-6">
            <h2 className="font-bold text-[#E8A020] text-xs uppercase tracking-widest mb-4">Study Priority Guide</h2>
            <div className="space-y-3">
              {[
                { label: "🔥 Must Revise", topics: topicStats.filter(([, f]) => f >= 10).map(([t]) => t), cls: "border-red-400 text-red-300" },
                { label: "⚡ Important", topics: topicStats.filter(([, f]) => f >= 7 && f < 10).map(([t]) => t), cls: "border-[#E8A020] text-[#E8A020]" },
                { label: "📌 Supplementary", topics: topicStats.filter(([, f]) => f < 7).map(([t]) => t).slice(0, 3), cls: "border-white/20 text-white/50" },
              ].filter(g => g.topics.length > 0).map(({ label, topics, cls }) => (
                <div key={label} className={cn("border rounded-xl p-3", cls.split(" ")[0])}>
                  <p className={cn("text-xs font-bold mb-1.5", cls.split(" ")[1])}>{label}</p>
                  {topics.map(t => <p key={t} className="text-white/70 text-xs">{t}</p>)}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Paper Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "Course", v: pq.courseCode },
                { l: "Session", v: pq.session },
                { l: "Semester", v: pq.semester },
                { l: "Total Qs", v: String(pq.questions.length) },
                { l: "Total Marks", v: `${pq.totalMarks} marks` },
                { l: "Sections", v: [...new Set(pq.questions.map(q => q.section))].join(", ") },
              ].map(({ l, v }) => (
                <div key={l} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">{l}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REPOSITORY (Admin) ───────────────────────────────────────

function RepositoryView({ onOpenPQ, allPqFilesList, fetchQuestions }: {
  onOpenPQ: (pq: PQFile) => void;
  allPqFilesList: PQFile[];
  fetchQuestions: () => void;
}) {
  const ALL_PQ_FILES = allPqFilesList;
  const [pendingQs, setPendingQs] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, "approved" | "rejected">>({});
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    try {
      const q = query(collection(db, 'questions'), where('status', '==', 'pending'));
      const qSnap = await getDocs(q);
      setPendingQs(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (qId: string, status: "approved" | "rejected") => {
    try {
      const qRef = doc(db, 'questions', qId);
      await updateDoc(qRef, { status });
      setStatuses(p => ({ ...p, [qId]: status }));
      
      if (status === "approved") {
        const docSnap = await getDoc(qRef);
        if (docSnap.exists()) {
          const qData = docSnap.data();
          const { courseCode, session, semester, questionText } = qData;
          
          const mcqQuery = query(
            collection(db, 'questions'), 
            where('courseCode', '==', courseCode),
            where('session', '==', session),
            where('type', '==', 'mcq')
          );
          const mcqSnap = await getDocs(mcqQuery);
          if (mcqSnap.empty) {
            console.log(`Generating automated MCQs for ${courseCode} (${session})...`);
            fetch("/api/generate-quizzes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                courseCode,
                session,
                semester,
                paperText: questionText
              })
            }).then(res => res.json())
              .then(async (data) => {
                if (data.quizzes && data.quizzes.length > 0) {
                  const toInsert = data.quizzes.map((item: any) => ({
                    courseCode: courseCode.toUpperCase(),
                    courseTitle: courseCode.toUpperCase(),
                    department: qData.department || "General",
                    faculty: qData.faculty || "Technology",
                    session,
                    semester,
                    year: qData.year || 2024,
                    instructions: "Choose the correct option.",
                    section: "A",
                    number: "MCQ",
                    marks: item.marks || 5,
                    topic: item.topic || "General",
                    frequency: 5,
                    questionText: item.questionText,
                    solutionText: item.solution,
                    answer: item.answer,
                    options: item.options,
                    type: "mcq",
                    status: "approved",
                    createdAt: Date.now(),
                    createdBy: "auto-quiz-generator"
                  }));
                  await Promise.all(toInsert.map((item: any) => addDoc(collection(db, 'questions'), item)));
                  console.log(`Auto-generated and saved ${toInsert.length} MCQs for ${courseCode}.`);
                  fetchQuestions();
                }
              }).catch(err => console.error("Auto quiz generation failed:", err));
          }
        }
      }
      
      fetchQuestions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Repository</h1>
        <p className="text-gray-500 text-sm mt-1">All uploaded past question papers — approve, reject, or manage submissions.</p>
      </div>

      <div className="grid gap-6">
        {/* Published papers */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-[#0F2340] text-sm">Published Papers ({ALL_PQ_FILES.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {ALL_PQ_FILES.map(pq => (
              <div key={pq.id} className="p-4 flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0", deptColor(pq.department))}>
                  {pq.courseCode.split(" ")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{pq.courseCode} Exam Question {pq.session}</p>
                  <p className="text-xs text-gray-400">{pq.courseTitle} · {pq.semester} Sem · {pq.questions.length} questions · {pq.totalMarks} marks</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Check size={10} /> Published
                  </span>
                  <button onClick={() => onOpenPQ(pq)}
                    className="text-xs border border-gray-200 px-3 py-1.5 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending approval */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50">
            <h2 className="font-bold text-[#0F2340] text-sm">Pending Approval ({pendingQs.filter(p => !statuses[p.id]).length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingQs.map(item => {
              const s = statuses[item.id];
              return (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">
                      {item.courseCode.split(" ")[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">{item.courseCode} Question {item.number} ({item.session})</p>
                      <p className="text-xs text-gray-400">Semester: {item.semester} · Topic: {item.topic} · Marks: {item.marks}</p>
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg mt-1 font-mono">{item.questionText?.substring(0, 150)}...</p>
                    </div>
                  </div>
                  {s ? (
                    <span className={cn("text-xs font-bold px-2.5 py-1 rounded-xl shrink-0 self-start md:self-center",
                      s === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                      {s === "approved" ? "Approved" : "Rejected"}
                    </span>
                  ) : (
                    <div className="flex gap-2 shrink-0 self-start md:self-center">
                      <button onClick={() => handleAction(item.id, "rejected")}
                        className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-semibold">Reject</button>
                      <button onClick={() => handleAction(item.id, "approved")}
                        className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold">Approve</button>
                    </div>
                  )}
                </div>
              );
            })}
            {pendingQs.length === 0 && (
              <p className="text-sm text-gray-300 text-center py-6">No pending questions — everything is reviewed!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────

function AdminPanel() {
  const [stats, setStats] = useState([
    { label: "Total Papers", val: "0", c: "text-blue-600" },
    { label: "Pending Review", val: "0", c: "text-amber-600" },
    { label: "Registered Users", val: "1", c: "text-emerald-600" },
    { label: "Flagged Posts", val: "0", c: "text-red-500" },
  ]);
  const [userCounts, setUserCounts] = useState({ Students: 0, Lecturers: 0, Admins: 1 });
  const [flagged, setFlagged] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList = usersSnap.docs.map(doc => doc.data());
        const studentsCount = usersList.filter((u: any) => u.role === 'student').length;
        const lecturersCount = usersList.filter((u: any) => u.role === 'lecturer').length;
        const adminsCount = usersList.filter((u: any) => u.role === 'admin').length;

        const pendingSnap = await getDocs(query(collection(db, 'questions'), where('status', '==', 'pending')));
        const pendingCount = pendingSnap.docs.length;

        const approvedSnap = await getDocs(query(collection(db, 'questions'), where('status', '==', 'approved')));
        
        const paperKeys = new Set();
        approvedSnap.docs.forEach(doc => {
          const d = doc.data();
          paperKeys.add(`${d.courseCode}_${d.session}_${d.semester}`);
        });
        const papersCount = paperKeys.size;

        setStats([
          { label: "Total Papers", val: String(papersCount), c: "text-blue-600" },
          { label: "Pending Review", val: String(pendingCount), c: "text-amber-600" },
          { label: "Registered Users", val: String(usersList.length), c: "text-emerald-600" },
          { label: "Flagged Posts", val: "0", c: "text-red-500" },
        ]);

        setUserCounts({
          Students: studentsCount,
          Lecturers: lecturersCount,
          Admins: adminsCount
        });
      } catch (err) {
        console.error(err);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">System overview, user management, and content moderation.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, val, c }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className={cn("text-2xl font-bold", c)}>{val}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="p-5 border-b border-gray-50"><h2 className="font-bold text-[#0F2340] text-sm">Flagged Forum Posts</h2></div>
        <div className="divide-y divide-gray-50">
          {flagged.map(f => (
            dismissed.has(f.id) ? null : (
              <div key={f.id} className="p-4">
                <p className="text-sm font-semibold text-gray-800 mb-0.5">"{f.thread}"</p>
                <p className="text-xs text-gray-400 mb-3">By {f.user} · {f.reason}</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setDismissed(p => new Set([...p, f.id]))}
                    className="px-3 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 font-semibold">Dismiss</button>
                  <button onClick={() => setDismissed(p => new Set([...p, f.id]))}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold">Remove Post</button>
                  <button onClick={() => setDismissed(p => new Set([...p, f.id]))}
                    className="px-3 py-1.5 text-xs bg-[#0F2340] text-white rounded-xl hover:bg-[#1a3a6b] font-semibold">Ban User</button>
                </div>
              </div>
            )
          ))}
          {dismissed.size === flagged.length && (
            <p className="p-4 text-sm text-gray-300 text-center">No flagged posts — all clear!</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-50"><h2 className="font-bold text-[#0F2340] text-sm">User Roles Overview</h2></div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { role: "Students", count: userCounts.Students, desc: "Browse library, take quizzes, join forums", color: "bg-blue-50 text-blue-700" },
              { role: "Lecturers", count: userCounts.Lecturers, desc: "All student features + suggest uploads", color: "bg-purple-50 text-purple-700" },
              { role: "Admins", count: userCounts.Admins, desc: "Full system access — upload, approve, moderate", color: "bg-amber-50 text-amber-700" },
            ].map(({ role, count, desc, color }) => (
              <div key={role} className="bg-gray-50 rounded-2xl p-4">
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg", color)}>{role}</span>
                <p className="text-2xl font-bold text-[#0F2340] mt-2">{count}</p>
                <p className="text-xs text-gray-400 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-red-800 font-bold text-sm">Dangerous Zone</h3>
          <p className="text-red-600 text-xs mt-0.5">Wipe the Firestore database to remove all demo data and start with a fresh website.</p>
        </div>
        <button onClick={async () => {
          if (confirm("Are you sure you want to completely wipe all past questions, forum threads, and user bookmarks from the database? This action is irreversible.")) {
            try {
              const qsSnap = await getDocs(collection(db, 'questions'));
              await Promise.all(qsSnap.docs.map(doc => deleteDoc(doc.ref)));

              const thSnap = await getDocs(collection(db, 'threads'));
              await Promise.all(thSnap.docs.map(doc => deleteDoc(doc.ref)));

              alert("Database successfully wiped! Refresh the page to see the fresh slate.");
              window.location.reload();
            } catch (err: any) {
              alert("Error wiping database: " + err.message);
            }
          }
        }} className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-colors shrink-0">
          Reset Database
        </button>
      </div>
    </div>
  );
}

// ─── RECONSTRUCT PQ FILES FROM DB QUESTIONS ──────────────────

function reconstructPQFiles(questions: any[]): PQFile[] {
  const groups: Record<string, any[]> = {};
  questions.forEach(q => {
    const key = `${q.courseCode}_${q.session || q.year}_${q.semester || 'First'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  });

  return Object.keys(groups).map(key => {
    const qs = groups[key];
    const sample = qs[0];
    const mappedQuestions: PQQuestion[] = qs.map(q => ({
      id: q.id,
      section: q.section || "A",
      number: q.number || "1",
      text: q.questionText || q.text || "",
      marks: q.marks || 1,
      topic: q.topic || "General",
      frequency: q.frequency || 5,
      answer: q.answer || "",
      solution: q.solutionText || q.solution || "",
      type: q.type || "theory",
      options: q.options || undefined
    }));

    mappedQuestions.sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });

    return {
      id: key,
      courseCode: sample.courseCode,
      courseTitle: sample.courseTitle || sample.courseCode,
      department: sample.department || "General",
      faculty: sample.faculty || "Technology",
      session: sample.session || `${sample.year}/${sample.year + 1}`,
      semester: sample.semester || "First",
      year: sample.year || 2024,
      instructions: sample.instructions || "TIME ALLOWED: 2 Hours. Attempt all questions.",
      uploadedBy: sample.createdBy === "system" ? "Dr. Kwame Asante" : "Lecturer",
      uploadDate: new Date(sample.createdAt || Date.now()).toISOString().split("T")[0],
      totalMarks: mappedQuestions.reduce((sum, q) => sum + q.marks, 0) || 100,
      approved: sample.status === "approved",
      questions: mappedQuestions
    };
  });
}

function MainApp() {
  const { user, profile, loading, logout } = useAuth();
  const [view, setView] = useState<View>("library");
  const [selectedPQ, setSelectedPQ] = useState<PQFile | null>(null);
  const [quizPQ, setQuizPQ] = useState<PQFile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dbQuestions, setDbQuestions] = useState<any[]>([]);
  const [allPqFiles, setAllPqFiles] = useState<PQFile[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const fetchQuestions = async () => {
    try {
      const q = query(collection(db, 'questions'), where('status', '==', 'approved'));
      const querySnapshot = await getDocs(q);
      let fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setDbQuestions(fetched);
    } catch (err) {
      console.error("Error fetching questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchQuestions();
    }
  }, [user]);

  useEffect(() => {
    if (dbQuestions.length > 0) {
      setAllPqFiles(reconstructPQFiles(dbQuestions));
    }
  }, [dbQuestions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <Loader2 className="w-8 h-8 text-[#0F2340] animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return <AuthModal />;

  const currentUser = {
    name: profile.name,
    email: profile.email,
    role: profile.role,
    avatar: profile.name.substring(0, 2).toUpperCase()
  };

  const handleOpenPQ = (pq: PQFile) => { setSelectedPQ(pq); setView("library"); };
  const handleStartQuiz = (pq: PQFile) => { setQuizPQ(pq); setSelectedPQ(null); setView("quiz"); };

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden" style={{ fontFamily: "Outfit, sans-serif" }}>
      <div className="hidden lg:flex shrink-0">
        <Sidebar view={view} setView={v => { setView(v); setSelectedPQ(null); }} user={currentUser} onLogout={logout} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-60 h-full">
            <Sidebar view={view} setView={v => { setView(v); setSelectedPQ(null); setMobileOpen(false); }}
              user={currentUser} onLogout={logout}
              mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0F2340] shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-[#E8A020]" />
            <span className="text-white font-bold text-sm">PastQ Hub</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="text-white/60 hover:text-white"><Menu size={20} /></button>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {view === "library" && !selectedPQ && (
            <LibraryView onOpenPQ={handleOpenPQ} onStartQuiz={handleStartQuiz} user={currentUser} allPqFilesList={allPqFiles} />
          )}
          {view === "library" && selectedPQ && (
            <PQViewer pq={selectedPQ} onBack={() => setSelectedPQ(null)} onStartQuiz={handleStartQuiz} userProfile={profile} fetchQuestions={fetchQuestions} />
          )}
          {view === "quiz" && <QuizView preloadPQ={quizPQ} allPqFilesList={allPqFiles} />}
          {view === "forum" && <ForumView user={currentUser} />}
          {view === "upload" && currentUser.role !== "student" && <UploadView userProfile={profile} fetchQuestions={fetchQuestions} />}
          {view === "trends" && <TrendsView allPqFilesList={allPqFiles} />}
          {view === "repository" && currentUser.role === "admin" && (
            <RepositoryView onOpenPQ={handleOpenPQ} allPqFilesList={allPqFiles} fetchQuestions={fetchQuestions} />
          )}
          {view === "admin" && currentUser.role === "admin" && <AdminPanel />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
