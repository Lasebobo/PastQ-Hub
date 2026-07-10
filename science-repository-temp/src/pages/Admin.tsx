import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';

export default function Admin() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [courseCode, setCourseCode] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [questionText, setQuestionText] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  if (profile?.role !== 'admin') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-rose-600">Access Denied</h2>
        <p className="mt-2 text-slate-600 text-sm">You must be an administrator to view this page.</p>
        <Link to="/" className="text-indigo-600 hover:text-indigo-500 font-medium mt-4 inline-block text-sm">Return to Dashboard</Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'questions'), {
        courseCode: courseCode.toUpperCase(),
        year: Number(year),
        topic,
        difficulty,
        questionText,
        solutionText,
        explanation,
        status: 'approved',
        tags: [],
        createdAt: Date.now(),
        createdBy: profile.id
      });
      setSuccess(true);
      setQuestionText('');
      setSolutionText('');
      setExplanation('');
      setTopic('');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error adding question:", error);
      alert("Failed to upload question.");
    } finally {
      setLoading(false);
    }
  };

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(',')[1];
        if (!base64Data) return;

        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type
          })
        });

        const data = await response.json();
        if (response.ok && data.text) {
          setQuestionText(prev => prev + (prev ? '\n\n' : '') + data.text);
        } else {
          alert('Failed to extract text: ' + (data.error || 'Unknown error'));
        }
        setOcrLoading(false);
      };
      reader.onerror = () => {
        alert('Failed to read file');
        setOcrLoading(false);
      };
    } catch (err) {
      console.error(err);
      alert('Error extracting text');
      setOcrLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Repository Upload</h1>
            <p className="text-slate-500 mt-1 text-sm">Add a new verified question and solution.</p>
          </div>
          <Upload className="w-6 h-6 text-indigo-300" />
        </div>

        <div className="p-6">
          {success && (
            <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-center border border-emerald-100 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Question successfully verified and published.
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Course Code</label>
                <input 
                  type="text" required
                  placeholder="e.g. MTH201"
                  value={courseCode}
                  onChange={e => setCourseCode(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Academic Session</label>
                <input 
                  type="number" required
                  min={1999} max={new Date().getFullYear()}
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Primary Topic</label>
                <input 
                  type="text" required
                  placeholder="e.g. Vector Calculus"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Difficulty Index</label>
                <select 
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-sm"
                >
                  <option value="easy">Easy (1)</option>
                  <option value="medium">Medium (2)</option>
                  <option value="hard">Hard (3)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Question Text</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Scan Paper:</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleOcrUpload}
                    className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    disabled={ocrLoading}
                  />
                  {ocrLoading && <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
              </div>
              <textarea 
                required rows={3}
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                placeholder="Enter the full question text here..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Verified Solution</label>
              <textarea 
                required rows={4}
                value={solutionText}
                onChange={e => setSolutionText(e.target.value)}
                placeholder="Provide the exact mathematical derivation or final answer..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-mono bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Concept Explanation <span className="text-slate-400 font-normal normal-case tracking-normal">(Optional)</span></label>
              <textarea 
                rows={3}
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                placeholder="Break down the steps or core concepts needed to arrive at the solution..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button 
                type="submit"
                disabled={loading}
                className="bg-indigo-500 text-white px-5 py-2.5 rounded text-xs font-bold tracking-wider uppercase hover:bg-indigo-400 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? 'Processing...' : 'Publish to Repository'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
