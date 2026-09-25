import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Question } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Link } from 'react-router-dom';
import { Bookmark, Tag, ChevronRight } from 'lucide-react';

export default function Bookmarks() {
  const { profile } = useAuth();
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    
    const fetchBookmarks = async () => {
      setLoading(true);
      try {
        if (!profile.bookmarkedQuestions || profile.bookmarkedQuestions.length === 0) {
          setBookmarkedQuestions([]);
          setLoading(false);
          return;
        }

        const questions: Question[] = [];
        for (const qId of profile.bookmarkedQuestions) {
          const qDoc = await getDoc(doc(db, 'questions', qId));
          if (qDoc.exists()) {
            questions.push({ id: qDoc.id, ...qDoc.data() } as Question);
          }
        }
        
        setBookmarkedQuestions(questions);
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookmarks();
  }, [profile]);

  return (
    <div className="space-y-6">
      <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg">
        <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-300 flex items-center mb-2">
          <Bookmark className="w-4 h-4 mr-2" />
          Saved Questions
        </h3>
        <p className="text-indigo-200 text-sm">Review your bookmarked past questions for easier revision.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : bookmarkedQuestions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">No bookmarks yet</h3>
          <p className="text-slate-500 text-sm mt-2">You haven't saved any questions for later review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bookmarkedQuestions.map(question => (
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
                      Review <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
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
