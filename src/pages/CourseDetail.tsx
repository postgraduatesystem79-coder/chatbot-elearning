import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Play, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  ArrowLeft,
  Lock,
  Download,
  HelpCircle,
  ClipboardList,
  Target,
  FileVideo,
  FileAudio,
  FileCode,
  Presentation,
  AlertCircle,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Plus,
  Trash2,
  Edit,
  Video,
  X,
  Save,
  Loader2,
  Users,
  User,
  Calendar,
  Image as ImageIcon,
  Globe,
  ExternalLink,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn, getYouTubeEmbedUrl, getEmbedUrl, normalizeEvaluation } from '../lib/utils';
import { useAuth } from '../lib/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, updateDoc, increment, getDoc, collection, query, where, addDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../lib/firebase';

export function CourseDetail() {
  const { courseId, lessonId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile, isTeacher, isAdmin } = useAuth();

  // Helper to get stats key (session-1, session-2, etc.)
  const getStatsKey = () => {
    if ((sessionData as any).lessonNumber) {
      return `session-${(sessionData as any).lessonNumber}`;
    }
    return lessonId || 'session-1';
  };
  
  const [step, setStep] = useState<'objectives' | 'content' | 'activities' | 'evaluation' | 'result'>('objectives');
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>({});
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [evaluationScore, setEvaluationScore] = useState<number | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTab, setEditTab] = useState<'basic' | 'content' | 'activities' | 'evaluation'>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVideoWatched, setIsVideoWatched] = useState(false);
  const [isWebRead, setIsWebRead] = useState(false);
  const [webUrl, setWebUrl] = useState('');

  const getIcon = (type: string) => {
    switch (type) {
      case 'web': return Globe;
      case 'video': return Video;
      case 'pdf': return FileText;
      case 'ppt': return Presentation;
      case 'word': return FileText;
      case 'audio': return FileAudio;
      case 'code': return FileCode;
      default: return FileText;
    }
  };
  
  // Timer state
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const secondsElapsedRef = useRef(0);

  // Keep ref in sync
  useEffect(() => {
    secondsElapsedRef.current = secondsElapsed;
  }, [secondsElapsed]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      clearInterval(interval);
      // Save time spent when leaving or stopping
      const currentElapsed = secondsElapsedRef.current;
      if (currentElapsed > 0 && profile?.uid) {
        const statsRef = doc(db, 'users', profile.uid);
        updateDoc(statsRef, {
          [`stats.sessionTiming.${getStatsKey()}`]: increment(currentElapsed)
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}/stats/sessionTiming`));
        setSecondsElapsed(0);
        secondsElapsedRef.current = 0;
      }
    };
  }, [isTimerRunning, profile?.uid, lessonId]);

  // Track content visits
  useEffect(() => {
    if (selectedContent && profile?.uid) {
      const contentType = sessionData.content.find(c => c.id === selectedContent)?.type || 'unknown';
      const statsRef = doc(db, 'users', profile.uid);
      updateDoc(statsRef, {
        [`stats.contentVisits.${contentType}`]: increment(1)
      }).catch(err => console.error("Error saving content visit:", err));
    }
  }, [selectedContent, profile?.uid]);

  // Start timer automatically when entering content
  useEffect(() => {
    if (step === 'content' || step === 'activities' || step === 'evaluation') {
      setIsTimerRunning(true);
    } else if (step === 'result') {
      setIsTimerRunning(false);
    }
  }, [step]);
  
  // Adaptive session data state
  const [sessionData, setSessionData] = useState({
    title: "محتوى الدرس",
    generalObjective: '',
    videoUrl: 'https://www.youtube.com/embed/y53kwdqTLNU',
    wordUrl: 'https://example.com/word',
    pptUrl: 'https://example.com/ppt',
    pdfUrl: 'https://example.com/pdf',
    audioUrl: 'https://example.com/audio',
    objectives: [
      "فهم مفهوم البيئة التكيفية.",
      "التعرف على مكونات لوحة تحكم المعلم.",
      "القدرة على التفاعل مع المحتوى التعليمي المتنوع.",
    ],
    content: [
      { id: 'video', type: 'video', title: 'فيديو تعليمي', color: 'text-purple-500', url: 'https://www.youtube.com/embed/y53kwdqTLNU' },
      { id: 'pdf', type: 'pdf', title: 'ملف PDF', color: 'text-red-500' },
      { id: 'ppt', type: 'ppt', title: 'عرض تقديمي (PPT)', color: 'text-orange-500' },
      { id: 'word', type: 'word', title: 'مستند نصي (Word)', color: 'text-blue-500' },
      { id: 'audio', type: 'audio', title: 'تسجيل صوتي', color: 'text-green-500' },
    ],
    activities: [
      { id: 'act1', title: 'نشاط تفاعلي 1: تحليل البيانات', description: 'قم بتحليل بيانات الطلاب في النموذج المرفق.' },
      { id: 'act2', title: 'نشاط تفاعلي 2: تصميم مسار', description: 'صمم مساراً تعليمياً تكيفياً بسيطاً.' },
    ],
    evaluation: [
      {
        id: 'q1',
        question: 'أي من العبارات التالية تُعبّر بدقة عن المقصود بالذكاء الاصطناعي في المجال التعليمي؟',
        options: [
          { id: 'a', text: 'استخدام أجهزة الحاسوب في عرض المحتوى الدراسي' },
          { id: 'b', text: 'قدرة الأنظمة الرقمية على اتخاذ قرارات مستقلة ومتابعة سلوك المتعلم' },
          { id: 'c', text: 'تسجيل الحضور والدرجات باستخدام نظم إلكترونية' },
          { id: 'd', text: 'مشاركة المعلم لموارد تعليمية عبر البريد الإلكتروني' }
        ],
        correctId: 'b'
      },
      {
        id: 'q2',
        question: "اختر الخيار الذي يُفسر بصورة صحيحة آلية عمل 'التعلم الآلي' (Machine Learning) في التعليم:",
        options: [
          { id: 'a', text: 'يعتمد على الحدس البشري في بناء المحتوى' },
          { id: 'b', text: 'يتبع سيناريوهات تعليمية ثابتة لا تتغير' },
          { id: 'c', text: 'يتعلم من بيانات المتعلم ليطور قرارات مخصصة تلقائيًا' },
          { id: 'd', text: 'يستخدم الإنترنت فقط لجلب المعلومات' }
        ],
        correctId: 'c'
      },
      {
        id: 'q3',
        question: 'أي من المجالات التالية لا تُعد من الاستخدامات المباشرة للذكاء الاصطناعي في تحسين جودة التعليم؟',
        options: [
          { id: 'a', text: 'تقديم تغذية راجعة فورية للطلاب' },
          { id: 'b', text: 'التوصية بمصادر تعليمية مناسبة' },
          { id: 'c', text: 'تصميم الأثاث المدرسي الذكي' },
          { id: 'd', text: 'متابعة تقدم المتعلم عبر تحليلات الأداء' }
        ],
        correctId: 'c'
      },
      {
        id: 'q4',
        question: 'يتعلم طالب بشكل غير متوازن بين الرياضيات واللغة. ما الطريقة الأنسب التي يمكن للذكاء الاصطناعي اتباعها لتخصيص تعلمه؟',
        options: [
          { id: 'a', text: 'تقديم المحتوى ذاته لجميع المواد دون تعديل' },
          { id: 'b', text: 'تعطيل المادة التي يعاني منها مؤقتًا' },
          { id: 'c', text: 'تحليل أداء الطالب وتقديم مهام إضافية مخصصة في الرياضيات' },
          { id: 'd', text: 'الاكتفاء برصد النتائج النهائية دون تدخل' }
        ],
        correctId: 'c'
      },
      {
        id: 'q5',
        question: 'أي من الخيارات التالية يُمثّل فائدة واقعية لتوظيف الذكاء الاصطناعي في تطوير التعليم من منظور تنظيمي ذاتي؟',
        options: [
          { id: 'a', text: 'تقليص دور المتعلم في اتخاذ القرار' },
          { id: 'b', text: 'تسريع إنجاز الواجبات بلا فهم حقيقي' },
          { id: 'c', text: 'دعم المتعلم بخطط مخصصة ومراجعة آلية لتقدمه' },
          { id: 'd', text: 'إجبار المتعلم على اتباع مسار تعلم واحد فقط' }
        ],
        correctId: 'c'
      }
    ]
  });

  const [isLocked, setIsLocked] = useState(false);
  const [allLessons, setAllLessons] = useState<any[]>([]);

  // Fetch all lessons to check sequential access
  useEffect(() => {
    if (!courseId || !lessonId || isTeacher) return;

    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('courseId', '==', courseId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lessons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      lessons.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setAllLessons(lessons);
      
      const currentIndex = lessons.findIndex(l => l.id === lessonId);
      if (currentIndex > 0) {
        const previousLesson = lessons[currentIndex - 1];
        const prevStatsKey = previousLesson.lessonNumber ? `session-${previousLesson.lessonNumber}` : previousLesson.id;
        const isPrevCompleted = profile?.stats?.completedLessons?.includes(prevStatsKey) || 
                                profile?.stats?.evaluationPerformance?.[prevStatsKey] !== undefined;
        
        if (!isPrevCompleted) {
          setIsLocked(true);
          toast.error('يجب إكمال الدرس السابق أولاً');
          navigate(`/courses/${courseId}/lessons`);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    return () => unsubscribe();
  }, [courseId, lessonId, isTeacher, profile?.stats?.completedLessons, profile?.stats?.evaluationPerformance]);

  // Fetch session data from Firestore
  useEffect(() => {
    const sessionId = lessonId || 'session-1';
    const docRef = doc(db, 'sessions', sessionId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setSessionData({
          ...data,
          evaluation: normalizeEvaluation(data.evaluation || [])
        });
        setEditingSession({
          title: data.title || '',
          generalObjective: data.generalObjective || '',
          webUrl: data.webUrl || '',
          videoUrl: data.videoUrl || '',
          wordUrl: data.wordUrl || '',
          pptUrl: data.pptUrl || '',
          pdfUrl: data.pdfUrl || '',
          audioUrl: data.audioUrl || '',
          code: data.code || '',
          objectives: (data.objectives || []).join('\n'),
          activities: [...(data.activities || [])],
          evaluation: normalizeEvaluation(data.evaluation || [])
        });
      }
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, sessionId);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [lessonId]);

  const [editingSession, setEditingSession] = useState({
    title: sessionData.title,
    generalObjective: (sessionData as any).generalObjective || '',
    webUrl: (sessionData as any).webUrl || '',
    videoUrl: sessionData.videoUrl,
    wordUrl: sessionData.wordUrl,
    pptUrl: sessionData.pptUrl,
    pdfUrl: sessionData.pdfUrl,
    audioUrl: sessionData.audioUrl,
    code: (sessionData as any).code || '',
    objectives: sessionData.objectives.join('\n'),
    activities: [...sessionData.activities],
    evaluation: [...sessionData.evaluation]
  });

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const newObjectives = editingSession.objectives.split('\n').filter(o => o.trim() !== '');
      const updatedData = {
        ...sessionData,
        title: editingSession.title,
        generalObjective: editingSession.generalObjective,
        webUrl: editingSession.webUrl,
        videoUrl: getYouTubeEmbedUrl(editingSession.videoUrl),
        wordUrl: editingSession.wordUrl,
        pptUrl: editingSession.pptUrl,
        pdfUrl: editingSession.pdfUrl,
        audioUrl: editingSession.audioUrl,
        code: editingSession.code,
        objectives: newObjectives,
        activities: editingSession.activities,
        evaluation: editingSession.evaluation,
        content: [
          { id: 'web', type: 'web', title: 'صفحة ويب', icon: 'Globe', color: 'text-blue-600', url: editingSession.webUrl },
          { id: 'code', type: 'code', title: 'كود مدمج', icon: 'FileCode', color: 'text-slate-600', url: editingSession.code },
          { id: 'video', type: 'video', title: 'فيديو تعليمي', icon: 'Video', color: 'text-purple-500', url: getYouTubeEmbedUrl(editingSession.videoUrl) },
          { id: 'pdf', type: 'pdf', title: 'ملف PDF', icon: 'FileText', color: 'text-red-500', url: editingSession.pdfUrl },
          { id: 'ppt', type: 'ppt', title: 'عرض تقديمي (PPT)', icon: 'Presentation', color: 'text-orange-500', url: editingSession.pptUrl },
          { id: 'word', type: 'word', title: 'مستند نصي (Word)', icon: 'FileText', color: 'text-blue-500', url: editingSession.wordUrl },
          { id: 'audio', type: 'audio', title: 'تسجيل صوتي', icon: 'FileAudio', color: 'text-green-500', url: editingSession.audioUrl },
        ].filter(item => item.url),
        updatedAt: serverTimestamp()
      };

      const sessionId = lessonId || 'session-1';
      await setDoc(doc(db, 'sessions', sessionId), updatedData);
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, lessonId || 'session-1');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (selectedContent && profile?.uid) {
      const contentItem = sessionData.content.find(c => c.id === selectedContent);
      if (contentItem) {
        const statsRef = doc(db, 'users', profile.uid);
        const visitKey = `stats.contentVisits.${contentItem.type}`;
        updateDoc(statsRef, {
          [visitKey]: increment(1)
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}/stats/contentVisits`));
      }
    }
  }, [selectedContent, profile?.uid]);

  const handleEvaluation = async () => {
    const correctCount = sessionData.evaluation.filter((q, idx) => quizAnswers[idx] === q.correctId).length;
    const totalQuestions = sessionData.evaluation.length || 1;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const isPassed = scorePercent >= 85;
    
    setEvaluationScore(scorePercent);
    setIsCorrect(isPassed);

    if (isPassed) {
      // Save evaluation performance and mark lesson as completed
      if (profile?.uid && lessonId) {
        const statsRef = doc(db, 'users', profile.uid);
        const currentCompleted = profile?.stats?.completedLessons || [];
        const newCompletedCount = currentCompleted.includes(getStatsKey()) 
          ? currentCompleted.length 
          : currentCompleted.length + 1;
        
        const totalLessons = allLessons.length || 7;
        const progressPercent = Math.round((newCompletedCount / totalLessons) * 100);

        await updateDoc(statsRef, {
          [`stats.evaluationPerformance.${getStatsKey()}`]: scorePercent,
          [`stats.completedLessons`]: arrayUnion(getStatsKey()),
          [`stats.coursesCompleted`]: increment(1),
          progress: progressPercent
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}/stats/evaluation`));
      }
    } else {
      setHasFailed(true);
      setFailCount(prev => prev + 1);
      // Save failed attempt with score percentage
      if (profile?.uid && lessonId) {
        const statsRef = doc(db, 'users', profile.uid);
        await updateDoc(statsRef, {
          [`stats.evaluationPerformance.${getStatsKey()}`]: scorePercent // Save percentage even if failed
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}/stats/evaluation`));
      }
    }
    setStep('result');
  };

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [activityAnswers, setActivityAnswers] = useState<Record<string, string>>({});
  const [activityFileUrls, setActivityFileUrls] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (activityId: string, file: File) => {
    if (!profile?.uid) return;
    
    setIsUploading(prev => ({ ...prev, [activityId]: true }));
    try {
      console.log('Starting file upload to local server...');
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const validExtensions = ['pdf', 'doc', 'docx'];
      if (!validExtensions.includes(fileExt)) {
        throw new Error('يرجى رفع ملفات Word أو PDF فقط.');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', profile.uid);
      formData.append('activityId', activityId);

      const response = await fetch('/api/upload-submission', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل الرفع عبر الخادم');
      }

      const result = await response.json();
      const downloadURL = result.url;
      
      setActivityFileUrls(prev => ({ ...prev, [activityId]: downloadURL }));
      toast.success('تم رفع الملف بنجاح');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(`فشل رفع الملف: ${error.message || 'يرجى المحاولة مرة أخرى'}`);
    } finally {
      setIsUploading(prev => ({ ...prev, [activityId]: false }));
    }
  };

  useEffect(() => {
    if (profile?.uid && lessonId) {
      const submissionsRef = collection(db, 'submissions');
      const q = query(
        submissionsRef, 
        where('studentId', '==', profile.uid),
        where('sessionId', '==', lessonId)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSubmissions(subs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'submissions');
      });

      return () => unsubscribe();
    }
  }, [profile?.uid, lessonId]);

  const handleSubmitActivity = async (activityId: string) => {
    if (!profile?.uid || !lessonId) return;
    
    const answer = activityAnswers[activityId];
    const fileUrl = activityFileUrls[activityId];
    if (!answer?.trim() && !fileUrl?.trim()) {
      toast.error('يرجى كتابة الإجابة أو وضع رابط الملف أولاً');
      return;
    }

    setIsSubmitting(activityId);
    try {
      await addDoc(collection(db, 'submissions'), {
        studentId: profile.uid,
        studentName: profile.name || profile.email,
        sessionId: lessonId,
        courseId: courseId,
        activityId,
        answer: answer || '',
        fileUrl: fileUrl || '',
        status: 'pending',
        submittedAt: serverTimestamp()
      });
      
      // Update performance stats
      const alreadySubmitted = submissions.some(s => s.activityId === activityId);
      if (!alreadySubmitted) {
        await handleCompleteActivity(activityId);
      } else {
        toast.success('تم تحديث تسليم النشاط بنجاح!');
      }

      setActivityAnswers(prev => ({ ...prev, [activityId]: '' }));
      setActivityFileUrls(prev => ({ ...prev, [activityId]: '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    if (profile?.uid && lessonId) {
      const totalActivities = sessionData.activities.length || 1;
      const incrementValue = Math.round(100 / totalActivities);
      
      const statsRef = doc(db, 'users', profile.uid);
      await updateDoc(statsRef, {
        [`stats.activityPerformance.${getStatsKey()}`]: increment(incrementValue)
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}/stats/activity`));
      toast.success(t('activity_completed') || 'تم إكمال النشاط بنجاح!');
    }
  };

  const resetSession = () => {
    setStep('content');
    setQuizAnswers({});
    setCheckedQuestions({});
    setCurrentQuestionIndex(0);
    setIsCorrect(null);
  };

  if (isLoading || isLocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" strokeWidth={1.5} />
        <p className="text-muted-foreground font-bold">جاري التحقق من الوصول...</p>
      </div>
    );
  }

  const canAccess = isTeacher || isAdmin || profile?.status === 'active';

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-card border border-border rounded-3xl shadow-sm">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
          <AlertCircle size={40} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">الحساب غير مفعل</h2>
        <p className="text-muted-foreground max-w-md font-medium leading-relaxed">
          عذراً، يجب تفعيل حسابك من قبل المعلم لتتمكن من الوصول إلى محتوى هذا المقرر والأنشطة.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="mt-8 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Session Navigation Header */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(`/courses/${courseId}`)}
              className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-primary"
            >
              <ArrowLeft size={24} strokeWidth={1.5} />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-primary tracking-tight">{sessionData.title}</h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                <div className="flex items-center gap-2 font-medium">
                  <Clock size={16} strokeWidth={1.5} />
                  <span>مدة الدرس المتوقعة: 45 دقيقة</span>
                </div>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full font-mono font-bold transition-all border",
                  isTimerRunning ? "bg-primary/5 text-primary border-primary/20 animate-pulse" : "bg-muted text-muted-foreground border-border"
                )}>
                  <div className={cn("w-2 h-2 rounded-full", isTimerRunning ? "bg-primary" : "bg-muted-foreground")} />
                  <span>{formatTime(secondsElapsed)}</span>
                  <button 
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className="ms-2 p-1 hover:bg-primary/20 rounded-md transition-colors"
                    title={isTimerRunning ? "إيقاف مؤقت" : "استئناف"}
                  >
                    {isTimerRunning ? <X size={12} strokeWidth={2} /> : <Play size={12} strokeWidth={2} />}
                  </button>
                </div>
                <button 
                  onClick={() => toast.info(`توقيت الدرس الحالي: ${formatTime(secondsElapsed)}`)}
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                >
                  <Target size={14} strokeWidth={1.5} />
                  <span>احسب توقيت الدرس</span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['objectives', 'content', 'activities', 'evaluation'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all border",
                  step === s ? "bg-primary text-primary-foreground border-primary scale-110 shadow-lg shadow-primary/20" : 
                  "bg-muted text-muted-foreground border-border"
                )}>
                  {i + 1}
                </div>
                {i < 3 && <div className="w-8 h-0.5 bg-border mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 'objectives' && (
            <motion.div 
              key="objectives"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-3 text-xl font-bold">
                <div className="flex items-center gap-3">
                  <Target className="text-primary" strokeWidth={1.5} />
                  <h3 className="text-foreground">أهداف الدرس</h3>
                </div>
                {isTeacher && (
                  <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold border border-primary/20"
                  >
                    <Edit size={16} strokeWidth={1.5} />
                    <span>تعديل الدرس</span>
                  </button>
                )}
              </div>
              
              <div className="grid gap-4">
                {sessionData.objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border transition-all hover:border-primary/30">
                    <CheckCircle2 className="text-secondary" size={20} strokeWidth={1.5} />
                    <p className="font-bold text-foreground text-sm">{obj}</p>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setStep('content')}
                className="w-full md:w-auto bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                <span>انتقل للمحتوى</span>
                <ArrowRight size={20} strokeWidth={1.5} />
              </button>
            </motion.div>
          )}

          {step === 'content' && (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 text-xl font-bold">
                <BookOpen className="text-primary" strokeWidth={1.5} />
                <h3 className="text-foreground">محتوى الدرس</h3>
              </div>
              
              <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-xl flex items-center gap-3 text-sm text-secondary font-bold shadow-inner">
                <AlertCircle size={18} strokeWidth={1.5} />
                <p>
                  {failCount === 0 
                    ? "يرجى مشاهدة الفيديو التعليمي أولاً. بعد الانتهاء، يجب أداء الأنشطة التعليمية قبل الانتقال للتقييم."
                    : failCount === 1
                    ? "تم تفعيل ملف PDF كدعم إضافي. يرجى مراجعته ثم أداء النشاط العلاجي قبل إعادة التقييم."
                    : "تم تفعيل كافة الوسائط التعليمية لدعمك. يرجى مراجعة المحتوى وأداء الأنشطة لضمان اجتياز التقييم."
                  }
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {sessionData.content.map((item) => {
                  const hasWeb = sessionData.content.some(c => c.type === 'web');
                  const isWebItem = item.type === 'web';
                  const isVideoItem = item.type === 'video';
                  const isPdfItem = item.type === 'pdf';
                  
                  // Video is locked until web is read (if web exists)
                  const isLocked = !isTeacher && isVideoItem && hasWeb && !isWebRead;
                  
                  let isDisabled = false;
                  if (!isTeacher && !isAdmin) {
                    if (isWebItem) {
                      isDisabled = false;
                    } else if (isVideoItem) {
                      isDisabled = isLocked;
                    } else if (isPdfItem) {
                      isDisabled = failCount < 1;
                    } else {
                      isDisabled = failCount < 2;
                    }
                  }
                  
                  const Icon = getIcon(item.type);
                  return (
                    <button 
                      key={item.id}
                      disabled={isDisabled}
                      onClick={() => setSelectedContent(item.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-6 rounded-2xl border transition-all gap-3 group relative",
                        selectedContent === item.id ? "bg-primary/10 border-primary shadow-lg shadow-primary/10" : "bg-card border-border hover:bg-muted",
                        isDisabled && "opacity-50 grayscale"
                      )}
                    >
                      <Icon size={32} strokeWidth={1.5} className={cn("transition-transform group-hover:scale-110", item.color, isDisabled && "opacity-20")} />
                      <span className="text-xs font-bold text-center text-foreground">{item.title}</span>
                      {isDisabled && (
                        <div className="absolute top-2 right-2 p-1 bg-background/80 rounded-lg shadow-sm border border-border">
                          <Lock size={14} className="text-primary" strokeWidth={1.5} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {selectedContent && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 md:p-8 bg-muted/50 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center gap-4 overflow-hidden"
                >
                  {sessionData.content.find(c => c.id === selectedContent)?.url ? (
                    <>
                      {['web', 'pdf', 'ppt', 'word', 'code'].includes(sessionData.content.find(c => c.id === selectedContent)?.type || '') ? (
                        <div className="w-full space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-xl border shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-lg",
                                sessionData.content.find(c => c.id === selectedContent)?.type === 'web' ? "bg-blue-100" :
                                sessionData.content.find(c => c.id === selectedContent)?.type === 'pdf' ? "bg-red-100" :
                                sessionData.content.find(c => c.id === selectedContent)?.type === 'ppt' ? "bg-orange-100" :
                                sessionData.content.find(c => c.id === selectedContent)?.type === 'word' ? "bg-blue-100" : "bg-slate-100"
                              )}>
                                {(() => {
                                  const Icon = getIcon(sessionData.content.find(c => c.id === selectedContent)?.type || '');
                                  return <Icon size={20} className={cn(
                                    sessionData.content.find(c => c.id === selectedContent)?.type === 'web' ? "text-blue-600" :
                                    sessionData.content.find(c => c.id === selectedContent)?.type === 'pdf' ? "text-red-600" :
                                    sessionData.content.find(c => c.id === selectedContent)?.type === 'ppt' ? "text-orange-600" :
                                    sessionData.content.find(c => c.id === selectedContent)?.type === 'word' ? "text-blue-600" : "text-slate-600"
                                  )} />;
                                })()}
                              </div>
                              <div className="text-right">
                                <h4 className="font-bold text-sm">
                                  {sessionData.content.find(c => c.id === selectedContent)?.type === 'web' ? 'محتوى صفحة الويب' :
                                   sessionData.content.find(c => c.id === selectedContent)?.type === 'pdf' ? 'عرض ملف PDF' :
                                   sessionData.content.find(c => c.id === selectedContent)?.type === 'ppt' ? 'عرض تقديمي' :
                                   sessionData.content.find(c => c.id === selectedContent)?.type === 'word' ? 'مستند نصي' : 'محتوى مدمج'}
                                </h4>
                                <p className="text-[10px] text-muted-foreground">استعرض المحتوى أدناه مباشرة</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <a 
                                href={sessionData.content.find(c => c.id === selectedContent)?.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-xs font-bold hover:bg-secondary/80 transition-all flex items-center gap-2"
                              >
                                <ExternalLink size={14} />
                                <span>فتح في نافذة جديدة</span>
                              </a>
                              {sessionData.content.find(c => c.id === selectedContent)?.type === 'web' && !isWebRead && !isTeacher && (
                                <button 
                                  onClick={() => {
                                    setIsWebRead(true);
                                    toast.success('تم تأكيد قراءة المحتوى، يمكنك الآن مشاهدة الفيديو');
                                  }}
                                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                                >
                                  <CheckCircle2 size={14} />
                                  <span>تمت القراءة</span>
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="w-full h-[750px] rounded-xl overflow-hidden border bg-white shadow-lg relative group">
                            {/* Fallback background message in case iframe fails to load or is blocked */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50 -z-10">
                              <AlertCircle size={48} className="text-amber-500 mb-4" />
                              <h5 className="font-bold text-lg mb-2">تعذر تحميل المعاينة؟</h5>
                              <p className="text-sm text-muted-foreground max-w-md mb-6">
                                بعض المواقع تمنع عرض محتواها داخل إطارات لأسباب أمنية. يرجى استخدام الزر أدناه لفتح المحتوى في نافذة مستقلة.
                              </p>
                              <a 
                                href={sessionData.content.find(c => c.id === selectedContent)?.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => {
                                  if (sessionData.content.find(c => c.id === selectedContent)?.type === 'web') {
                                    setIsWebRead(true);
                                  }
                                }}
                                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg"
                              >
                                <ExternalLink size={20} />
                                <span>فتح المحتوى في نافذة جديدة</span>
                              </a>
                            </div>

                            <iframe 
                              src={getEmbedUrl(sessionData.content.find(c => c.id === selectedContent)?.url || '')}
                              className="w-full h-full relative z-10 bg-white"
                              title="Embedded Content"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                            
                            {/* Overlay helper for web content */}
                            {sessionData.content.find(c => c.id === selectedContent)?.type === 'web' && (
                              <div className="absolute bottom-4 left-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-background/95 backdrop-blur-sm p-3 rounded-xl border shadow-xl flex items-center justify-between gap-4">
                                  <p className="text-xs font-medium">إذا لم يظهر المحتوى بشكل صحيح، يمكنك فتحه في نافذة جديدة.</p>
                                  <a 
                                    href={sessionData.content.find(c => c.id === selectedContent)?.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={() => setIsWebRead(true)}
                                    className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap"
                                  >
                                    فتح الرابط المباشر
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : sessionData.content.find(c => c.id === selectedContent)?.type === 'audio' ? (
                        <div className="w-full p-12 bg-card border rounded-2xl flex flex-col items-center gap-6 shadow-sm">
                          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-600">
                            <FileAudio size={40} />
                          </div>
                          <div className="text-center">
                            <h4 className="font-bold text-lg">تسجيل صوتي تعليمي</h4>
                            <p className="text-sm text-muted-foreground">استمع إلى المحتوى الصوتي المرفق</p>
                          </div>
                          <audio 
                            controls 
                            className="w-full max-w-md"
                            src={sessionData.content.find(c => c.id === selectedContent)?.url}
                          >
                            متصفحك لا يدعم تشغيل الملفات الصوتية.
                          </audio>
                        </div>
                      ) : (
                        <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg">
                          <iframe
                            className="w-full h-full"
                            src={getYouTubeEmbedUrl(sessionData.content.find(c => c.id === selectedContent)?.url || '')}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          ></iframe>
                        </div>
                      )}
                      {sessionData.content.find(c => c.id === selectedContent)?.id === 'video' && !isVideoWatched && (
                        <button 
                          onClick={() => setIsVideoWatched(true)}
                          className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          <span>لقد شاهدت الفيديو بالكامل</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <Play size={48} className="text-primary animate-pulse" />
                      <p className="font-bold">يتم الآن عرض: {sessionData.content.find(c => c.id === selectedContent)?.title}</p>
                      <p className="text-sm text-muted-foreground max-w-md">هنا يظهر المحتوى التعليمي المختار (فيديو، ملف، أو نص) للتفاعل معه.</p>
                    </>
                  )}
                </motion.div>
              )}

              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-4">
                  <button onClick={() => setStep('objectives')} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-all text-foreground">السابق</button>
                  <button 
                    onClick={() => setStep('activities')} 
                    disabled={(!isVideoWatched || (sessionData.content.some(c => c.type === 'web') && !isWebRead)) && !isTeacher}
                    className={cn(
                      "flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20",
                      (!isVideoWatched || (sessionData.content.some(c => c.type === 'web') && !isWebRead)) && !isTeacher && "grayscale"
                    )}
                  >
                    انتقل للأنشطة
                  </button>
                </div>
                {(!isVideoWatched || (sessionData.content.some(c => c.type === 'web') && !isWebRead)) && !isTeacher && (
                  <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-bold animate-pulse">
                    <AlertCircle size={12} strokeWidth={2} />
                    <span>يرجى قراءة المحتوى ومشاهدة الفيديو التعليمي وتأكيد ذلك لتفعيل زر التالي</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'activities' && (
            <motion.div 
              key="activities"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-3 text-xl font-bold">
                <div className="flex items-center gap-3">
                  <ClipboardList className="text-primary" strokeWidth={1.5} />
                  <h3 className="text-foreground">الأنشطة التعليمية</h3>
                </div>
                {isTeacher && (
                  <button 
                    onClick={() => {
                      setEditTab('activities');
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold border border-primary/20 shadow-sm"
                  >
                    <Edit size={16} strokeWidth={1.5} />
                    <span>تعديل الأنشطة</span>
                  </button>
                )}
              </div>

              {failCount > 0 && (
                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl flex items-center gap-3 text-sm text-orange-600 font-bold shadow-inner">
                  <AlertCircle size={18} strokeWidth={1.5} />
                  <p>هذا نشاط علاجي مختلف لتعزيز فهمك للمحتوى قبل إعادة التقييم.</p>
                </div>
              )}
              <div className="grid gap-4">
                {sessionData.activities
                  .filter((_, index) => {
                    if (isTeacher || isAdmin) return true;
                    if (failCount === 0) return index === 0;
                    if (failCount === 1) return index === 1;
                    return true; // Show all for more failures
                  })
                  .map((act) => (
                    <div key={act.id} className="p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-all space-y-4 group">
                    <div className="flex flex-col md:flex-row gap-6">
                      {act.imageUrl && (
                        <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden flex-shrink-0 shadow-inner border border-border">
                          <img 
                            src={act.imageUrl} 
                            alt={act.title} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <h4 className="font-bold text-lg text-foreground tracking-tight">{act.title}</h4>
                            {failCount > 0 && (
                              <span className="text-[10px] text-orange-500 font-bold bg-orange-500/5 px-2 py-0.5 rounded-full border border-orange-500/10 w-fit">نشاط علاجي داعم</span>
                            )}
                          </div>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border",
                            act.type === 'group' ? "bg-primary/5 text-primary border-primary/10" : "bg-secondary/5 text-secondary border-secondary/10"
                          )}>
                            {act.type === 'group' ? <Users size={12} strokeWidth={1.5} /> : <User size={12} strokeWidth={1.5} />}
                            {act.type === 'group' ? t('group') : t('individual')}
                          </div>
                        </div>
                        <p className="text-muted-foreground text-sm line-clamp-3 font-medium leading-relaxed">{act.description}</p>
                        
                        {(act.startDate || act.endDate) && (
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
                            {act.startDate && (
                              <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg">
                                <Clock size={14} className="text-primary" strokeWidth={1.5} />
                                <span className="font-bold">البداية:</span>
                                <span>{new Date(act.startDate).toLocaleString('ar-EG')}</span>
                              </div>
                            )}
                            {act.endDate && (
                              <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg">
                                <Clock size={14} className="text-destructive" strokeWidth={1.5} />
                                <span className="font-bold">النهاية:</span>
                                <span>{new Date(act.endDate).toLocaleString('ar-EG')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submission Section */}
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {submissions.find(s => s.activityId === act.id) ? (
                        <div className="bg-muted/50 p-4 rounded-xl space-y-3 border border-border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                              <CheckCircle2 size={18} strokeWidth={1.5} />
                              <span>تم تسليم النشاط</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {submissions.find(s => s.activityId === act.id).submittedAt?.toDate().toLocaleString('ar-EG')}
                            </span>
                          </div>
                          
                          <div className="text-sm bg-card p-3 rounded-lg border border-border shadow-inner">
                            <p className="text-muted-foreground text-[10px] uppercase font-bold mb-1">إجابتك:</p>
                            <p className="font-medium">{submissions.find(s => s.activityId === act.id).answer}</p>
                            
                            {submissions.find(s => s.activityId === act.id).fileUrl && (
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <p className="text-muted-foreground text-[10px] uppercase font-bold mb-1">الملف المرفق:</p>
                                <a 
                                  href={submissions.find(s => s.activityId === act.id).fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all"
                                >
                                  <Download size={14} />
                                  <span>تحميل/عرض الملف المرفق</span>
                                </a>
                              </div>
                            )}
                          </div>

                          {submissions.find(s => s.activityId === act.id).status === 'graded' && (
                            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-primary text-sm">تقييم المعلم</span>
                                <span className="bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-bold shadow-sm">
                                  {submissions.find(s => s.activityId === act.id).grade} / 100
                                </span>
                              </div>
                              {submissions.find(s => s.activityId === act.id).feedback && (
                                <p className="text-xs italic text-muted-foreground bg-background/50 p-2 rounded border border-primary/10">
                                  "{submissions.find(s => s.activityId === act.id).feedback}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <Edit size={16} className="text-primary" strokeWidth={1.5} />
                            <span>إرسال الإجابة</span>
                          </div>
                          <textarea 
                            value={activityAnswers[act.id] || ''}
                            onChange={(e) => setActivityAnswers(prev => ({ ...prev, [act.id]: e.target.value }))}
                            placeholder="اكتب إجابتك هنا..."
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all text-sm min-h-[100px] font-medium"
                          />
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Upload size={18} className="text-primary" strokeWidth={1.5} />
                              <span>إرفاق ملف النشاط</span>
                            </label>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="relative group">
                                <input
                                  type="file"
                                  id={`file-upload-${act.id}`}
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(act.id, file);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => document.getElementById(`file-upload-${act.id}`)?.click()}
                                  disabled={isUploading[act.id]}
                                  className={cn(
                                    "w-full h-24 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
                                    activityFileUrls[act.id] 
                                      ? "border-green-500 bg-green-500/5 text-green-600" 
                                      : "border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary",
                                    isUploading[act.id] && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {isUploading[act.id] ? (
                                    <Loader2 className="animate-spin" size={24} />
                                  ) : activityFileUrls[act.id] ? (
                                    <CheckCircle2 size={24} />
                                  ) : (
                                    <Upload size={24} />
                                  )}
                                  <span className="text-xs font-bold">
                                    {isUploading[act.id] ? "جاري الرفع..." : activityFileUrls[act.id] ? "تم رفع الملف بنجاح" : "اضغط لرفع ملف النشاط"}
                                  </span>
                                </button>
                              </div>

                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">أو ضع رابط الملف (Drive, Dropbox, etc.)</p>
                                <input 
                                  type="url"
                                  value={activityFileUrls[act.id] || ''}
                                  onChange={(e) => setActivityFileUrls(prev => ({ ...prev, [act.id]: e.target.value }))}
                                  placeholder="رابط الملف..."
                                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all text-sm font-mono"
                                />
                                {activityFileUrls[act.id] && !isUploading[act.id] && (
                                  <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <CheckCircle2 size={10} />
                                    تم إرفاق الملف بنجاح
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => handleSubmitActivity(act.id)}
                              disabled={isSubmitting === act.id || (!activityAnswers[act.id]?.trim() && !activityFileUrls[act.id]?.trim())}
                              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                            >
                              {isSubmitting === act.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={1.5} />}
                              <span>{t('submit_activity')}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-4">
                  <button onClick={() => setStep('content')} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-all text-foreground">السابق</button>
                  <button 
                    onClick={() => setStep('evaluation')} 
                    disabled={submissions.length === 0 && !isTeacher}
                    className={cn(
                      "flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20",
                      submissions.length === 0 && !isTeacher && "grayscale"
                    )}
                  >
                    انتقل للتقييم
                  </button>
                </div>
                {submissions.length === 0 && !isTeacher && (
                  <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-bold animate-pulse">
                    <AlertCircle size={12} strokeWidth={2} />
                    <span>يرجى إرسال إجابة النشاط أولاً لتفعيل الانتقال للتقييم</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'evaluation' && (
            <motion.div 
              key="evaluation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-3 text-xl font-bold">
                <div className="flex items-center gap-3">
                  <HelpCircle className="text-primary" strokeWidth={1.5} />
                  <h3 className="text-foreground">التقييم النهائي</h3>
                </div>
                {isTeacher && (
                  <button 
                    onClick={() => {
                      setEditTab('evaluation');
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold border border-primary/20 shadow-sm"
                  >
                    <Edit size={16} strokeWidth={1.5} />
                    <span>تعديل الأسئلة</span>
                  </button>
                )}
              </div>
              
              <div className="bg-card border border-border rounded-2xl p-8 space-y-6 shadow-sm">
                {sessionData.evaluation && sessionData.evaluation.length > 0 && sessionData.evaluation[currentQuestionIndex] ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-primary bg-primary/5 border border-primary/10 px-4 py-1.5 rounded-full shadow-inner">
                        السؤال {currentQuestionIndex + 1} من {sessionData.evaluation.length}
                      </span>
                    </div>
                    
                    <p className="text-xl font-bold text-foreground tracking-tight leading-relaxed">{sessionData.evaluation[currentQuestionIndex].question}</p>
                    <div className="grid gap-3">
                      {sessionData.evaluation[currentQuestionIndex].options.map((opt: any, oIdx: number) => {
                        const isSelected = quizAnswers[currentQuestionIndex] === opt.id;
                        const isCorrectOption = opt.id === sessionData.evaluation[currentQuestionIndex].correctId;
                        const hasChecked = checkedQuestions[currentQuestionIndex];
                        
                        return (
                          <button
                            key={opt.id || oIdx}
                            disabled={hasChecked}
                            onClick={() => {
                              setQuizAnswers({ ...quizAnswers, [currentQuestionIndex]: opt.id });
                              setCheckedQuestions({ ...checkedQuestions, [currentQuestionIndex]: true });
                            }}
                            className={cn(
                              "w-full p-5 rounded-xl border text-start transition-all font-bold relative group",
                              !hasChecked && isSelected && "bg-primary/5 border-primary shadow-inner",
                              hasChecked && isCorrectOption && "bg-green-500/5 border-green-500 text-green-600 shadow-inner",
                              hasChecked && isSelected && !isCorrectOption && "bg-destructive/5 border-destructive text-destructive shadow-inner",
                              !hasChecked && "hover:bg-muted hover:border-primary/30"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{opt.text}</span>
                              {hasChecked && isCorrectOption && <CheckCircle2 size={20} className="text-green-600" strokeWidth={1.5} />}
                              {hasChecked && isSelected && !isCorrectOption && <X size={20} className="text-destructive" strokeWidth={1.5} />}
                              {!hasChecked && isSelected && <div className="w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/20" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {checkedQuestions[currentQuestionIndex] && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-4 rounded-xl font-bold text-center animate-in fade-in slide-in-from-top-2 border",
                          quizAnswers[currentQuestionIndex] === sessionData.evaluation[currentQuestionIndex].correctId 
                            ? "bg-green-500/5 text-green-600 border-green-500/20" 
                            : "bg-destructive/5 text-destructive border-destructive/20"
                        )}
                      >
                        {quizAnswers[currentQuestionIndex] === sessionData.evaluation[currentQuestionIndex].correctId 
                          ? "إجابة ذكية وصحيحة! أحسنت" 
                          : "للأسف، الإجابة غير صحيحة"}
                      </motion.div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto text-muted-foreground/30">
                      <HelpCircle size={48} strokeWidth={1} />
                    </div>
                    <p className="text-muted-foreground font-bold">لا توجد أسئلة تقييم متاحة حالياً لهذا الدرس.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    if (currentQuestionIndex > 0) {
                      setCurrentQuestionIndex(prev => prev - 1);
                    } else {
                      setStep('activities');
                    }
                  }} 
                  className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                >
                  السابق
                </button>
                
                {sessionData.evaluation && sessionData.evaluation.length > 0 && (
                  currentQuestionIndex < sessionData.evaluation.length - 1 ? (
                    <button 
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      disabled={!quizAnswers[currentQuestionIndex]}
                      className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      السؤال التالي
                    </button>
                  ) : (
                    <button 
                      onClick={handleEvaluation}
                      disabled={!quizAnswers[currentQuestionIndex]}
                      className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      إرسال الإجابة
                    </button>
                  )
                )}
              </div>
            </motion.div>
          )}

          {step === 'result' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center space-y-6"
            >
              <div className="space-y-2">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">نتيجتك النهائية</p>
                <div className={cn(
                  "text-6xl font-black",
                  isCorrect ? "text-green-500" : "text-destructive"
                )}>
                  {evaluationScore}%
                </div>
              </div>

              {isCorrect ? (
                <>
                  <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-4">
                    <CheckCircle2 size={64} />
                  </div>
                  <p className="font-bold text-2xl text-green-500">تهانينا! لقد اجتزت التقييم</p>
                  <p className="text-muted-foreground max-w-md">لقد حصلت على درجة أعلى من 85%. يمكنك الآن الانتقال إلى الدرس التالي بثقة.</p>
                  <button 
                    onClick={() => {
                      const currentIndex = allLessons.findIndex(l => l.id === lessonId);
                      if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
                        const nextLesson = allLessons[currentIndex + 1];
                        navigate(`/courses/${courseId}/lessons/${nextLesson.id}`);
                        // Reset state for next lesson
                        setStep('objectives');
                        setQuizAnswers({});
                        setCheckedQuestions({});
                        setCurrentQuestionIndex(0);
                        setIsCorrect(null);
                        setEvaluationScore(null);
                        setSecondsElapsed(0);
                        setHasFailed(false);
                      } else {
                        navigate('/courses');
                      }
                    }}
                    className="bg-primary text-primary-foreground px-12 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    انتقل للدرس التالي
                  </button>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-4">
                    <AlertCircle size={64} />
                  </div>
                  <p className="text-3xl font-bold text-destructive">تحتاج لمراجعة الدرس</p>
                  <p className="text-muted-foreground max-w-md">للأسف، درجتك أقل من 85%. يرجى العودة لمراجعة محتوى الدرس والأنشطة مرة أخرى لتعزيز فهمك قبل إعادة المحاولة.</p>
                  <button 
                    onClick={resetSession}
                    className="bg-primary text-primary-foreground px-12 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    مراجعة المحتوى
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Session Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b flex flex-col gap-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Edit size={20} />
                    </div>
                    <h3 className="font-bold text-xl">{t('edit_session_content') || 'تعديل محتوى الدرس'}</h3>
                  </div>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { id: 'basic', label: 'الأساسية', icon: FileText },
                    { id: 'content', label: 'المحتوى', icon: Video },
                    { id: 'activities', label: 'الأنشطة', icon: ClipboardList },
                    { id: 'evaluation', label: 'الأسئلة', icon: HelpCircle },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setEditTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                        editTab === tab.id ? "bg-primary text-primary-foreground shadow-md" : "bg-card border hover:bg-accent"
                      )}
                    >
                      <tab.icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSaveSession} className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {editTab === 'basic' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <FileText size={16} className="text-primary" />
                          {t('session_title') || 'عنوان الدرس'}
                        </label>
                        <input 
                          type="text" 
                          value={editingSession.title}
                          onChange={(e) => setEditingSession({...editingSession, title: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <Target size={16} className="text-primary" />
                          {t('objectives') || 'أهداف الدرس (هدف في كل سطر)'}
                        </label>
                        <textarea 
                          value={editingSession.objectives}
                          onChange={(e) => setEditingSession({...editingSession, objectives: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium min-h-[150px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editTab === 'content' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <Globe size={16} className="text-blue-600" />
                          {t('web_url') || 'رابط صفحة ويب'}
                        </label>
                        <input 
                          type="url" 
                          value={editingSession.webUrl}
                          onChange={(e) => setEditingSession({...editingSession, webUrl: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <FileCode size={16} className="text-slate-600" />
                          {t('embed_code') || 'كود HTML مدمج'}
                        </label>
                        <textarea 
                          value={editingSession.code}
                          onChange={(e) => setEditingSession({...editingSession, code: e.target.value})}
                          placeholder="<html>...</html>"
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-mono text-xs min-h-[100px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <Video size={16} className="text-purple-500" />
                          {t('video_url') || 'رابط الفيديو (YouTube Embed)'}
                        </label>
                        <input 
                          type="url" 
                          value={editingSession.videoUrl}
                          onChange={(e) => setEditingSession({...editingSession, videoUrl: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <FileText size={16} className="text-blue-500" />
                          {t('word_url') || 'رابط Word'}
                        </label>
                        <input 
                          type="url" 
                          value={editingSession.wordUrl}
                          onChange={(e) => setEditingSession({...editingSession, wordUrl: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <FileCode size={16} className="text-orange-500" />
                          {t('ppt_url') || 'رابط PPT'}
                        </label>
                        <input 
                          type="url" 
                          value={editingSession.pptUrl}
                          onChange={(e) => setEditingSession({...editingSession, pptUrl: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <FileText size={16} className="text-red-500" />
                          {t('pdf_url') || 'رابط PDF'}
                        </label>
                        <input 
                          type="url" 
                          value={editingSession.pdfUrl}
                          onChange={(e) => setEditingSession({...editingSession, pdfUrl: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editTab === 'activities' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-muted-foreground uppercase">قائمة الأنشطة</h4>
                      <button 
                        type="button"
                        onClick={() => setEditingSession({
                          ...editingSession,
                          activities: [...editingSession.activities, { 
                            id: Date.now().toString(), 
                            title: '', 
                            description: '',
                            type: 'individual',
                            startTime: '',
                            endTime: '',
                            imageUrl: '',
                            fileUrl: ''
                          }]
                        })}
                        className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                      >
                        <Plus size={14} />
                        إضافة نشاط جديد
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {editingSession.activities.map((act, idx) => (
                        <div key={act.id} className="p-4 border rounded-xl space-y-3 relative group">
                          <button 
                            type="button"
                            onClick={() => setEditingSession({
                              ...editingSession,
                              activities: editingSession.activities.filter((_, i) => i !== idx)
                            })}
                            className="absolute top-2 left-2 p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                          <input 
                            type="text"
                            value={act.title}
                            onChange={(e) => {
                              const newActs = [...editingSession.activities];
                              newActs[idx].title = e.target.value;
                              setEditingSession({...editingSession, activities: newActs});
                            }}
                            className="w-full bg-muted border-none rounded-lg px-3 py-2 text-sm font-bold"
                            placeholder="عنوان النشاط..."
                          />
                          <textarea 
                            value={act.description}
                            onChange={(e) => {
                              const newActs = [...editingSession.activities];
                              newActs[idx].description = e.target.value;
                              setEditingSession({...editingSession, activities: newActs});
                            }}
                            className="w-full bg-muted border-none rounded-lg px-3 py-2 text-xs min-h-[60px]"
                            placeholder="وصف النشاط..."
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('activity_type')}</label>
                              <select
                                value={act.type || 'individual'}
                                onChange={(e) => {
                                  const newActs = [...editingSession.activities];
                                  newActs[idx].type = e.target.value;
                                  setEditingSession({...editingSession, activities: newActs});
                                }}
                                className="w-full bg-muted border-none rounded-lg px-3 py-2 text-sm"
                              >
                                <option value="individual">{t('individual')}</option>
                                <option value="group">{t('group')}</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('start_time')}</label>
                                <input 
                                  type="time"
                                  value={act.startTime || ''}
                                  onChange={(e) => {
                                    const newActs = [...editingSession.activities];
                                    newActs[idx].startTime = e.target.value;
                                    setEditingSession({...editingSession, activities: newActs});
                                  }}
                                  className="w-full bg-muted border-none rounded-lg px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('end_time')}</label>
                                <input 
                                  type="time"
                                  value={act.endTime || ''}
                                  onChange={(e) => {
                                    const newActs = [...editingSession.activities];
                                    newActs[idx].endTime = e.target.value;
                                    setEditingSession({...editingSession, activities: newActs});
                                  }}
                                  className="w-full bg-muted border-none rounded-lg px-3 py-2 text-sm"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('activity_image')}</label>
                              <div className="relative">
                                <ImageIcon className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                <input 
                                  type="url"
                                  value={act.imageUrl || ''}
                                  onChange={(e) => {
                                    const newActs = [...editingSession.activities];
                                    newActs[idx].imageUrl = e.target.value;
                                    setEditingSession({...editingSession, activities: newActs});
                                  }}
                                  className="w-full bg-muted border-none rounded-lg ps-9 pe-3 py-2 text-sm"
                                  placeholder="https://..."
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('activity_file')}</label>
                              <div className="relative">
                                <Download className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                <input 
                                  type="url"
                                  value={act.fileUrl || ''}
                                  onChange={(e) => {
                                    const newActs = [...editingSession.activities];
                                    newActs[idx].fileUrl = e.target.value;
                                    setEditingSession({...editingSession, activities: newActs});
                                  }}
                                  className="w-full bg-muted border-none rounded-lg ps-9 pe-3 py-2 text-sm"
                                  placeholder="https://..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editTab === 'evaluation' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-muted-foreground uppercase">الأسئلة والتقييم</h4>
                      <button 
                        type="button"
                        onClick={() => setEditingSession({
                          ...editingSession,
                          evaluation: [...editingSession.evaluation, {
                            id: Date.now(),
                            question: '',
                            options: [
                              { id: 'a', text: '' },
                              { id: 'b', text: '' },
                              { id: 'c', text: '' },
                            ],
                            correctId: 'b'
                          }]
                        })}
                        className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                      >
                        <Plus size={14} />
                        إضافة سؤال جديد
                      </button>
                    </div>
                    
                    <div className="space-y-8">
                      {editingSession.evaluation.map((q, qIdx) => (
                        <div key={q.id} className="p-4 border rounded-xl space-y-4 relative group bg-muted/10">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-primary uppercase">السؤال {qIdx + 1}</span>
                            <button 
                              type="button"
                              onClick={() => setEditingSession({
                                ...editingSession,
                                evaluation: editingSession.evaluation.filter((_, i) => i !== qIdx)
                              })}
                              className="p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          <input 
                            type="text"
                            value={q.question}
                            onChange={(e) => {
                              const newEval = [...editingSession.evaluation];
                              newEval[qIdx].question = e.target.value;
                              setEditingSession({...editingSession, evaluation: newEval});
                            }}
                            className="w-full bg-card border rounded-lg px-3 py-2 text-sm font-bold"
                            placeholder="نص السؤال..."
                          />
                          
                          <div className="space-y-2">
                            {q.options.map((opt: any, oIdx: number) => (
                              <div key={opt.id || oIdx} className="flex items-center gap-2">
                                <input 
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  checked={q.correctId === opt.id}
                                  onChange={() => {
                                    const newEval = [...editingSession.evaluation];
                                    newEval[qIdx] = { ...newEval[qIdx], correctId: opt.id };
                                    setEditingSession({...editingSession, evaluation: newEval});
                                  }}
                                  className="accent-primary"
                                />
                                <input 
                                  type="text"
                                  value={opt.text || ''}
                                  onChange={(e) => {
                                    const newEval = [...editingSession.evaluation];
                                    const newOptions = [...newEval[qIdx].options];
                                    newOptions[oIdx] = { ...newOptions[oIdx], text: e.target.value };
                                    newEval[qIdx] = { ...newEval[qIdx], options: newOptions };
                                    setEditingSession({...editingSession, evaluation: newEval});
                                  }}
                                  className={cn(
                                    "flex-1 bg-card border rounded-lg px-3 py-2 text-xs",
                                    q.correctId === opt.id ? "border-green-500/50 bg-green-500/5" : ""
                                  )}
                                  placeholder={oIdx === 1 ? "الإجابة الصحيحة..." : "إجابة خاطئة..."}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-muted transition-all"
                  >
                    {t('cancel') || 'إلغاء'}
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    <span>{t('save_changes') || 'حفظ التعديلات'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
