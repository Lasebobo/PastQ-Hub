import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Question } from '../types';
import { useAuth } from '../lib/AuthContext';
import { ArrowLeft, Bookmark, CheckCircle2, AlertCircle, Library, Download } from 'lucide-react';
import jsPDF from 'jspdf';

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    const fetchQuestion = async () => {
      try {
        const docRef = doc(db, 'questions', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setQuestion({ id: docSnap.id, ...docSnap.data() } as Question);
        }
      } catch (error) {
        console.error("Error fetching question:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestion();
  }, [id]);

  useEffect(() => {
    if (profile && id) {
      setBookmarked(profile.bookmarkedQuestions?.includes(id) || false);
    }
  }, [profile, id]);

  const toggleBookmark = async () => {
    if (!profile || !id) return;
    
    const userRef = doc(db, 'users', profile.id);
    const newBookmarkedState = !bookmarked;
    
    setBookmarked(newBookmarkedState);
    
    try {
      if (newBookmarkedState) {
        await updateDoc(userRef, { bookmarkedQuestions: arrayUnion(id) });
      } else {
        await updateDoc(userRef, { bookmarkedQuestions: arrayRemove(id) });
      }
    } catch (error) {
      console.error("Error updating bookmark:", error);
      setBookmarked(!newBookmarkedState);
    }
  };

  const handleDownloadPDF = () => {
    if (!question) return;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(`Course: ${question.courseCode}`, 10, 20);
    doc.text(`Topic: ${question.topic}`, 10, 30);
    doc.text(`Year: ${question.year}`, 10, 40);
    
    doc.setFontSize(12);
    doc.text('Question:', 10, 60);
    
    const splitQuestion = doc.splitTextToSize(question.questionText, 180);
    doc.text(splitQuestion, 10, 70);
    
    const questionHeight = splitQuestion.length * 7;
    let currentY = 70 + questionHeight + 10;
    
    doc.text('Solution:', 10, currentY);
    const splitSolution = doc.splitTextToSize(question.solutionText, 180);
    doc.text(splitSolution, 10, currentY + 10);
    
    doc.save(`${question.courseCode}_${question.year}_QnA.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Question Not Found</h2>
        <p className="text-slate-500 mt-2 text-sm">The question you are looking for does not exist or has been removed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-4 flex justify-between items-center">
          <h2 className="font-bold text-slate-800">{question.courseCode}: {question.topic}</h2>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wider ${
              question.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
              question.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {question.difficulty}
            </span>
            <button 
              onClick={handleDownloadPDF}
              className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={toggleBookmark}
              className={`p-1.5 rounded-md transition-colors ${bookmarked ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              title={bookmarked ? "Remove Bookmark" : "Bookmark Question"}
            >
              <Bookmark className="w-4 h-4" fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
            <span className="text-xs text-slate-400 font-mono">ID: {question.id.toUpperCase()}</span> 
            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">Session: {question.year}</span>
          </div>

          <p className="text-slate-700 leading-relaxed font-medium text-lg mb-8">
            {question.questionText}
          </p>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-bold text-indigo-600 uppercase tracking-tighter">Verified Solution</span> 
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-lg text-sm text-slate-700 font-mono space-y-2 whitespace-pre-wrap leading-relaxed border border-slate-100">
              {question.solutionText}
            </div>
          </div>

          {question.explanation && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Library className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-bold text-slate-600 uppercase tracking-tighter">Detailed Explanation</span>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-slate-200">
                {question.explanation}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
