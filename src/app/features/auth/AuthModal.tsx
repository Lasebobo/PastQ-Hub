import { useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import type { AuthMode, Role } from "../../types";
import { cn } from "../../utils/cn";

const googleProvider = new GoogleAuthProvider();

export function AuthModal() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [adminCode, setAdminCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (mode === "login") {
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
          // Demo convenience: a failed login silently creates the account and infers a
          // role from the email address. That is a privilege-escalation hole, so it is
          // gated to development only and is stripped from production builds.
          if (import.meta.env.DEV && email && password.length >= 6 &&
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
        // Dev-only: unreachable in production, where "admin" cannot be selected.
        if (import.meta.env.DEV && role === "admin" && adminCode !== "OAU_ADMIN_2024") {
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
    setError("");
    setLoading(true);
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
      if (err.code === "auth/popup-blocked") {
        // Fallback for mobile devices / aggressive popup blockers
        signInWithRedirect(auth, googleProvider).catch(redirectErr => {
          setError(redirectErr.message || "Google sign-in redirect failed.");
          setLoading(false);
        });
        return; // Loading stays true while redirecting
      }
      setError(err.message || "Google sign-in failed.");
      setLoading(false);
    }
  };



  // firestore.rules only permits self-registration as a student — an admin promotes
  // people from there. Offering the elevated roles in production would just produce a
  // permission error, and shipping the admin code is what made escalation possible.
  const ROLES: { value: Role; label: string; desc: string }[] = [
    { value: "student", label: "Student", desc: "Browse PQs, take quizzes, join forums" },
    ...(import.meta.env.DEV ? [
      { value: "lecturer" as Role, label: "Lecturer", desc: "All student features + suggest uploads" },
      { value: "admin" as Role, label: "Administrator", desc: "Full access — upload PQs, approve content" },
    ] : []),
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
                    {/* Dev only — this must never ship in a production bundle. */}
                    {import.meta.env.DEV && (
                      <p className="text-[10px] text-gray-400 mt-1">Demo code: OAU_ADMIN_2024</p>
                    )}
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

          {/* Dev only — these credentials must never ship in a production bundle. */}
          {mode === "login" && import.meta.env.DEV && (
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
