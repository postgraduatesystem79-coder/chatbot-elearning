import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { 
  FileText,
  Video,
  Volume2,
  Presentation,
  ArrowUp,
  CheckCircle,
  ArrowRight,
  Clock,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function LearningAnalytics() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [ranking, setRanking] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<string>("مرحباً بك! ابدأ درسك الأول لتظهر تحليلات أدائك هنا.");
  const [dbRecommendation, setDbRecommendation] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [evaluationData, setEvaluationData] = useState<any[]>([]);
  const [contentAccess, setContentAccess] = useState<any[]>([]);
  const [completedSessions, setCompletedSessions] = useState<string[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [gaugeValue, setGaugeValue] = useState(0.85);
  const [sessionTiming, setSessionTiming] = useState<Record<string, number>>({});

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const rankingRef = collection(db, 'users');
    const rankingQuery = query(
      rankingRef,
      where('role', '==', 'student'),
      orderBy('progress', 'desc')
    );

    const unsubscribeRanking = onSnapshot(rankingQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRanking(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const recommendationRef = doc(db, 'recommendations', 'global');
    const unsubscribeRecommendation = onSnapshot(recommendationRef, (doc) => {
      if (doc.exists()) {
        setDbRecommendation(doc.data().text);
      }
    });

    const sessionsRef = collection(db, 'sessions');
    const unsubscribeAllSessions = onSnapshot(sessionsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllSessions(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    let unsubscribePersonalized: () => void = () => {};
    if (user?.uid) {
      const personalizedRef = doc(db, 'recommendations', user.uid);
      unsubscribePersonalized = onSnapshot(personalizedRef, (doc) => {
        if (doc.exists()) {
          setDbRecommendation(doc.data().text);
        }
      });
    }

    let unsubscribeStats: () => void = () => {};
    let unsubscribeSubmissions: () => void = () => {};

    if (user?.uid) {
      const statsRef = doc(db, 'users', user.uid);
      unsubscribeStats = onSnapshot(statsRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const stats = data.stats || {};
          
          const evalPerf = stats.evaluationPerformance || {};
          const evalEntries = Object.entries(evalPerf);
          const avgEval = evalEntries.length > 0 
            ? evalEntries.reduce((acc, [_, val]) => acc + (val as number), 0) / (evalEntries.length * 100)
            : 0;
          setGaugeValue(avgEval);

          const lessons = ['1', '2', '3', '4', '5', '6', '7'];
          const evalData = lessons.map(l => {
            const statsKey = `session-${l}`;
            const value = evalPerf[statsKey] || evalPerf[l] || 0;
            return {
              name: l,
              value: value,
              color: value >= 50 ? '#22c55e' : (value > 0 ? '#ef4444' : '#cbd5e1')
            };
          });
          setEvaluationData(evalData);

          const visits = stats.contentVisits || {};
          const access = [
            { type: 'Word', count: (visits.word || 0).toString().padStart(2, '0'), icon: FileText, color: 'bg-orange-500', progress: Math.min((visits.word || 0) * 10, 100) },
            { type: 'PPT', count: (visits.ppt || 0).toString().padStart(2, '0'), icon: Presentation, color: 'bg-orange-400', progress: Math.min((visits.ppt || 0) * 10, 100) },
            { type: 'PDF', count: (visits.pdf || 0).toString().padStart(2, '0'), icon: FileText, color: 'bg-orange-500', progress: Math.min((visits.pdf || 0) * 10, 100) },
            { type: 'Video', count: (visits.video || 0).toString().padStart(2, '0'), icon: Video, color: 'bg-orange-600', progress: Math.min((visits.video || 0) * 10, 100) },
            { type: 'Audio', count: (visits.audio || 0).toString().padStart(2, '0'), icon: Volume2, color: 'bg-orange-500', progress: Math.min((visits.audio || 0) * 10, 100) },
          ];
          setContentAccess(access);

          const completed = stats.completedLessons || Object.keys(evalPerf);
          setCompletedSessions(completed);

          setSessionTiming(stats.sessionTiming || {});
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });

      const subsRef = collection(db, 'submissions');
      const subsQuery = query(subsRef, where('studentId', '==', user.uid), where('status', '==', 'graded'));
      unsubscribeSubmissions = onSnapshot(subsQuery, (snapshot) => {
        const subs = snapshot.docs.map(doc => doc.data());
        const sessionGrades: Record<string, { total: number, count: number }> = {};
        
        subs.forEach(sub => {
          const sid = sub.sessionId;
          if (!sessionGrades[sid]) sessionGrades[sid] = { total: 0, count: 0 };
          sessionGrades[sid].total += (sub.grade || 0);
          sessionGrades[sid].count += 1;
        });

        const lessons = ['1', '2', '3', '4', '5', '6', '7'];
        const realActData = lessons.map(l => {
          const sid = `session-${l}`;
          const data = sessionGrades[sid] || sessionGrades[l];
          return {
            name: l,
            value: data ? Math.round(data.total / data.count) : 0,
            isReal: !!data
          };
        });

        setActivityData(realActData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'submissions');
      });
    }

    return () => {
      unsubscribeRanking();
      unsubscribeRecommendation();
      unsubscribeAllSessions();
      unsubscribePersonalized();
      unsubscribeStats();
      unsubscribeSubmissions();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (dbRecommendation) {
      setRecommendation(dbRecommendation);
      return;
    }

    const progress = profile?.progress || 0;
    if (progress === 0) {
      setRecommendation("مرحباً بك في رحلتك التعليمية! ابدأ باستكشاف الدرس الأول لتحقيق أولى خطوات نجاحك.");
    } else if (progress < 40) {
      setRecommendation("بداية جيدة! استمر في التقدم وإكمال الأنشطة لرفع مستوى أدائك وتفعيل تحليلاتك.");
    } else if (progress < 80) {
      setRecommendation("أداء رائع! أنت تسير على الطريق الصحيح، واصل التميز في الدروس القادمة.");
    } else {
      setRecommendation("ممتاز! لقد قطعت شوطاً كبيراً في المقرر، استمر في هذا الحماس حتى النهاية.");
    }
  }, [dbRecommendation, profile?.progress]);

  const getGrade = (score: number) => {
    if (score >= 90) return { label: 'A', color: 'text-green-600 bg-green-50' };
    if (score >= 80) return { label: 'B', color: 'text-blue-600 bg-blue-50' };
    if (score >= 70) return { label: 'C', color: 'text-amber-600 bg-amber-50' };
    if (score >= 60) return { label: 'D', color: 'text-orange-600 bg-orange-50' };
    return { label: 'F', color: 'text-red-600 bg-red-50' };
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Main Progress Bar */}
      <div className="mb-8 max-w-5xl mx-auto">
        <div className="flex justify-between mb-2 text-sm font-bold text-muted-foreground">
          <span>نسبة الإنجاز الكلية</span>
          <span>{profile?.progress || 0}%</span>
        </div>
        <div className="h-4 bg-muted-foreground/10 rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(77,44,145,0.5)]" 
            style={{ width: `${profile?.progress || 0}%` }} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Profile Card (Top Right) - md:col-span-4 */}
        <div className="md:col-span-4 bg-card rounded-3xl p-8 shadow-sm border border-border flex flex-col items-center justify-center text-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-muted overflow-hidden shadow-inner">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid || 'Hassan'}`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            {gaugeValue > 0 && (
              <div className={cn(
                "absolute -right-2 -bottom-2 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-4 border-card shadow-lg",
                getGrade(gaugeValue * 100).color
              )}>
                {getGrade(gaugeValue * 100).label}
              </div>
            )}
            <div className="absolute -right-2 top-0 bg-green-500 text-white p-1 rounded-full border-2 border-card shadow-sm">
              <ArrowUp size={14} strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">{profile?.displayName || "المتعلم"}</h2>
          {gaugeValue > 0 && (
            <p className="text-sm font-bold text-muted-foreground mt-1">متوسط التقييم: {Math.round(gaugeValue * 100)}%</p>
          )}
        </div>

        {/* Content Access Count Card (Top Center) - md:col-span-4 */}
        <div className="md:col-span-4 bg-card rounded-3xl p-6 shadow-sm border border-border">
          <h3 className="text-center mb-6 font-bold text-foreground text-lg">عدد مرات الدخول للمحتوى</h3>
          <div className="space-y-5">
            {contentAccess.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="text-muted-foreground">
                  <item.icon size={20} strokeWidth={1.5} />
                </div>
                <div className="flex-1 h-2.5 bg-secondary/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-secondary shadow-[0_0_8px_rgba(0,210,255,0.5)]" 
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <span className="font-bold text-foreground w-6 text-sm text-start">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Grades & Evaluation List (Top Left) - md:col-span-4 */}
        <div className="md:col-span-4 bg-card rounded-3xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-center mb-6 font-bold text-foreground text-lg">درجة الأنشطة وتقييمها</h3>
          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {activityData.map((act, i) => {
              const evalItem = evaluationData.find(e => e.name === act.name);
              const actValue = act.value || 0;
              const evalValue = evalItem?.value || 0;
              
              return (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-2xl border border-border hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {act.name}
                    </div>
                    <span className="font-bold text-foreground text-sm">الدرس {act.name}</span>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase mb-1">الأنشطة</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-muted-foreground/10 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full", actValue >= 50 ? "bg-green-500" : "bg-red-500")} 
                            style={{ width: `${actValue}%` }}
                          />
                        </div>
                        <span className={cn("font-bold text-xs min-w-[28px]", actValue >= 50 ? "text-green-600" : "text-red-500")}>
                          {actValue}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase mb-1">التقييم</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-muted-foreground/10 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full", evalValue >= 50 ? "bg-secondary" : "bg-red-500")} 
                            style={{ width: `${evalValue}%` }}
                          />
                        </div>
                        <span className={cn("font-bold text-xs min-w-[28px]", evalValue >= 50 ? "text-secondary" : "text-red-500")}>
                          {evalValue}%
                        </span>
                      </div>
                    </div>
                    {evalValue > 0 && (
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                        getGrade(evalValue).color
                      )}>
                        {getGrade(evalValue).label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Smart Recommendations Card (Middle Right) - md:col-span-4 */}
        <div className="md:col-span-4 bg-primary/5 rounded-3xl p-8 shadow-sm border border-primary/10">
          <h3 className="text-center mb-4 font-bold text-primary text-xl">توصيات ذكية</h3>
          <div className="w-full h-px bg-primary/10 mb-6" />
          <p className="text-primary leading-relaxed text-lg font-medium text-center">
            {recommendation}
          </p>
        </div>

        {/* Chatbot Quick Access Card */}
        <div 
          className="md:col-span-4 bg-card rounded-3xl p-8 shadow-sm border border-border flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-all cursor-pointer" 
          onClick={() => navigate('/chatbot')}
        >
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MessageSquare size={32} />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">تحدث مع المساعد الذكي</h3>
          <p className="text-sm text-muted-foreground">احصل على إجابات فورية لأسئلتك التعليمية ودعم في دروسك.</p>
          <button className="mt-4 bg-primary text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
            <span>ابدأ المحادثة</span>
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Peer Ranking Card (Center) - md:col-span-4 */}
        <div className="md:col-span-4 bg-card rounded-3xl p-6 shadow-sm border border-border">
          <h3 className="text-center mb-6 font-bold text-foreground text-lg">ترتيبك بين زملاءك</h3>
          <div className="flex flex-col items-center justify-center py-4">
            {(() => {
              const userRankIndex = ranking.findIndex(s => s.id === user?.uid);
              const rankNum = userRankIndex === -1 ? "--" : (userRankIndex + 1).toString().padStart(2, '0');
              const student = ranking[userRankIndex] || profile;

              if (userRankIndex === -1 && ranking.length > 0 && (profile?.progress || 0) > 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground text-sm">جاري حساب ترتيبك...</div>
                );
              }

              return (
                <div className="w-full space-y-4">
                  <div className="bg-primary text-white rounded-3xl p-6 flex flex-col items-center gap-4 shadow-lg transform transition-all hover:scale-105">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/30 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} alt="User" />
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-white text-primary w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl shadow-md">
                        {rankNum}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-xl">{student?.name || student?.displayName || student?.email || "أنت"}</p>
                      <p className="text-white/80 text-sm mt-1">المستوى الحالي: {student?.progress || 0}%</p>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground font-bold">
                    أنت في المركز {rankNum} من أصل {ranking.length} متعلم
                  </p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Session Evaluation Gauge Chart (Bottom Left) - md:col-span-4 */}
        <div className="md:col-span-4 bg-card rounded-3xl p-6 shadow-sm border border-border flex flex-col items-center">
          <h3 className="text-center mb-4 font-bold text-foreground text-lg">مستوى تقييم الجلسة</h3>
          <div className="relative w-full h-[150px] flex items-center justify-center overflow-hidden">
            <svg width="200" height="120" viewBox="0 0 200 120">
              <defs>
                <linearGradient id="gaugeGradient" x1="100%" y1="0%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#00D2FF" />
                  <stop offset="100%" stopColor="#4D2C91" />
                </linearGradient>
              </defs>
              <path 
                d="M 180 100 A 80 80 0 0 0 20 100" 
                fill="none" 
                stroke="hsl(var(--muted))" 
                strokeWidth="20" 
                strokeLinecap="round"
              />
              <path 
                d="M 180 100 A 80 80 0 0 0 20 100" 
                fill="none" 
                stroke="url(#gaugeGradient)" 
                strokeWidth="20" 
                strokeLinecap="round"
                strokeDasharray="251.32"
                strokeDashoffset={251.32 * (1 - gaugeValue)}
              />
              <line 
                x1="100" y1="100" 
                x2={100 - 70 * Math.cos(Math.PI * (1 - gaugeValue))} 
                y2={100 - 70 * Math.sin(Math.PI * (1 - gaugeValue))} 
                stroke="hsl(var(--foreground))" 
                strokeWidth="3" 
                strokeLinecap="round"
              />
              <circle cx="100" cy="100" r="5" fill="hsl(var(--foreground))" />
            </svg>
            <div className="absolute bottom-2 flex gap-4 text-[10px] font-bold">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                <span>منخفض</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-secondary" />
                <span>متوسط</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>مرتفع</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lesson Completion Bar (Bottom Full Width) - md:col-span-12 */}
        <div className="md:col-span-12 bg-secondary/5 rounded-3xl p-8 shadow-sm border border-secondary/10">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <CheckCircle size={20} strokeWidth={1.5} />
              </div>
              <h3 className="font-bold text-foreground text-xl">اكتمال الدروس</h3>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-muted-foreground">
                {Math.round((allSessions.filter(s => completedSessions.includes(s.id) || completedSessions.includes(`session-${s.lessonNumber}`)).length / (allSessions.length || 7)) * 100)}% مكتمل
              </span>
              <div className="bg-primary text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                {allSessions.filter(s => completedSessions.includes(s.id) || completedSessions.includes(`session-${s.lessonNumber}`)).length} / {allSessions.length || 7} دروس
              </div>
            </div>
          </div>
          
          <div className="relative max-w-5xl mx-auto px-4 py-4">
            <div className="absolute top-1/2 left-0 w-full h-2 bg-primary/10 -translate-y-1/2 rounded-full" />
            <div 
              className="absolute top-1/2 right-0 h-2 bg-primary -translate-y-1/2 transition-all duration-1000 rounded-full shadow-[0_0_10px_rgba(77,44,145,0.3)]" 
              style={{ 
                width: `${(allSessions.filter(s => completedSessions.includes(s.id) || completedSessions.includes(`session-${s.lessonNumber}`)).length / (allSessions.length || 7)) * 100}%` 
              }} 
            />
            
            <div className="relative flex items-center justify-between">
              {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                const session = allSessions.find(s => s.lessonNumber === num);
                const isCompleted = session ? (completedSessions.includes(session.id) || completedSessions.includes(`session-${num}`)) : completedSessions.includes(`session-${num}`);
                
                return (
                  <div key={num} className="relative z-10 flex flex-col items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-md transition-all duration-500 border-4",
                      isCompleted ? "bg-primary text-white border-primary" : "bg-card text-primary border-secondary/20"
                    )}>
                      {isCompleted ? <CheckCircle size={24} strokeWidth={1.5} /> : num}
                    </div>
                    <span className={cn("text-xs font-bold", isCompleted ? "text-primary" : "text-muted-foreground")}>
                      الدرس {num}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Completed Lessons Details */}
        <div className="md:col-span-12 bg-card rounded-3xl p-8 shadow-sm border border-border">
          <h3 className="text-center mb-8 font-bold text-foreground text-xl">تفاصيل الدروس المكتملة والوقت المستغرق</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allSessions
              .filter(s => completedSessions.includes(s.id) || completedSessions.includes(`session-${s.lessonNumber}`))
              .map((session) => {
                const statsKey = `session-${session.lessonNumber}`;
                const timeInSeconds = sessionTiming[statsKey] || sessionTiming[session.id] || 0;
                
                return (
                  <div key={session.id} className="bg-muted/50 border border-border rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle size={20} strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{session.title}</h4>
                        <p className="text-xs text-muted-foreground">الدرس رقم {session.lessonNumber}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <Clock size={16} strokeWidth={1.5} />
                        <span>{formatTime(timeInSeconds)}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold">الوقت المستغرق</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
