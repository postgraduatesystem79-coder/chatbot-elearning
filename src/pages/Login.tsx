import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { GraduationCap, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/chatbot');
    } catch (err: any) {
      setError(err.message);
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
        const isAdminEmail = ['postgraduatesystem79@gmail.com', 'gradateminia@gmail.com', 'drosamaayed@gmail.com', 'admin@adptive.edu.eg', 'admin@system.com'].includes(user.email || '');
        const path = `users/${user.uid}`;
        try {
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
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
      navigate('/chatbot');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative flex items-center justify-center p-4 font-sans rtl">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #4D2C91 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      
      {/* Glowing Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-6xl bg-card/80 backdrop-blur-xl border border-border rounded-[2rem] shadow-2xl overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row min-h-[700px]">
          {/* Left Column: Info Section */}
          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-l border-border bg-muted/30">
            <div>
              <div className="flex items-center gap-4 mb-10">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <GraduationCap size={32} className="text-white" strokeWidth={1.5} />
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  بيئة التعلم الإلكترونية وروبوتات الدردشة
                </h1>
              </div>

              <div className="space-y-8 text-right">
                <p className="text-primary font-bold text-lg">
                  أهلاً ومرحباً بكم في الموقع الإلكتروني الخاص ببيئة التعلم الإلكترونية وروبوتات الدردشة
                </p>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-xl lg:text-2xl font-extrabold leading-relaxed text-foreground">
                      عنوان الرسالة: "فاعلية روبوتات الدردشة ببيئة التعلم الإلكترونية لتنمية مهارات ريادة الأعمال الرقمية والاتجاه نحو العمل الحر لطلاب الجامعة"
                    </h2>
                    <p className="text-blue-300/90 font-medium text-lg leading-relaxed ltr text-left">
                      Thesis Title: "Effectiveness of Chatbots in E-Learning Environment for Developing Digital Entrepreneurship Skills and Attitude Towards Freelancing for University Students"
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border">
                    <p className="flex items-center gap-3 text-muted-foreground font-medium">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      تحت إشراف الأستاذة الدكتورة / إيمان زكي موسى الشريف (أستاذ تكنولوجيا التعليم)
                    </p>
                    <p className="flex items-center gap-3 text-muted-foreground font-medium">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      تحت إشراف الأستاذ الدكتور / محمود فرحان حسين (أستاذ الاقتصاد المنزلي - جامعة المنيا)
                    </p>
                    <p className="flex items-center gap-3 text-muted-foreground font-medium">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      تحت إشراف الأستاذة الدكتورة / أسماء ممدوح فتحي عبد اللطيف (أستاذ إدارة المنزل والمؤسسات - جامعة المنيا)
                    </p>
                    <p className="flex items-center gap-3 text-foreground font-bold text-lg mt-4">
                      <span className="w-2 h-2 bg-secondary rounded-full"></span>
                      اسم الباحثة: هبه الله فضل خلف عبد اللطيف (معيدة بقسم الاقتصاد المنزلي)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 text-muted-foreground font-bold">
              التاريخ: 1447هـ - 2026م
            </div>
          </div>

          {/* Right Column: Login Form */}
          <div className="w-full lg:w-[450px] p-8 lg:p-12 flex flex-col justify-center bg-background">
            <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                  <GraduationCap size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold text-foreground">تسجيل الدخول</h3>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-xl flex items-center gap-3 text-sm border border-destructive/20">
                  <AlertCircle size={18} strokeWidth={1.5} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground pr-1">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} strokeWidth={1.5} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl py-3.5 pr-12 pl-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground placeholder:text-muted-foreground/50"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300 pr-1 ltr block text-left">password</label>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} strokeWidth={1.5} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl py-3.5 pr-12 pl-12 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground placeholder:text-muted-foreground/50"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    "تسجيل الدخول"
                  )}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-4 text-muted-foreground font-bold">أو</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-transparent border border-border text-foreground font-bold py-3.5 rounded-xl hover:bg-muted transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                تسجيل الدخول باستخدام جوجل
              </button>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                ليس لديك حساب؟{' '}
                <Link to="/signup" className="text-primary font-bold hover:underline">
                  إنشاء حساب
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
