import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Link } from 'react-router-dom';
import { MessageSquare, Search, Plus } from 'lucide-react';

export default function Forums() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      // In a real app we might have a 'courses' collection, 
      // here we just fetch distinct courses from questions or threads
      try {
        const threadsRef = collection(db, 'threads');
        const snapshot = await getDocs(threadsRef);
        const uniqueCourses = new Set<string>();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.courseCode) uniqueCourses.add(data.courseCode);
        });
        
        // Also get from questions
        const qRef = collection(db, 'questions');
        const qSnap = await getDocs(qRef);
        qSnap.forEach(doc => {
          if (doc.data().courseCode) uniqueCourses.add(doc.data().courseCode);
        });
        
        setCourses(Array.from(uniqueCourses).sort());
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const filtered = courses.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Course Forums</h1>
          <p className="text-slate-500 mt-1">Discuss past questions, share insights, and study together.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search for a course code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 outline-none text-sm text-slate-700 bg-transparent"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading forums...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Add a generic new thread course option */}
          <Link to={`/forums/NEW_COURSE`} className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 hover:bg-indigo-100 transition-colors flex flex-col items-center justify-center text-center group min-h-[140px]">
            <div className="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-indigo-700" />
            </div>
            <h3 className="font-bold text-indigo-900 text-sm">Start New Course Discussion</h3>
            <p className="text-xs text-indigo-600 mt-1">Can't find your course?</p>
          </Link>
          
          {filtered.map(code => (
            <Link key={code} to={`/forums/${code}`} className="bg-white border border-slate-200 rounded-xl p-6 hover:border-indigo-300 hover:shadow-sm transition-all group min-h-[140px] flex flex-col">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                  <MessageSquare className="w-5 h-5 text-slate-500 group-hover:text-indigo-500" />
                </div>
              </div>
              <h3 className="font-bold text-slate-800 text-lg mt-4 group-hover:text-indigo-600">{code}</h3>
              <p className="text-xs text-slate-500 mt-1 flex-1">Join the discussion for {code}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
