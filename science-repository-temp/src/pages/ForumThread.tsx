import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { MessageSquare, ThumbsUp, Share2, Image as ImageIcon, ArrowLeft, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ForumThread() {
  const { courseCode } = useParams<{ courseCode: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  
  // Actually allowing "NEW_COURSE" overriding
  const [actualCourseCode, setActualCourseCode] = useState(courseCode === 'NEW_COURSE' ? '' : courseCode);

  const fetchThreads = async () => {
    if (!actualCourseCode || actualCourseCode === 'NEW_COURSE') {
      setLoading(false);
      return;
    }
    try {
      const q = query(
        collection(db, 'threads'), 
        where('courseCode', '==', actualCourseCode.toUpperCase()),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [actualCourseCode]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await addDoc(collection(db, 'threads'), {
        courseCode: actualCourseCode?.toUpperCase() || '',
        title: newTitle,
        content: newContent,
        imageUrl: newImage,
        authorId: profile.id,
        authorName: profile.name,
        createdAt: Date.now(),
        likes: [],
        comments: []
      });
      setIsCreating(false);
      setNewTitle('');
      setNewContent('');
      setNewImage(null);
      if (courseCode === 'NEW_COURSE' && actualCourseCode) {
        navigate(`/forums/${actualCourseCode.toUpperCase()}`);
      } else {
        fetchThreads();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to post thread');
    }
  };

  const handleLike = async (threadId: string, likes: string[]) => {
    if (!profile) return;
    const hasLiked = likes.includes(profile.id);
    const threadRef = doc(db, 'threads', threadId);
    
    try {
      await updateDoc(threadRef, {
        likes: hasLiked ? arrayRemove(profile.id) : arrayUnion(profile.id)
      });
      fetchThreads(); // Refresh to show new likes
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (threadId: string) => {
    if (!window.confirm("Are you sure you want to delete this thread?")) return;
    try {
      // In a real app we would use deleteDoc.
      // But we just want a simple moderation demo.
      const threadRef = doc(db, 'threads', threadId);
      // To bypass potential missing delete rule, we might just mark it deleted if we can't delete
      // Assuming admin can delete or author can delete
      // For now, we update it as deleted (soft delete) or assume rule allows delete.
      await updateDoc(threadRef, {
        status: 'deleted' // soft delete
      });
      fetchThreads();
    } catch (err) {
      console.error(err);
      alert("Failed to delete thread. You may not have permission.");
    }
  };

  const handleShare = (threadId: string) => {
    // In a real app we could copy the link to clipboard
    navigator.clipboard.writeText(window.location.href + '?thread=' + threadId);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/forums')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Forums
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {courseCode === 'NEW_COURSE' ? 'Start a New Discussion' : `${actualCourseCode} Discussions`}
            </h1>
          </div>
          {courseCode !== 'NEW_COURSE' && !isCreating && (
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold uppercase tracking-wider hover:bg-indigo-500"
            >
              Post Question
            </button>
          )}
        </div>

        {(isCreating || courseCode === 'NEW_COURSE') && (
          <form onSubmit={handleCreateThread} className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4 mb-8">
            {courseCode === 'NEW_COURSE' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Course Code</label>
                <input 
                  type="text" required
                  placeholder="e.g. MTH201"
                  value={actualCourseCode}
                  onChange={e => setActualCourseCode(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-sm uppercase"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Topic / Question Title</label>
              <input 
                type="text" required
                placeholder="What is the concept of..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Details</label>
              <textarea 
                required rows={4}
                placeholder="Explain what you need help with..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Attach Image (Optional)</label>
              <input 
                type="file" accept="image/*,application/pdf"
                onChange={handleImageUpload}
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {newImage && <img src={newImage} alt="Preview" className="mt-4 max-h-48 rounded border border-slate-200" />}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              {courseCode !== 'NEW_COURSE' && (
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-bold uppercase"
                >
                  Cancel
                </button>
              )}
              <button 
                type="submit"
                className="bg-indigo-600 text-white px-6 py-2 rounded text-sm font-bold uppercase tracking-wider hover:bg-indigo-500"
              >
                Post
              </button>
            </div>
          </form>
        )}

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading threads...</div>
          ) : threads.length === 0 && courseCode !== 'NEW_COURSE' ? (
            <div className="text-center py-12 text-slate-500">
              No discussions yet for {actualCourseCode}. Be the first to post!
            </div>
          ) : (
            threads.filter(t => t.status !== 'deleted').map(thread => (
              <div key={thread.id} className="border border-slate-100 rounded-lg p-5 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-900">{thread.title}</h3>
                  {(profile?.role === 'admin' || profile?.id === thread.authorId) && (
                    <button onClick={() => handleDelete(thread.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-4 font-medium flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] text-slate-600 font-bold uppercase">
                    {thread.authorName?.substring(0, 2) || 'AN'}
                  </div>
                  {thread.authorName} • {formatDistanceToNow(thread.createdAt)} ago
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{thread.content}</p>
                
                {thread.imageUrl && (
                  <div className="mb-4">
                    <img src={thread.imageUrl} alt="Attached" className="max-h-64 rounded-lg border border-slate-200" />
                  </div>
                )}
                
                <div className="flex items-center gap-4 text-slate-500 border-t border-slate-100 pt-3">
                  <button 
                    onClick={() => handleLike(thread.id, thread.likes || [])}
                    className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${thread.likes?.includes(profile?.id) ? 'text-indigo-600' : 'hover:text-indigo-600'}`}
                  >
                    <ThumbsUp className="w-4 h-4" /> {thread.likes?.length || 0} Likes
                  </button>
                  <button className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider hover:text-indigo-600 transition-colors">
                    <MessageSquare className="w-4 h-4" /> {thread.comments?.length || 0} Comments
                  </button>
                  <button onClick={() => handleShare(thread.id)} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider hover:text-indigo-600 transition-colors ml-auto">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
