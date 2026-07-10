import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Course, Question } from '../types';
import { Search, Filter, BookOpen, Clock, Tag, ChevronRight, BarChart3, Bookmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function Dashboard() {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [department, setDepartment] = useState('All');
  const [courseCode, setCourseCode] = useState('');
  const [level, setLevel] = useState('All');
  const [year, setYear] = useState('All');

  useEffect(() => {
    fetchQuestions();
  }, [department, level, year]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'questions'), where('status', '==', 'approved'));
      
      const querySnapshot = await getDocs(q);
      let fetchedQuestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      
      if (courseCode) {
        fetchedQuestions = fetchedQuestions.filter(q => q.courseCode.toLowerCase().includes(courseCode.toLowerCase()));
      }
      if (year !== 'All') {
        fetchedQuestions = fetchedQuestions.filter(q => q.year.toString() === year);
      }
      
      fetchedQuestions.sort((a, b) => b.year - a.year);
      setQuestions(fetchedQuestions);
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchQuestions();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [courseCode]);

  return (
    <div className="space-y-6">
      <div className="bg-indigo-900 rounded-xl p-5 text-white shadow-lg">
        <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-3">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-indigo-400 font-bold mb-1">Search Course</label>
            <div className="flex items-center gap-2 bg-indigo-800 rounded px-2 py-1.5 w-full">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <input 
                type="text" 
                placeholder="e.g. MTH 201" 
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="bg-transparent border-none text-xs outline-none w-full text-white placeholder-indigo-400"
              />
            </div>
          </div>
          
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-indigo-400 font-bold mb-1">Department</label>
            <select 
              value={department} 
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-indigo-800 border-none rounded text-xs px-2 py-1.5 outline-none text-white w-full"
            >
              <option value="All">All Departments</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-indigo-400 font-bold mb-1">Level</label>
            <select 
              value={level} 
              onChange={(e) => setLevel(e.target.value)}
              className="bg-indigo-800 border-none rounded text-xs px-2 py-1.5 outline-none text-white w-full"
            >
              <option value="All">All Levels</option>
              <option value="100">100 Level</option>
              <option value="200">200 Level</option>
              <option value="300">300 Level</option>
              <option value="400">400 Level</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-indigo-400 font-bold mb-1">Session Year</label>
            <select 
              value={year} 
              onChange={(e) => setYear(e.target.value)}
              className="bg-indigo-800 border-none rounded text-xs px-2 py-1.5 outline-none text-white w-full"
            >
              <option value="All">All Years</option>
              {Array.from({ length: 25 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No questions found</h3>
          <p className="text-slate-500">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {questions.map(question => (
            <Link key={question.id} to={`/question/${question.id}`} className="block group">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col hover:border-indigo-300 transition-colors">
                <div className="border-b border-slate-100 p-4 flex justify-between items-center bg-white">
                  <h2 className="font-bold text-slate-800">{question.courseCode}</h2>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider ${
                    question.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                    question.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {question.difficulty}
                  </span>
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      ID: {question.id.slice(0,8).toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded shrink-0">
                      Session: {question.year}
                    </span>
                  </div>
                  
                  <p className="text-slate-700 font-medium text-sm leading-relaxed line-clamp-3 mb-4">
                    {question.questionText}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                      <Tag className="w-3.5 h-3.5" />
                      {question.topic}
                    </div>
                    <span className="text-indigo-600 flex items-center text-xs font-bold uppercase tracking-wide group-hover:text-indigo-500 transition-colors">
                      Solution <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
