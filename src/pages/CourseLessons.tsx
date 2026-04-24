import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, getDoc, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { 
  BookOpen, 
  Plus, 
  ArrowLeft, 
  ChevronRight, 
  Clock, 
  Play,
  Loader2,
  FileText,
  Video,
  Trash2,
  Edit,
  Copy,
  Globe,
  FileAudio,
  FileVideo,
  FileCode,
  Presentation,
  AlertCircle,
  Lock,
  CheckCircle2,
  X,
  ClipboardList,
  HelpCircle,
  Target,
  Save,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/useAuth';
import { toast } from 'sonner';
import { cn, getYouTubeEmbedUrl } from '../lib/utils';

interface Lesson {
  id: string;
  title: string;
  createdAt?: { seconds: number; nanoseconds: number };
  [key: string]: any;
}

export function CourseLessons() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isTeacher, profile } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<'basic' | 'content' | 'activities' | 'evaluation'>('basic');
  const [editingSession, setEditingSession] = useState<any>({
    title: '',
    webUrl: '',
    videoUrl: '',
    wordUrl: '',
    pptUrl: '',
    pdfUrl: '',
    audioUrl: '',
    code: '',
    generalObjective: '',
    objectives: '',
    activities: [],
    evaluation: []
  });

  const handleAddLesson = async () => {
    if (!id || isCreating) return;
    setIsCreating(true);
    try {
      const lessonNumber = lessons.length + 1;
      const firstLessonEvaluation = [
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
        },
        {
          id: 'q6',
          question: 'هل يعتبر الذكاء الاصطناعي بديلاً كاملاً للمعلم في الفصل الدراسي؟',
          options: [
            { id: 'a', text: 'صح' },
            { id: 'b', text: 'خطأ' }
          ],
          correctId: 'b'
        }
      ];

      const newLesson = {
        courseId: id,
        title: `الدرس ${lessonNumber}`,
        lessonNumber: lessonNumber,
        description: `محتوى الدرس ${lessonNumber}`,
        webUrl: '',
        videoUrl: 'https://www.youtube.com/embed/y53kwdqTLNU',
        code: '',
        objectives: [
          "الهدف الأول للدرس",
          "الهدف الثاني للدرس"
        ],
        content: [
          { id: 'web', type: 'web', title: 'صفحة ويب', color: 'text-blue-600' },
          { id: 'video', type: 'video', title: 'فيديو تعليمي', color: 'text-purple-500', url: 'https://www.youtube.com/embed/y53kwdqTLNU' },
          { id: 'pdf', type: 'pdf', title: 'ملف PDF', color: 'text-red-500' },
        ],
        activities: [],
        evaluation: lessonNumber === 1 ? firstLessonEvaluation : [],
        createdAt: serverTimestamp(),
        status: 'published'
      };
      
      const docRef = await addDoc(collection(db, 'sessions'), newLesson);
      // Navigate to the newly created lesson
      navigate(`/courses/${id}/lessons/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLesson = async (e: React.MouseEvent, lessonId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLessonToDelete(lessonId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteLesson = async () => {
    if (!lessonToDelete) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'sessions', lessonToDelete));
      toast.success('تم حذف الدرس بنجاح');
      setIsDeleteModalOpen(false);
      setLessonToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessions/${lessonToDelete}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateLesson = async (e: React.MouseEvent, lesson: Lesson) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { id, createdAt, ...lessonData } = lesson;
      const duplicatedLesson = {
        ...lessonData,
        title: `${lessonData.title} (نسخة)`,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'sessions'), duplicatedLesson);
      toast.success('تم نسخ الدرس بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
    }
  };

  const handleEditLesson = (e: React.MouseEvent, lesson: Lesson) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSession({
      id: lesson.id,
      title: lesson.title,
      webUrl: lesson.webUrl || '',
      videoUrl: lesson.videoUrl || '',
      wordUrl: lesson.wordUrl || '',
      pptUrl: lesson.pptUrl || '',
      pdfUrl: lesson.pdfUrl || '',
      audioUrl: lesson.audioUrl || '',
      code: lesson.code || '',
      generalObjective: lesson.generalObjective || '',
      objectives: (lesson.objectives || []).join('\n'),
      activities: [...(lesson.activities || [])],
      evaluation: [...(lesson.evaluation || [])]
    });
    setEditTab('basic');
    setIsEditModalOpen(true);
  };

  const handleFileUpload = async (file: File, field: string) => {
    if (!file) return;
    setUploadingField(field);
    try {
      const fileRef = ref(storage, `sessions/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setEditingSession({ ...editingSession, [field]: url });
      toast.success('تم رفع الملف بنجاح');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الملف');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSaveSession = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const sessionId = editingSession.id;
      const newObjectives = editingSession.objectives.split('\n').filter((o: string) => o.trim() !== '');
      
      const updatedData = {
        title: editingSession.title,
        webUrl: editingSession.webUrl,
        videoUrl: getYouTubeEmbedUrl(editingSession.videoUrl),
        wordUrl: editingSession.wordUrl,
        pptUrl: editingSession.pptUrl,
        pdfUrl: editingSession.pdfUrl,
        audioUrl: editingSession.audioUrl,
        code: editingSession.code,
        generalObjective: editingSession.generalObjective,
        objectives: newObjectives,
        activities: editingSession.activities,
        evaluation: editingSession.evaluation.map((q: any) => {
          // Normalize true_false questions to standard format before saving
          if (q.type === 'true_false' && q.correctAnswer !== undefined && (!q.options || q.options.length === 0)) {
            return {
              ...q,
              options: [
                { id: 'a', text: 'صواب' },
                { id: 'b', text: 'خطأ' }
              ],
              correctId: q.correctAnswer === 'true' ? 'a' : 'b'
            };
          }
          return q;
        }),
        updatedAt: serverTimestamp(),
        content: [
          { id: 'web', type: 'web', title: 'صفحة ويب', icon: 'Globe', color: 'text-blue-600', url: editingSession.webUrl },
          { id: 'code', type: 'code', title: 'كود مدمج', icon: 'FileCode', color: 'text-slate-600', url: editingSession.code },
          { id: 'video', type: 'video', title: 'فيديو تعليمي', icon: 'Video', color: 'text-purple-500', url: getYouTubeEmbedUrl(editingSession.videoUrl) },
          { id: 'pdf', type: 'pdf', title: 'ملف PDF', icon: 'FileText', color: 'text-red-500', url: editingSession.pdfUrl },
          { id: 'ppt', type: 'ppt', title: 'عرض تقديمي (PPT)', icon: 'Presentation', color: 'text-orange-500', url: editingSession.pptUrl },
          { id: 'word', type: 'word', title: 'مستند نصي (Word)', icon: 'FileText', color: 'text-blue-500', url: editingSession.wordUrl },
          { id: 'audio', type: 'audio', title: 'تسجيل صوتي', icon: 'FileAudio', color: 'text-green-500', url: editingSession.audioUrl },
        ].filter(item => item.url)
      };

      await setDoc(doc(db, 'sessions', sessionId), updatedData, { merge: true });
      toast.success('تم تحديث الدرس بنجاح');
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${editingSession.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    // Fetch course details
    const courseRef = doc(db, 'courses', id);
    getDoc(courseRef).then(docSnap => {
      if (docSnap.exists()) {
        setCourse({ id: docSnap.id, ...docSnap.data() });
      }
    }).catch(error => {
      handleFirestoreError(error, OperationType.GET, `courses/${id}`);
    });

    // Fetch lessons (sessions) for this course
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('courseId', '==', id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Lesson[];
      // Sort by creation time if available
      data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setLessons(data);
      setLoading(false);

      // Migration: Update first lesson with questions if missing
      if (data.length > 0 && isTeacher) {
        const firstLesson = data.find(l => l.lessonNumber === 1);
        if (firstLesson && (!firstLesson.evaluation || firstLesson.evaluation.length === 0)) {
          const firstLessonEvaluation = [
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
            },
            {
              id: 'q6',
              question: 'هل يعتبر الذكاء الاصطناعي بديلاً كاملاً للمعلم في الفصل الدراسي؟',
              options: [
                { id: 'a', text: 'صح' },
                { id: 'b', text: 'خطأ' }
              ],
              correctId: 'b'
            }
          ];
          setDoc(doc(db, 'sessions', firstLesson.id), { evaluation: firstLessonEvaluation }, { merge: true })
            .catch(err => console.error("Migration error:", err));
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!isTeacher && profile?.status !== 'active') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-card border rounded-3xl shadow-sm">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">الحساب غير مفعل</h2>
        <p className="text-slate-600 max-w-md">
          عذراً، يجب تفعيل حسابك من قبل المعلم لتتمكن من الوصول إلى محتوى هذا المقرر والدروس.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="mt-8 bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/courses" 
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{course?.title || 'المقرر'}</h2>
            <p className="text-muted-foreground mt-1">قائمة الدروس والمحتوى التعليمي</p>
          </div>
        </div>
        
        {isTeacher && (
          <button 
            onClick={handleAddLesson}
            disabled={isCreating}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isCreating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            <span>إضافة درس جديد</span>
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {lessons.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed">
            <BookOpen size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-xl font-bold">لا توجد دروس حالياً</h3>
            <p className="text-muted-foreground mt-2">ابدأ بإضافة الدرس الأول لهذا المقرر</p>
            {isTeacher && (
              <button 
                onClick={handleAddLesson}
                className="mt-6 text-primary font-bold hover:underline flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                <span>إضافة الدرس الأول</span>
              </button>
            )}
          </div>
        ) : (
          lessons.map((lesson, index) => {
            // Check completion using both session-X key and lesson.id for compatibility
            const statsKey = lesson.lessonNumber ? `session-${lesson.lessonNumber}` : lesson.id;
            const isCompleted = 
              profile?.stats?.completedLessons?.includes(statsKey) || 
              profile?.stats?.completedLessons?.includes(lesson.id) ||
              profile?.stats?.evaluationPerformance?.[statsKey] !== undefined ||
              profile?.stats?.evaluationPerformance?.[lesson.id] !== undefined;
            
            const prevLesson = lessons[index - 1];
            const prevStatsKey = prevLesson?.lessonNumber ? `session-${prevLesson.lessonNumber}` : prevLesson?.id;
            const isPreviousCompleted = index === 0 || (prevLesson && (
              profile?.stats?.completedLessons?.includes(prevStatsKey) || 
              profile?.stats?.completedLessons?.includes(prevLesson.id) ||
              profile?.stats?.evaluationPerformance?.[prevStatsKey] !== undefined ||
              profile?.stats?.evaluationPerformance?.[prevLesson.id] !== undefined
            ));
            // A lesson is locked ONLY if it's not completed AND the previous one is not completed
            const isLocked = !isTeacher && !isPreviousCompleted && !isCompleted;

            return (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="relative">
                  <Link
                    to={isLocked ? '#' : `/courses/${id}/lessons/${lesson.id}`}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        toast.error('يجب إكمال الدرس السابق أولاً');
                      }
                    }}
                    className={cn(
                      "group flex items-center justify-between p-6 bg-card border rounded-2xl transition-all",
                      isLocked ? "opacity-60 cursor-not-allowed grayscale" : "hover:border-primary/50 hover:shadow-md",
                      isCompleted && "border-green-500/50 bg-green-500/5"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-colors",
                        isLocked ? "bg-muted text-muted-foreground" : 
                        isCompleted ? "bg-green-500 text-white" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                      )}>
                        {isCompleted ? <CheckCircle2 size={24} /> : index + 1}
                      </div>
                      <div>
                        <h4 className={cn(
                          "font-bold text-xl transition-colors",
                          !isLocked && "group-hover:text-primary",
                          isCompleted && "text-green-700"
                        )}>
                          {lesson.title}
                          {isCompleted && <span className="mr-2 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">مكتمل</span>}
                        </h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground font-medium">
                          {lesson.content?.some((c: any) => c.type === 'video') && (
                            <div className="flex items-center gap-1">
                              <Video size={14} />
                              <span>فيديو</span>
                            </div>
                          )}
                          {lesson.content?.some((c: any) => c.type === 'web') && (
                            <div className="flex items-center gap-1">
                              <Globe size={14} />
                              <span>ويب</span>
                            </div>
                          )}
                          {lesson.content?.some((c: any) => ['pdf', 'ppt', 'word'].includes(c.type)) && (
                            <div className="flex items-center gap-1">
                              <FileText size={14} />
                              <span>ملفات</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isTeacher && (
                        <div className="flex items-center gap-2 mr-4">
                          <button
                            onClick={(e) => handleEditLesson(e, lesson)}
                            className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-colors"
                            title={t('edit_session_content') || 'تعديل الدرس'}
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={(e) => handleDuplicateLesson(e, lesson)}
                            className="p-2 hover:bg-blue-500/10 rounded-lg text-blue-500 transition-colors"
                            title={t('duplicate_lesson') || 'نسخ الدرس'}
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteLesson(e, lesson.id)}
                            className="p-2 hover:bg-destructive/10 rounded-lg text-destructive transition-colors"
                            title={t('delete') || 'حذف الدرس'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                      {isLocked ? (
                        <div className="p-2 rounded-full bg-muted text-muted-foreground">
                          <Lock size={20} />
                        </div>
                      ) : (
                        <div className={cn(
                          "p-2 rounded-full transition-colors",
                          isCompleted ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                        )}>
                          <ChevronRight size={20} />
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              </motion.div>
            );
          })
        )}
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
                        <div className="flex gap-2">
                          <input 
                            type="url" 
                            value={editingSession.wordUrl}
                            onChange={(e) => setEditingSession({...editingSession, wordUrl: e.target.value})}
                            className="flex-1 bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                            placeholder="https://..."
                          />
                          <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary p-3 rounded-xl transition-all flex items-center justify-center min-w-[48px]">
                            {uploadingField === 'wordUrl' ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".doc,.docx"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'wordUrl')}
                              disabled={!!uploadingField}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <Presentation size={16} className="text-orange-500" />
                          {t('ppt_url') || 'رابط PPT'}
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="url" 
                            value={editingSession.pptUrl}
                            onChange={(e) => setEditingSession({...editingSession, pptUrl: e.target.value})}
                            className="flex-1 bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                            placeholder="https://..."
                          />
                          <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary p-3 rounded-xl transition-all flex items-center justify-center min-w-[48px]">
                            {uploadingField === 'pptUrl' ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".ppt,.pptx"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'pptUrl')}
                              disabled={!!uploadingField}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <FileText size={16} className="text-red-500" />
                          {t('pdf_url') || 'رابط PDF'}
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="url" 
                            value={editingSession.pdfUrl}
                            onChange={(e) => setEditingSession({...editingSession, pdfUrl: e.target.value})}
                            className="flex-1 bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                            placeholder="https://..."
                          />
                          <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary p-3 rounded-xl transition-all flex items-center justify-center min-w-[48px]">
                            {uploadingField === 'pdfUrl' ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".pdf"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'pdfUrl')}
                              disabled={!!uploadingField}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2">
                          <FileAudio size={16} className="text-green-500" />
                          {t('audio_url') || 'رابط ملف صوتي'}
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="url" 
                            value={editingSession.audioUrl}
                            onChange={(e) => setEditingSession({...editingSession, audioUrl: e.target.value})}
                            className="flex-1 bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                            placeholder="https://..."
                          />
                          <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary p-3 rounded-xl transition-all flex items-center justify-center min-w-[48px]">
                            {uploadingField === 'audioUrl' ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="audio/*"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'audioUrl')}
                              disabled={!!uploadingField}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editTab === 'activities' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold">الأنشطة التعليمية</h4>
                      <button 
                        type="button"
                        onClick={() => {
                          const newActivities = [...editingSession.activities, { id: Date.now().toString(), title: '', description: '', type: 'individual' }];
                          setEditingSession({...editingSession, activities: newActivities});
                        }}
                        className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                      >
                        <Plus size={14} />
                        <span>إضافة نشاط</span>
                      </button>
                    </div>
                    <div className="space-y-4">
                      {editingSession.activities.map((act: any, idx: number) => (
                        <div key={act.id} className="p-4 bg-muted/50 rounded-xl border space-y-3 relative group">
                          <button 
                            type="button"
                            onClick={() => {
                              const newActivities = editingSession.activities.filter((_: any, i: number) => i !== idx);
                              setEditingSession({...editingSession, activities: newActivities});
                            }}
                            className="absolute top-2 left-2 p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                          <input 
                            type="text" 
                            placeholder="عنوان النشاط"
                            value={act.title}
                            onChange={(e) => {
                              const newActivities = [...editingSession.activities];
                              newActivities[idx].title = e.target.value;
                              setEditingSession({...editingSession, activities: newActivities});
                            }}
                            className="w-full bg-background border-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          />
                          <textarea 
                            placeholder="وصف النشاط"
                            value={act.description}
                            onChange={(e) => {
                              const newActivities = [...editingSession.activities];
                              newActivities[idx].description = e.target.value;
                              setEditingSession({...editingSession, activities: newActivities});
                            }}
                            className="w-full bg-background border-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 min-h-[80px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editTab === 'evaluation' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold">أسئلة التقييم</h4>
                      {/* Add question dropdown */}
                      <div className="relative group/add">
                        <button
                          type="button"
                          className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                        >
                          <Plus size={14} />
                          <span>إضافة سؤال</span>
                        </button>
                        <div className="absolute left-0 top-full mt-1 bg-card border rounded-xl shadow-xl z-10 py-1 min-w-[200px] opacity-0 pointer-events-none group-hover/add:opacity-100 group-hover/add:pointer-events-auto transition-all">
                          {[
                            { type: 'mcq', label: '🔘 اختيار من متعدد' },
                            { type: 'true_false', label: '✅ صح وخطأ' },
                            { type: 'ordering', label: '🔢 ترتيب العناصر' },
                            { type: 'drag_drop', label: '🖱️ سحب وإفلات' },
                          ].map((item) => (
                            <button
                              key={item.type}
                              type="button"
                              onClick={() => {
                                const base = { id: Date.now().toString(), type: item.type, question: '' };
                                let newQ: any = base;
                                if (item.type === 'mcq') {
                                  newQ = { ...base, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }], correctId: 'a' };
                                } else if (item.type === 'true_false') {
                                  newQ = { ...base, correctAnswer: 'true' };
                                } else if (item.type === 'ordering') {
                                  newQ = { ...base, items: ['', '', '', ''] };
                                } else if (item.type === 'drag_drop') {
                                  newQ = { ...base, pairs: [{ id: 'p1', left: '', right: '' }, { id: 'p2', left: '', right: '' }] };
                                }
                                setEditingSession({ ...editingSession, evaluation: [...editingSession.evaluation, newQ] });
                              }}
                              className="w-full text-right px-4 py-2.5 text-sm hover:bg-primary/10 transition-colors font-medium"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {editingSession.evaluation.map((q: any, qIdx: number) => {
                        const qType = q.type || 'mcq';
                        const typeLabels: Record<string, string> = {
                          mcq: '🔘 اختيار من متعدد',
                          true_false: '✅ صح وخطأ',
                          ordering: '🔢 ترتيب العناصر',
                          drag_drop: '🖱️ سحب وإفلات',
                        };
                        return (
                          <div key={q.id} className="p-4 bg-muted/50 rounded-xl border-2 border-muted space-y-4 relative group">
                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => {
                                const newEval = editingSession.evaluation.filter((_: any, i: number) => i !== qIdx);
                                setEditingSession({ ...editingSession, evaluation: newEval });
                              }}
                              className="absolute top-3 left-3 p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 rounded-lg"
                            >
                              <Trash2 size={14} />
                            </button>

                            {/* Header: question number + type badge */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-muted-foreground">السؤال {qIdx + 1}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {typeLabels[qType] || qType}
                              </span>
                            </div>

                            {/* Question text */}
                            <input
                              type="text"
                              placeholder="نص السؤال..."
                              value={q.question}
                              onChange={(e) => {
                                const updated = [...editingSession.evaluation];
                                updated[qIdx].question = e.target.value;
                                setEditingSession({ ...editingSession, evaluation: updated });
                              }}
                              className="w-full bg-background border-none rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20 font-medium"
                            />

                            {/* ──── MCQ ──── */}
                            {qType === 'mcq' && (
                              <div className="space-y-2">
                                {(q.options || []).map((opt: any, oIdx: number) => (
                                  <div key={opt.id} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`correct-${q.id}`}
                                      checked={q.correctId === opt.id}
                                      onChange={() => {
                                        const updated = [...editingSession.evaluation];
                                        updated[qIdx].correctId = opt.id;
                                        setEditingSession({ ...editingSession, evaluation: updated });
                                      }}
                                      className="accent-primary w-4 h-4 flex-shrink-0"
                                    />
                                    <input
                                      type="text"
                                      placeholder={`الخيار ${opt.id.toUpperCase()}`}
                                      value={opt.text}
                                      onChange={(e) => {
                                        const updated = [...editingSession.evaluation];
                                        updated[qIdx].options[oIdx].text = e.target.value;
                                        setEditingSession({ ...editingSession, evaluation: updated });
                                      }}
                                      className={cn(
                                        'flex-1 bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 border',
                                        q.correctId === opt.id ? 'border-green-500/60 bg-green-500/5' : 'border-transparent'
                                      )}
                                    />
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editingSession.evaluation];
                                    const nextId = String.fromCharCode(97 + (updated[qIdx].options?.length || 0));
                                    updated[qIdx].options = [...(updated[qIdx].options || []), { id: nextId, text: '' }];
                                    setEditingSession({ ...editingSession, evaluation: updated });
                                  }}
                                  className="text-xs text-primary font-bold hover:underline mt-1"
                                >
                                  + إضافة خيار آخر
                                </button>
                              </div>
                            )}

                            {/* ──── TRUE / FALSE ──── */}
                            {qType === 'true_false' && (
                              <div className="flex gap-4">
                                {[{ val: 'true', label: '✅ صح' }, { val: 'false', label: '❌ خطأ' }].map((opt) => (
                                  <label
                                    key={opt.val}
                                    className={cn(
                                      'flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer font-bold text-sm transition-all',
                                      q.correctAnswer === opt.val
                                        ? 'border-green-500 bg-green-500/10 text-green-700'
                                        : 'border-muted hover:border-primary/40'
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={`tf-${q.id}`}
                                      value={opt.val}
                                      checked={q.correctAnswer === opt.val}
                                      onChange={() => {
                                        const updated = [...editingSession.evaluation];
                                        updated[qIdx].correctAnswer = opt.val;
                                        setEditingSession({ ...editingSession, evaluation: updated });
                                      }}
                                      className="hidden"
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* ──── ORDERING ──── */}
                            {qType === 'ordering' && (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">اكتب العناصر بالترتيب الصحيح (من الأول للأخير):</p>
                                {(q.items || []).map((item: string, iIdx: number) => (
                                  <div key={iIdx} className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                                      {iIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      placeholder={`العنصر ${iIdx + 1}`}
                                      value={item}
                                      onChange={(e) => {
                                        const updated = [...editingSession.evaluation];
                                        const newItems = [...(updated[qIdx].items || [])];
                                        newItems[iIdx] = e.target.value;
                                        updated[qIdx].items = newItems;
                                        setEditingSession({ ...editingSession, evaluation: updated });
                                      }}
                                      className="flex-1 bg-background border border-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...editingSession.evaluation];
                                        updated[qIdx].items = (updated[qIdx].items || []).filter((_: any, i: number) => i !== iIdx);
                                        setEditingSession({ ...editingSession, evaluation: updated });
                                      }}
                                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editingSession.evaluation];
                                    updated[qIdx].items = [...(updated[qIdx].items || []), ''];
                                    setEditingSession({ ...editingSession, evaluation: updated });
                                  }}
                                  className="text-xs text-primary font-bold hover:underline"
                                >
                                  + إضافة عنصر
                                </button>
                              </div>
                            )}

                            {/* ──── DRAG & DROP ──── */}
                            {qType === 'drag_drop' && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-muted-foreground px-1">
                                  <span>العمود الأيمن</span>
                                  <span>العمود الأيسر (المطابق)</span>
                                </div>
                                {(q.pairs || []).map((pair: any, pIdx: number) => (
                                  <div key={pair.id} className="grid grid-cols-2 gap-2 items-center">
                                    <input
                                      type="text"
                                      placeholder={`العنصر ${pIdx + 1}`}
                                      value={pair.left}
                                      onChange={(e) => {
                                        const updated = [...editingSession.evaluation];
                                        updated[qIdx].pairs[pIdx].left = e.target.value;
                                        setEditingSession({ ...editingSession, evaluation: updated });
                                      }}
                                      className="bg-background border border-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                                    />
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        placeholder={`المطابق ${pIdx + 1}`}
                                        value={pair.right}
                                        onChange={(e) => {
                                          const updated = [...editingSession.evaluation];
                                          updated[qIdx].pairs[pIdx].right = e.target.value;
                                          setEditingSession({ ...editingSession, evaluation: updated });
                                        }}
                                        className="flex-1 bg-background border border-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...editingSession.evaluation];
                                          updated[qIdx].pairs = (updated[qIdx].pairs || []).filter((_: any, i: number) => i !== pIdx);
                                          setEditingSession({ ...editingSession, evaluation: updated });
                                        }}
                                        className="p-1 text-destructive hover:bg-destructive/10 rounded"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editingSession.evaluation];
                                    const nextId = `p${(updated[qIdx].pairs?.length || 0) + 1}`;
                                    updated[qIdx].pairs = [...(updated[qIdx].pairs || []), { id: nextId, left: '', right: '' }];
                                    setEditingSession({ ...editingSession, evaluation: updated });
                                  }}
                                  className="text-xs text-primary font-bold hover:underline"
                                >
                                  + إضافة زوج
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {editingSession.evaluation.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed rounded-xl text-muted-foreground">
                          <HelpCircle size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm font-medium">لا توجد أسئلة بعد</p>
                          <p className="text-xs mt-1">اضغط على "إضافة سؤال" واختر نوع السؤال</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>

              <div className="p-6 border-t bg-muted/30 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                >
                  {t('cancel') || 'إلغاء'}
                </button>
                <button 
                  onClick={handleSaveSession}
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  <span>{t('save_changes') || 'حفظ التعديلات'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold">{t('confirm_delete_session') || 'حذف الدرس'}</h3>
                <p className="text-muted-foreground">
                  {t('delete_session_warning') || 'هل أنت متأكد من رغبتك في حذف هذا الدرس؟ لا يمكن التراجع عن هذا الإجراء.'}
                </p>
                
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setLessonToDelete(null);
                    }}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                  >
                    {t('cancel') || 'إلغاء'}
                  </button>
                  <button 
                    onClick={confirmDeleteLesson}
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : (t('delete') || 'حذف')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
