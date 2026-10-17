import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  BookOpen, 
  Clock, 
  Users, 
  Star,
  Plus,
  ArrowRight,
  X,
  Loader2,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  UserCheck,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/useAuth';
import { toast } from 'sonner';

export function CourseList() {
  const { t } = useTranslation();
  const { isTeacher, profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addCourseTab, setAddCourseTab] = useState<'basic' | 'image'>('basic');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  // Add Lesson modal state
  const [isAddLessonModalOpen, setIsAddLessonModalOpen] = useState(false);
  const [selectedCourseForLesson, setSelectedCourseForLesson] = useState<string>('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    category: 'Programming',
    imageUrl: '',
    duration: '45',
    courseCode: '',
    startDate: '',
  });

  const handleAddLesson = async () => {
    if (!selectedCourseForLesson || isCreatingLesson) return;
    setIsCreatingLesson(true);
    let createdLessonId: string | null = null;
    const lessonTitle = newLessonTitle.trim() || `الدرس`;

    const newLessonData = {
      courseId: selectedCourseForLesson,
      title: lessonTitle,
      description: `محتوى ${lessonTitle}`,
      webUrl: '',
      videoUrl: '',
      code: '',
      robotInstructions: '',
      objectives: ['الهدف الأول للدرس', 'الهدف الثاني للدرس'],
      content: [
        { id: 'web', type: 'web', title: 'صفحة ويب', color: 'text-blue-600' },
        { id: 'video', type: 'video', title: 'فيديو تعليمي', color: 'text-purple-500' },
        { id: 'pdf', type: 'pdf', title: 'ملف PDF', color: 'text-red-500' },
      ],
      activities: [],
      evaluation: [],
      status: 'published',
    };

    // 1. Post directly to server API first (instant, guaranteed save)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLessonData)
      });
      const resData = await res.json();
      if (resData.success && resData.id) {
        createdLessonId = resData.id;
        toast.success(`تم إضافة "${lessonTitle}" بنجاح`);
      }

      // 2. Also try Firestore in background without awaiting
      addDoc(collection(db, 'sessions'), {
        ...newLessonData,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    } catch (err: any) {
      console.error('Lesson save failed:', err);
      toast.error(`تعذر إضافة الدرس: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setIsCreatingLesson(false);
      if (createdLessonId) {
        const targetCourse = selectedCourseForLesson;
        setIsAddLessonModalOpen(false);
        setSelectedCourseForLesson('');
        setNewLessonTitle('');
        navigate(`/courses/${targetCourse}/lessons/${createdLessonId}`);
      }
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!profile?.uid) return;
    setEnrollingId(courseId);
    try {
      const userRef = doc(db, 'users', profile.uid);
      const enrolledCourses = profile.enrolledCourses || [];
      if (!enrolledCourses.includes(courseId)) {
        // Update user's enrolled courses
        await updateDoc(userRef, {
          enrolledCourses: [...enrolledCourses, courseId],
          updatedAt: serverTimestamp(),
          progress: profile.progress || 0
        });

        // Increment course student count
        const courseRef = doc(db, 'courses', courseId);
        await updateDoc(courseRef, {
          students: increment(1)
        });

        toast.success('تم التسجيل في المقرر بنجاح');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setEnrollingId(null);
    }
  };

  useEffect(() => {
    // 1. Load instantly from server API
    fetch('/api/courses')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.courses && json.courses.length > 0) {
          setCourses(json.courses);
          setLoading(false);
        }
      })
      .catch(() => {});

    // 2. Also listen to Firestore live updates
    const coursesRef = collection(db, 'courses');
    const q = isTeacher 
      ? query(coursesRef)
      : query(coursesRef, where('status', '==', 'published'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) {
        setCourses(data);
      }
      setLoading(false);
    }, async () => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isTeacher]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const generatedCode = newCourse.courseCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    const currentUid = profile?.uid || auth.currentUser?.uid || 'teacher-default';
    const currentTeacherName = profile?.displayName || profile?.name || auth.currentUser?.displayName || 'م/ اسراء';

    const coursePayload = {
      ...newCourse,
      courseCode: generatedCode,
      teacherName: currentTeacherName,
      teacherId: currentUid,
      rating: 5.0,
      students: 0,
      status: 'published',
      duration: `${newCourse.duration} دقيقة`
    };

    try {
      // Send directly to server API
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCourseId ? { ...coursePayload, id: editingCourseId } : coursePayload)
      });
      const data = await res.json();
      
      const savedCourse = {
        id: data.id || editingCourseId || `course_${Date.now()}`,
        ...coursePayload
      };

      // Also try to push to Firestore in background without awaiting (fire and forget)
      if (!editingCourseId) {
        addDoc(collection(db, 'courses'), { ...coursePayload, createdAt: serverTimestamp() }).catch(() => {});
      }

      // Update local state immediately
      setCourses(prev => {
        const exists = prev.some(c => c.id === savedCourse.id);
        if (exists) return prev.map(c => c.id === savedCourse.id ? { ...c, ...savedCourse } : c);
        return [savedCourse, ...prev];
      });

      toast.success(editingCourseId ? 'تم تحديث المقرر بنجاح' : 'تم حفظ المقرر بنجاح');
      setIsModalOpen(false);
      setEditingCourseId(null);
      setNewCourse({
        title: '',
        description: '',
        category: 'Programming',
        imageUrl: '',
        duration: '45',
        courseCode: '',
        startDate: '',
      });
    } catch (err: any) {
      console.error('Error saving course:', err);
      toast.error('حدث خطأ أثناء حفظ المقرر، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (course: any) => {
    setEditingCourseId(course.id);
    setNewCourse({
      title: course.title,
      description: course.description,
      category: course.category,
      imageUrl: course.imageUrl || '',
      duration: course.duration.split(' ')[0],
      courseCode: course.courseCode || '',
      startDate: course.startDate || '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا المقرر وجميع دروسه ومحتوياته؟')) return;
    try {
      setCourses(prev => prev.filter(c => c.id !== courseId));
      await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
      deleteDoc(doc(db, 'courses', courseId)).catch(() => {});
      toast.success('تم حذف المقرر بنجاح');
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('حدث خطأ أثناء حذف المقرر');
    }
  };

  const handleTogglePublish = async (course: any) => {
    const newStatus = course.status === 'published' ? 'draft' : 'published';
    try {
      await updateDoc(doc(db, 'courses', course.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${course.id}`);
    }
  };

  // Combine mock and real courses
  const mockCourses: any[] = [];

  const allCourses = [...mockCourses, ...courses];

  const filteredCourses = allCourses.filter(course => 
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (category === 'all' || course.category === category)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <BookOpen className="text-primary w-8 h-8" />
            {t('courses')}
          </h2>
          <p className="text-muted-foreground font-medium">{isTeacher ? 'إدارة دروس المنهج التعليمي' : 'استكشف الدروس التعليمية الخاصة بالبحث'}</p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <button 
            onClick={() => {
              setEditingCourseId(null);
              setNewCourse({
                title: '',
                description: '',
                category: 'Programming',
                imageUrl: '',
                duration: '45',
                courseCode: '',
                startDate: '',
              });
              setIsModalOpen(true);
            }}
            className="bg-[#fc721e] text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-2 hover:bg-[#e65a10] transition-all shadow-[0_10px_30px_rgba(252,114,30,0.3)] transform hover:scale-105 active:scale-95"
          >
            <Plus size={24} />
            <span className="text-lg">إضافة مقرر جديد</span>
          </button>
          <button 
            onClick={() => {
              setSelectedCourseForLesson(courses.length > 0 ? courses[0].id : '');
              setNewLessonTitle('');
              setIsAddLessonModalOpen(true);
            }}
            className="bg-[#064e40] text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-2 hover:bg-[#053d33] transition-all shadow-[0_10px_30px_rgba(6,78,64,0.3)] transform hover:scale-105 active:scale-95"
          >
            <FileText size={24} />
            <span className="text-lg">إضافة درس</span>
          </button>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCourses.map((course, i) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-2xl border shadow-sm overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full"
          >
            <div className="relative aspect-video overflow-hidden">
              <img 
                src={course.imageUrl || (course.title.includes('ذكاء') ? 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800' : `https://picsum.photos/seed/course-${course.id}/600/400`)} 
                alt={course.title} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-primary uppercase tracking-wider">
                {course.category}
              </div>
            </div>
            
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Star size={14} fill="currentColor" />
                    <span className="text-xs font-bold">{course.rating}</span>
                    <span className="text-xs text-muted-foreground font-normal">({course.students})</span>
                  </div>
                  {course.courseCode && (
                    <div className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                      {course.courseCode}
                    </div>
                  )}
                </div>
              
              <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors mb-2 line-clamp-2">
                <Link to={`/courses/${course.id}`} className="flex items-center gap-2">
                   <span className="w-6 h-6 rounded bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                     #{i + 1}
                   </span>
                   {course.title}
                </Link>
              </h3>
              
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {course.description}
              </p>
              
              <div className="mt-auto pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {course.teacherName?.[0]}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{course.teacherName}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock size={14} />
                  <span className="text-xs font-medium">{course.duration}</span>
                </div>
              </div>
            </div>

            <div className="border-t bg-muted/20">
              {isTeacher ? (
                <div className="flex flex-col">
                  {/* Primary Action Button: Enter Course */}
                  <div className="flex border-b">
                    <Link 
                      to={`/courses/${course.id}`}
                      className="flex-1 bg-primary text-primary-foreground py-3 text-center text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    >
                      <span>عرض المحتوى والدروس</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                  {/* Secondary Actions: Add Lesson, Edit Course, Toggle Publish, Delete Course */}
                  <div className="flex divide-x rtl:divide-x-reverse bg-muted/40">
                    <button 
                      onClick={() => {
                        setSelectedCourseForLesson(course.id);
                        setNewLessonTitle('');
                        setIsAddLessonModalOpen(true);
                      }}
                      className="flex-1 py-2.5 px-2 text-center text-xs font-bold text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-1"
                      title="إضافة درس لهذا المقرر"
                    >
                      <Plus size={15} />
                      <span>إضافة درس</span>
                    </button>
                    <button 
                      onClick={() => openEditModal(course)}
                      className="flex-1 py-2.5 px-2 text-center text-xs font-bold text-amber-600 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-1"
                      title={t('edit') || 'تعديل المقرر'}
                    >
                      <Edit2 size={15} />
                      <span>تعديل</span>
                    </button>
                    <button 
                      onClick={() => handleTogglePublish(course)}
                      className={cn(
                        "py-2.5 px-2.5 text-center text-xs font-bold transition-all flex items-center justify-center",
                        course.status === 'published' ? "text-yellow-600 hover:bg-yellow-500 hover:text-white" : "text-green-600 hover:bg-green-500 hover:text-white"
                      )}
                      title={course.status === 'published' ? t('unpublish') : t('publish')}
                    >
                      {course.status === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button 
                      onClick={() => handleDeleteCourse(course.id)}
                      className="flex-1 py-2.5 px-2 text-center text-xs font-bold text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-1"
                      title={t('delete') || 'حذف المقرر'}
                    >
                      <Trash2 size={15} />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2">
                  {profile?.enrolledCourses?.includes(course.id) ? (
                    <Link 
                      to={`/courses/${course.id}`}
                      className="col-span-2 bg-muted/50 py-3 text-center text-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2"
                    >
                      <span>{t('view_course') || 'عرض الدرس'}</span>
                      <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <button 
                      onClick={() => handleEnroll(course.id)}
                      disabled={enrollingId === course.id}
                      className="col-span-2 bg-primary text-primary-foreground py-3 text-center text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {enrollingId === course.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>تسجيل في المقرر</span>
                          <Plus size={16} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create Course Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {editingCourseId ? <Edit2 size={20} /> : <Plus size={20} />}
                  </div>
                  <h3 className="font-bold text-xl">{editingCourseId ? 'تعديل المقرر' : 'إضافة مقرر جديد'}</h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => setAddCourseTab('basic')}
                  className={cn(
                    "flex-1 py-3 font-bold text-sm transition-all border-b-2",
                    addCourseTab === 'basic' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  البيانات الأساسية
                </button>
                <button
                  onClick={() => setAddCourseTab('image')}
                  className={cn(
                    "flex-1 py-3 font-bold text-sm transition-all border-b-2",
                    addCourseTab === 'image' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  صورة المقرر
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
                {addCourseTab === 'basic' ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">اسم المقرر</label>
                      <input 
                        type="text" 
                        required
                        value={newCourse.title}
                        onChange={(e) => {
                          const title = e.target.value;
                          setNewCourse({
                            ...newCourse, 
                            title,
                            // Auto-set AI image if title contains AI and no image is set
                            imageUrl: (title.includes('ذكاء') && !newCourse.imageUrl) ? 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800' : newCourse.imageUrl
                          });
                        }}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                        placeholder="أدخل اسم المقرر"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold">تاريخ بداية المقرر</label>
                      <input 
                        type="date" 
                        required
                        value={newCourse.startDate}
                        onChange={(e) => setNewCourse({...newCourse, startDate: e.target.value})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold">وصف مختصر للمقرر</label>
                      <textarea 
                        required
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all min-h-[100px]"
                        placeholder="أدخل وصفاً مختصراً للمقرر"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold">كود المقرر</label>
                      <input 
                        type="text" 
                        value={newCourse.courseCode}
                        onChange={(e) => setNewCourse({...newCourse, courseCode: e.target.value.toUpperCase()})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                        placeholder="أدخل كود المقرر أو اتركه فارغاً للتوليد التلقائي"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">رابط صورة المقرر</label>
                      <input 
                        type="url" 
                        value={newCourse.imageUrl}
                        onChange={(e) => setNewCourse({...newCourse, imageUrl: e.target.value})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                        placeholder="https://..."
                      />
                    </div>
                    {newCourse.imageUrl && (
                      <div className="mt-4 rounded-xl overflow-hidden border border-muted aspect-video bg-muted flex items-center justify-center">
                        <img 
                          src={newCourse.imageUrl} 
                          alt="Course Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/course/800/450';
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : (editingCourseId ? 'تحديث المقرر' : 'حفظ المقرر')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Lesson Modal */}
      <AnimatePresence>
        {isAddLessonModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#064e40]/10 rounded-lg text-[#064e40]">
                    <FileText size={20} />
                  </div>
                  <h3 className="font-bold text-xl">إضافة درس جديد</h3>
                </div>
                <button 
                  onClick={() => setIsAddLessonModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <BookOpen size={16} className="text-primary" />
                    اختر المقرر
                  </label>
                  {courses.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 text-amber-700 rounded-xl text-sm font-medium">
                      لا توجد مقررات حالياً، يُرجى إنشاء مقرر أولاً قبل إضافة درس.
                    </div>
                  ) : (
                    <select
                      value={selectedCourseForLesson}
                      onChange={(e) => setSelectedCourseForLesson(e.target.value)}
                      className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    >
                      <option value="" disabled>اختر المقرر...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <FileText size={16} className="text-primary" />
                    عنوان الدرس
                  </label>
                  <input
                    type="text"
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    placeholder="اتركه فارغاً للعنوان التلقائي (مثل: الدرس 1)"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddLessonModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleAddLesson}
                    disabled={isCreatingLesson || !selectedCourseForLesson}
                    className="flex-1 py-3 rounded-xl bg-[#064e40] text-white font-bold hover:bg-[#053d33] transition-all shadow-lg shadow-[#064e40]/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreatingLesson ? <Loader2 className="animate-spin" size={20} /> : 'إضافة الدرس'}
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
