import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Question } from '../types';
import { ArrowLeft, TrendingUp, AlertCircle } from 'lucide-react';

export default function Trends() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('All');

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const q = query(collection(db, 'questions'), where('status', '==', 'approved'));
        const querySnapshot = await getDocs(q);
        const fetchedQuestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, []);

  const uniqueCourses = Array.from(new Set(questions.map(q => q.courseCode))).sort();
  
  const filteredQuestions = selectedCourse === 'All' 
    ? questions 
    : questions.filter(q => q.courseCode === selectedCourse);

  const topicFrequency: Record<string, number> = {};
  filteredQuestions.forEach(q => {
    topicFrequency[q.topic] = (topicFrequency[q.topic] || 0) + 1;
  });

  const sortedTopics = Object.entries(topicFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));

  const maxCount = sortedTopics.length > 0 ? sortedTopics[0].count : 0;

  // Use the design's colors for the top 3
  const colors = [
    { bg: 'bg-indigo-500', track: 'bg-indigo-100', text: 'text-indigo-600', badge: 'bg-indigo-100' },
    { bg: 'bg-emerald-500', track: 'bg-emerald-100', text: 'text-emerald-600', badge: 'bg-emerald-100' },
    { bg: 'bg-slate-500', track: 'bg-slate-200', text: 'text-slate-600', badge: 'bg-slate-100' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center uppercase tracking-widest">
            <TrendingUp className="w-4 h-4 mr-2 text-indigo-500" />
            25-Year Trend Analysis
          </h3>
          
          <select 
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium text-slate-700"
          >
            <option value="All">All Courses</option>
            {uniqueCourses.map(course => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : sortedTopics.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No data available</h3>
            <p className="text-xs text-slate-500 mt-1">There are no approved questions for this selection.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedTopics.map((item, index) => {
              const colorSet = index < 3 ? colors[index] : colors[2];
              const percentage = Math.round((item.count / filteredQuestions.length) * 100);
              
              return (
                <div key={item.topic} className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full tracking-wider ${colorSet.text} ${colorSet.badge}`}>
                      {item.topic}
                    </span>
                    <span className={`text-xs font-semibold inline-block ${colorSet.text}`}>
                      {percentage}% ({item.count})
                    </span>
                  </div>
                  <div className={`overflow-hidden h-1.5 mb-1 text-xs flex rounded ${colorSet.track}`}>
                    <div 
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${colorSet.bg} transition-all duration-1000 ease-out`}
                      style={{ width: `${(item.count / maxCount) * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            
            <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 leading-tight italic">
              Analysis based on {filteredQuestions.length} questions across the selected criteria.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
