/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import QuestionDetail from './pages/QuestionDetail';
import Trends from './pages/Trends';
import Bookmarks from './pages/Bookmarks';
import { LogOut, BookOpen, User, LayoutDashboard, Database, TrendingUp, Bookmark, MessageSquare, ClipboardList } from 'lucide-react';
import Quiz from './pages/Quiz';
import Forums from './pages/Forums';
import ForumThread from './pages/ForumThread';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || (path === '/' && location.pathname.startsWith('/question/'));

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans text-slate-900 bg-slate-50">
      <aside className="w-64 bg-slate-900 flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">S</div>
          <span className="text-white font-bold text-lg tracking-tight">SciQuest AI</span>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          <Link to="/" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive('/') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          {profile?.role === 'admin' && (
            <Link to="/admin" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive('/admin') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Database className="w-5 h-5" />
              <span>Repository</span>
            </Link>
          )}
          <Link to="/trends" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive('/trends') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <TrendingUp className="w-5 h-5" />
            <span>Trend Analysis</span>
          </Link>
          <Link to="/quiz" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive('/quiz') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <ClipboardList className="w-5 h-5" />
            <span>Quiz Generator</span>
          </Link>
          <Link to="/forums" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive('/forums') || location.pathname.startsWith('/forums') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <MessageSquare className="w-5 h-5" />
            <span>Forums</span>
          </Link>
          <Link to="/bookmarks" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive('/bookmarks') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Bookmark className="w-5 h-5" />
            <span>Saved Items</span>
          </Link>
        </nav>
        
        <div className="p-4 mt-auto border-t border-slate-800">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full text-slate-400 hover:text-red-400 transition-colors rounded-md text-sm"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign out</span>
          </button>
          <div className="mt-4 text-slate-500 text-xs text-center">25 Years of Verified Solutions</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center md:hidden gap-3">
             <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">S</div>
             <span className="font-bold text-lg tracking-tight">SciQuest AI</span>
          </div>
          <div className="hidden md:flex flex-1"></div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 hidden sm:block">{profile?.name || 'Student'}</span>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
                {profile?.name?.substring(0, 2).toUpperCase() || 'JD'}
              </div>
            </div>
            <button onClick={logout} className="md:hidden text-slate-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Layout><Admin /></Layout></ProtectedRoute>} />
          <Route path="/question/:id" element={<ProtectedRoute><Layout><QuestionDetail /></Layout></ProtectedRoute>} />
          <Route path="/trends" element={<ProtectedRoute><Layout><Trends /></Layout></ProtectedRoute>} />
          <Route path="/bookmarks" element={<ProtectedRoute><Layout><Bookmarks /></Layout></ProtectedRoute>} />
          <Route path="/quiz" element={<ProtectedRoute><Layout><Quiz /></Layout></ProtectedRoute>} />
          <Route path="/forums" element={<ProtectedRoute><Layout><Forums /></Layout></ProtectedRoute>} />
          <Route path="/forums/:courseCode" element={<ProtectedRoute><Layout><ForumThread /></Layout></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

