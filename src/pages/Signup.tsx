import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { GraduationCap, Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [courseCode, setCourseCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let enrolledCourses: string[] = [];
      let courseToUpdate: string | null = null;
      let teacherId: string | null = null;

      if (role === 'student' && courseCode) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'courses'), where('courseCode', '==', courseCode.toUpperCase()));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error(t('invalid_course_code') || 'Invalid course code. Please check with your teacher.');
        } else {
          const courseDoc = querySnapshot.docs[0];
          const courseData = courseDoc.data();
          enrolledCourses.push(courseDoc.id);
          courseToUpdate = courseDoc.id;
          // Set teacherId from the course
          if (courseData.teacherId) {
            teacherId = courseData.teacherId;
          }
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      if (courseToUpdate) {
        const { doc, updateDoc, increment } = await import('firebase/firestore');
        // Increment student count in course
        await updateDoc(doc(db, 'courses', courseToUpdate), {
          students: increment(1)
        });
      }

      const path = `users/${user.uid}`;
      const isAdminEmail = ['postgraduatesystem79@gmail.com', 'gradateminia@gmail.com', 'drosamaayed@gmail.com', 'admin@adptive.edu.eg', 'admin@system.com'].includes(user.email || '');
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          displayName: name,
          email: user.email,
          role: isAdminEmail ? 'admin' : role,
          teacherId: teacherId, // Save teacherId
          status: isAdminEmail || role === 'teacher' ? 'active' : 'pending',
          enrolledCourses: enrolledCourses,
          progress: 0,
          createdAt: serverTimestamp(),
          stats: {
            hoursSpent: 0,
            coursesCompleted: 0,
            totalPoints: 0,
            contentVisits: {
              word: 0,
              ppt: 0,
              pdf: 0,
              video: 0,
              audio: 0
            },
            evaluationPerformance: {},
            completedLessons: [],
            sessionTiming: {}
          }
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }

      navigate('/chatbot');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 font-sans rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card p-8 rounded-2xl shadow-xl border border-border"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4 shadow-inner">
            <GraduationCap size={40} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('signup')}</h1>
          <p className="text-muted-foreground text-sm mt-2 font-medium">{t('create_your_account') || 'Join our learning community'}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-xl flex items-center gap-3 text-sm border border-destructive/20">
            <AlertCircle size={18} strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground">{t('full_name') || 'Full Name'}</label>
            <div className="relative">
              <User className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} strokeWidth={1.5} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl py-2.5 ps-10 pe-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground">{t('email') || 'Email'}</label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} strokeWidth={1.5} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl py-2.5 ps-10 pe-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400">{t('password') || 'Password'}</label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} strokeWidth={1.5} />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl py-2.5 ps-10 pe-10 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground">{t('i_am_a') || 'I am a'}</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={cn(
                  "py-2.5 rounded-xl border font-bold transition-all",
                  role === 'student' ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-muted/50 hover:bg-muted border-border"
                )}
              >
                {t('student')}
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={cn(
                  "py-2.5 rounded-xl border font-bold transition-all",
                  role === 'teacher' ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-muted/50 hover:bg-muted border-border"
                )}
              >
                {t('teacher')}
              </button>
            </div>
          </div>

          {role === 'student' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <label className="text-sm font-bold text-muted-foreground">{t('course_code') || 'Course Code'}</label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} strokeWidth={1.5} />
                <input
                  type="text"
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  className="w-full bg-muted/50 border border-border rounded-xl py-2.5 ps-10 pe-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="EX: MATH101"
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">{t('course_code_help') || 'Ask your teacher for the course code'}</p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shadow-lg shadow-primary/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
            ) : (
              t('signup')
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t('already_have_account') || "Already have an account?"}{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            {t('login')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
