import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { GraduationCap, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, CheckCircle2, Users, Star, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Set default quick login info based on role
  const selectRoleTab = (role: 'student' | 'teacher' | 'admin') => {
    setSelectedRole(role);
    setError('');
    if (role === 'admin') {
      setEmail('admin@system.com');
      setPassword('admin123456');
    } else if (role === 'teacher') {
      setEmail('teacher@system.com');
      setPassword('teacher123456');
    } else {
      setEmail('');
      setPassword('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/courses');
    } catch (err: any) {
      console.error('Login error:', err);
      const code = err.code || err.message || '';

      // Auto-provision demo admin/teacher accounts if they don't exist yet in Firebase
      if ((email.trim() === 'admin@system.com' || email.trim() === 'teacher@system.com') && 
          (code.includes('user-not-found') || code.includes('invalid-credential') || code.includes('wrong-password'))) {
        try {
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
          const user = userCredential.user;
          const assignedRole = email.trim() === 'admin@system.com' ? 'admin' : 'teacher';
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            displayName: assignedRole === 'admin' ? 'مدير النظام' : 'معلم المقرر',
            email: user.email,
            role: assignedRole,
            status: 'active',
            enrolledCourses: [],
            createdAt: serverTimestamp(),
            stats: {
              hoursSpent: 0,
              coursesCompleted: 0,
              totalPoints: 0
            }
          });
          navigate('/courses');
          return;
        } catch (createErr) {
          console.error('Error auto-creating account:', createErr);
        }
      }

      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError('بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور أو إنشاء حساب جديد.');
      } else if (code.includes('too-many-requests')) {
        setError('تم حظر المحاولات مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة بعد دقيقة.');
      } else {
        setError(err.message || 'فشل تسجيل الدخول، يرجى المحاولة مرة أخرى');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const isAdminEmail = [
          'postgraduatesystem79@gmail.com', 
          'gradateminia@gmail.com', 
          'drosamaayed@gmail.com', 
          'admin@adptive.edu.eg', 
          'admin@system.com'
        ].includes(user.email || '');
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          displayName: user.displayName || 'User',
          email: user.email,
          role: isAdminEmail ? 'admin' : 'student',
          status: isAdminEmail ? 'active' : 'pending',
          enrolledCourses: [],
          createdAt: serverTimestamp(),
          stats: {
            hoursSpent: 0,
            coursesCompleted: 0,
            totalPoints: 0
          }
        });
      }
      navigate('/courses');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fef9f3] text-[#064e40] font-sans rtl" dir="rtl">
      {/* Navbar Inspired by Template */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#fc721e] rounded-full flex items-center justify-center text-white rotate-12 shadow-lg">
            <GraduationCap size={24} />
          </div>
          <span className="text-xl font-black tracking-tighter text-[#064e40]">تطبيقات الذكاء الاصطناعي</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-bold opacity-80">
          <Link to="/" className="hover:text-[#fc721e] transition-colors">الرئيسية</Link>
          <Link to="/courses" className="hover:text-[#fc721e] transition-colors">المواد الدراسية</Link>
          <Link to="/instructions" className="hover:text-[#fc721e] transition-colors">عن المنصة</Link>
          <Link to="/" className="hover:text-[#fc721e] transition-colors">تواصل معنا</Link>
        </div>

        <Link 
          to="/signup" 
          className="bg-[#fc721e] text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-[#e65a10] transition-all shadow-md shadow-orange-200"
        >
          إنشاء حساب
        </Link>
      </nav>

      {/* Main Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-8 md:py-16 grid lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Side: Illustration & Text (RTL Logic: Hero on the right) */}
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="order-2 lg:order-1 space-y-8"
        >
          <div className="space-y-4">
            <h2 className="text-[#fc721e] font-bold text-lg tracking-widest uppercase">بيئة تعليمية ذكية</h2>
            <h1 className="text-4xl md:text-5xl font-black leading-[1.25] text-[#064e40]">
              تطبيقات الذكاء الاصطناعي <br/>
              <span className="text-[#fc721e]">لتنمية الوعي الصحي بمكملات الملابس</span>
            </h1>
            <p className="text-lg text-[#064e40]/70 font-medium leading-relaxed max-w-xl">
              منصة تعليمية متطورة تهدف لتنمية الوعي الصحي لاختيار مكملات الملابس لدى طالبات جامعة المنيا، مدعومة بتطبيقات الذكاء الاصطناعي وتحت إشراف أكاديمي متخصص.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <span className="font-bold text-sm">محتوى معتمد</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                <Star size={24} fill="currentColor" />
              </div>
              <span className="font-bold text-sm">ذكاء اصطناعي</span>
            </div>
          </div>

          {/* Academic Info Card */}
          <div className="bg-[#064e40] text-white p-6 rounded-3xl mt-8 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">تحت إشراف</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-[10px] space-y-1">
                <p className="font-black text-white">{t('supervisor1')}</p>
                <p className="opacity-60">أستاذ دكتور بالكلية</p>
              </div>
              <div className="text-[10px] space-y-1 border-r border-white/10 pr-4">
                <p className="font-black text-white">{t('supervisor2')}</p>
                <p className="opacity-60">أستاذ دكتور بالكلية</p>
              </div>
              <div className="text-[10px] space-y-1 border-r border-white/10 pr-4">
                <p className="font-black text-white">{t('supervisor3')}</p>
                <p className="opacity-60">أستاذ دكتور بالكلية</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Login Card (RTL Logic: Card on the left) */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          className="order-1 lg:order-2"
        >
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-orange-100 relative shadow-orange-200/20">
            {/* Header in Card */}
            <div className="mb-10 text-center">
              <div className="w-20 h-20 bg-[#064e40] text-white rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg transform -rotate-3">
                <Lock size={36} strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-black text-[#064e40] mb-2 tracking-tight">تسجيل الدخول</h2>
              <p className="text-[#064e40]/50 font-bold">مرحباً بكِ مجدداً في رحلة التعلم</p>
            </div>

            {/* Role Selection Tabs */}
            <div className="mb-6 p-1.5 bg-[#fef9f3] rounded-2xl grid grid-cols-3 gap-1.5 border border-orange-100">
              <button
                type="button"
                onClick={() => selectRoleTab('student')}
                className={cn(
                  "py-2.5 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1",
                  selectedRole === 'student' 
                    ? "bg-[#064e40] text-white shadow-md shadow-[#064e40]/20" 
                    : "text-[#064e40]/70 hover:bg-white"
                )}
              >
                <span>حساب طالب</span>
              </button>
              <button
                type="button"
                onClick={() => selectRoleTab('teacher')}
                className={cn(
                  "py-2.5 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1",
                  selectedRole === 'teacher' 
                    ? "bg-[#fc721e] text-white shadow-md shadow-[#fc721e]/20" 
                    : "text-[#064e40]/70 hover:bg-white"
                )}
              >
                <span>حساب معلم</span>
              </button>
              <button
                type="button"
                onClick={() => selectRoleTab('admin')}
                className={cn(
                  "py-2.5 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1",
                  selectedRole === 'admin' 
                    ? "bg-purple-700 text-white shadow-md shadow-purple-700/20" 
                    : "text-[#064e40]/70 hover:bg-white"
                )}
              >
                <span>مدير النظام</span>
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 text-sm border border-red-100">
                <AlertCircle size={20} />
                <span className="font-bold">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-[#064e40]/70 uppercase tracking-widest pr-1">البريد الإلكتروني</label>
                <div className="relative group">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-[#064e40]/30 group-focus-within:text-[#fc721e] transition-colors" size={20} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#fef9f3] border-none rounded-2xl py-4 pr-12 pl-4 focus:ring-2 ring-[#fc721e]/20 outline-none transition-all font-bold text-[#064e40] placeholder:text-[#064e40]/20"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between px-1">
                  <label className="text-xs font-black text-[#064e40]/70 uppercase tracking-widest">كلمة المرور</label>
                  <Link to="#" className="text-[10px] font-bold text-[#fc721e] hover:underline">نسيت الكلمة؟</Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-[#064e40]/30 group-focus-within:text-[#fc721e] transition-colors" size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#fef9f3] border-none rounded-2xl py-4 pr-12 pl-12 focus:ring-2 ring-[#fc721e]/20 outline-none transition-all font-bold text-[#064e40] placeholder:text-••••••••"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#064e40]/30 hover:text-[#fc721e] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#064e40] text-white font-black py-4.5 rounded-2xl hover:bg-[#053d32] transition-all disabled:opacity-50 shadow-xl shadow-[#064e40]/20 flex items-center justify-center gap-3 active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : (
                  <>
                    <span>تسجيل الدخول للمنصة</span>
                    <ArrowRight size={20} className="rotate-180" />
                  </>
                )}
              </button>
            </form>

            {/* Separator */}
            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-orange-100"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-4 text-[#064e40]/30 font-black uppercase tracking-widest">أو المتابعة عبر</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border-2 border-orange-100 text-[#064e40] font-black py-4 rounded-2xl hover:bg-[#fef9f3] transition-all disabled:opacity-50 flex items-center justify-center gap-4 active:scale-95 shadow-sm"
            >
              <svg className="w-6 h-6 border bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>حساب جوجل</span>
            </button>

            <div className="mt-8 text-center text-sm font-bold text-[#064e40]/50">
              {t('already_have_account')}{' '}
              <Link to="/signup" className="text-[#fc721e] hover:underline pr-1">تعديل البيانات</Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer Branding */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-orange-100/50 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 font-bold text-xs uppercase tracking-widest text-[#064e40]">
        <div>© 2026 المنصة التعليمية الذكية • م/ اسراء</div>
        <div className="flex items-center gap-6">
          <span>كلية التربية النوعية</span>
          <span>جامعة المنيا</span>
        </div>
      </footer>
    </div>
  );
}
