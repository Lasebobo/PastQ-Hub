import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Question } from '../types';
import { Settings, Play, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function Quiz() {
  const [mode, setMode] = useState<'setup' | 'taking' | 'results'>('setup');
  const [loading, setLoading] = useState(false);
  
  // Setup State
  const [courseCode, setCourseCode] = useState('');
  const [topic, setTopic] = useState('');
  const [yearStart, setYearStart] = useState<number | ''>('');
  const [yearEnd, setYearEnd] = useState<number | ''>('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [isTimed, setIsTimed] = useState(false);
  const [timeLimit, setTimeLimit] = useState(10); // minutes
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Taking State
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    let timer: any;
    if (mode === 'taking' && isTimed && timeRemaining > 0) {
      timer = setInterval(() => setTimeRemaining(prev => prev - 1), 1000);
    } else if (mode === 'taking' && isTimed && timeRemaining === 0) {
      setMode('results');
    }
    return () => clearInterval(timer);
  }, [mode, isTimed, timeRemaining]);

  const generateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let qRef = collection(db, 'questions');
      let constraints: any[] = [where('status', '==', 'approved')];
      
      if (courseCode) constraints.push(where('courseCode', '==', courseCode.toUpperCase()));
      if (topic) constraints.push(where('topic', '==', topic));
      if (yearStart !== '') constraints.push(where('year', '>=', Number(yearStart)));
      if (yearEnd !== '') constraints.push(where('year', '<=', Number(yearEnd)));
      
      const q = query(qRef, ...constraints, limit(numQuestions * 2)); // fetch more to shuffle
      const snapshot = await getDocs(q);
      
      let fetched: Question[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Question);
      });
      
      // Shuffle and slice
      fetched = fetched.sort(() => 0.5 - Math.random()).slice(0, numQuestions);
      
      if (fetched.length === 0) {
        alert("No questions found matching your criteria.");
        setLoading(false);
        return;
      }
      
      setQuestions(fetched);
      setAnswers({});
      setCurrentIdx(0);
      setShowFeedback(false);
      if (isTimed) setTimeRemaining(timeLimit * 60);
      setMode('taking');
    } catch (err) {
      console.error(err);
      alert("Failed to generate quiz.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (showFeedback) return; // Prevent changing answer while feedback is showing
    
    setAnswers(prev => ({ ...prev, [questions[currentIdx].id]: answer }));
    setShowFeedback(true);
  };

  const handleNext = () => {
    setShowFeedback(false);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setMode('results');
    }
  };

  const calculateScore = () => {
    // Basic evaluation for open-ended text is tough without AI. 
    // For this simple mock, we just check if answer is not empty.
    // In a real app, we might use Gemini to evaluate the answer against the solution.
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] && answers[q.id].trim().length > 0) score++;
    });
    return score;
  };

  if (mode === 'setup') {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Quiz Generator</h1>
            <p className="text-slate-500 mt-1 text-sm">Create a custom practice session</p>
          </div>
          <Settings className="text-indigo-400 w-6 h-6" />
        </div>
        
        <form onSubmit={generateQuiz} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Course Code (Optional)</label>
              <input 
                type="text" placeholder="e.g. MTH201"
                value={courseCode} onChange={e => setCourseCode(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded outline-none focus:border-indigo-500 text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Topic (Optional)</label>
              <input 
                type="text" placeholder="e.g. Calculus"
                value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Start Year (Optional)</label>
              <input 
                type="number" placeholder="e.g. 2018"
                value={yearStart} onChange={e => setYearStart(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2 border border-slate-200 rounded outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">End Year (Optional)</label>
              <input 
                type="number" placeholder="e.g. 2023"
                value={yearEnd} onChange={e => setYearEnd(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2 border border-slate-200 rounded outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Number of Questions</label>
              <input 
                type="number" min={1} max={20} required
                value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}
                className="w-full px-4 py-2 border border-slate-200 rounded outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
               <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Timed Mode</label>
               <div className="flex items-center gap-3">
                 <input 
                   type="checkbox"
                   checked={isTimed} onChange={e => setIsTimed(e.target.checked)}
                   className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                 />
                 <span className="text-sm font-medium text-slate-700">Enable Timer</span>
               </div>
               {isTimed && (
                 <div className="mt-2">
                   <input 
                     type="number" min={1} max={120} required placeholder="Minutes"
                     value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                     className="w-full px-4 py-2 border border-slate-200 rounded outline-none focus:border-indigo-500 text-sm"
                   />
                 </div>
               )}
            </div>
          </div>
          
          <div className="pt-4 text-right border-t border-slate-100">
            <button 
              type="submit" disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded font-bold uppercase tracking-wider text-xs hover:bg-indigo-500 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {loading ? 'Generating...' : 'Start Quiz'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (mode === 'taking') {
    const q = questions[currentIdx];
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-lg shadow-sm">
          <div className="text-sm font-bold text-slate-600">Question {currentIdx + 1} of {questions.length}</div>
          {isTimed && (
            <div className="flex items-center gap-2 text-rose-600 font-mono font-bold text-sm bg-rose-50 px-3 py-1 rounded-md">
              <Clock className="w-4 h-4" />
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
        
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold uppercase tracking-wider">{q.courseCode}</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">{q.year}</span>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">{q.topic}</span>
          </div>
          
          <div className="text-lg font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
            {q.questionText}
          </div>
          
          <div className="pt-6 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Your Answer</label>
            <textarea
              rows={4}
              value={answers[q.id] || ''}
              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
              readOnly={showFeedback}
              placeholder="Type your derivation or final answer here..."
              className="w-full px-4 py-3 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-sm"
            />
          </div>
          
          {showFeedback ? (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Correct Solution Reference
              </h3>
              <div className="text-sm text-slate-700 font-mono whitespace-pre-wrap bg-white p-4 rounded border border-slate-100">
                {q.solutionText}
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleNext}
                  className="bg-indigo-600 text-white px-6 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-indigo-500"
                >
                  {currentIdx < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowFeedback(true)}
                disabled={!(answers[q.id] && answers[q.id].trim().length > 0)}
                className="bg-slate-800 text-white px-6 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-slate-700 disabled:opacity-50"
              >
                Submit Answer
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // mode === 'results'
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
      <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-8 h-8 text-indigo-600" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Quiz Completed</h2>
        <p className="text-slate-500 mt-2">You answered {calculateScore()} out of {questions.length} questions.</p>
        <p className="text-xs text-slate-400 mt-1">Note: Detailed grading requires manual review of your written steps against the solutions.</p>
      </div>
      
      <div className="pt-6 border-t border-slate-100 flex justify-center">
        <button 
          onClick={() => setMode('setup')}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded font-bold uppercase tracking-wider text-xs hover:bg-indigo-500 transition-colors"
        >
          Create New Quiz
        </button>
      </div>
    </div>
  );
}
