import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Link } from 'react-router-dom';
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
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/useAuth';
import { toast } from 'sonner';

export function CourseList() {
  const { t } = useTranslation();
  const { isTeacher, profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addCourseTab, setAddCourseTab] = useState<'basic' | 'image'>('basic');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    category: 'Programming',
    imageUrl: '',
    duration: '45',
    courseCode: '',
    startDate: '',
  });

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
    const coursesRef = collection(db, 'courses');
    // If teacher, show all courses. If student, show all published courses.
    const q = isTeacher 
      ? query(coursesRef)
      : query(coursesRef, where('status', '==', 'published'));

    let hasRestoredCourse = false;

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCourses(data);
      setLoading(false);

      if (!isTeacher || !profile?.uid || hasRestoredCourse) return;

      let currentMainCourse = data.find((c: any) => 
        c.title?.includes('ريادة') || c.title?.includes('الأعمال الرقمية')
      );

      // 1. If not found, check if we need to rename an old course
      if (!currentMainCourse) {
        for (const course of data) {
          const title = (course as any).title || '';
          if (title.includes('مكملات الملابس') || title.includes('مكملات')) {
            try {
              await updateDoc(doc(db, 'courses', course.id), {
                title: 'ريادة الأعمال الرقمية',
                description: 'مقرر ريادة الأعمال الرقمية - تنمية مهارات ريادة الأعمال الرقمية والاتجاه نحو العمل الحر لطلاب الجامعة',
                category: 'ريادة أعمال',
              });
              toast.success('تم تحديث اسم المقرر إلى "ريادة الأعمال الرقمية" بنجاح');
              currentMainCourse = { ...course, title: 'ريادة الأعمال الرقمية' };
              break;
            } catch (err) {
              console.error('Migration error:', err);
            }
          }
        }
      }

      // 2. If STILL not found, create it
      if (!currentMainCourse) {
        try {
          const newCourseRef = await addDoc(collection(db, 'courses'), {
            title: 'ريادة الأعمال الرقمية',
            description: 'مقرر ريادة الأعمال الرقمية - تنمية مهارات ريادة الأعمال الرقمية والاتجاه نحو العمل الحر لطلاب الجامعة',
            category: 'ريادة أعمال',
            teacherName: profile?.name || profile?.displayName || 'Dr Heba fadl',
            teacherId: profile?.uid,
            rating: 5.0,
            students: 0,
            status: 'published',
            duration: '45 دقيقة',
            courseCode: 'DE2024',
            imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=800',
            createdAt: serverTimestamp(),
          });
          currentMainCourse = { id: newCourseRef.id, title: 'ريادة الأعمال الرقمية' };
          toast.success('تم استعادة مقرر "ريادة الأعمال الرقمية" بنجاح');
        } catch (err) {
          console.error('Course creation error:', err);
        }
      }

      // 3. Ensure lessons and students are linked to the main course
      if (currentMainCourse) {
        hasRestoredCourse = true;
        try {
          const { getDocs, collection: coll, query: q2, where: wh } = await import('firebase/firestore');
          
          // Link Orphaned Sessions
          const sessionsSnapshot = await getDocs(coll(db, 'sessions'));
          let linkedSessions = 0;
          for (const sessionDoc of sessionsSnapshot.docs) {
            const sess = sessionDoc.data();
            if (!sess.courseId || !data.some(c => c.id === sess.courseId)) {
              if (sess.courseId !== currentMainCourse.id) {
                await updateDoc(doc(db, 'sessions', sessionDoc.id), { courseId: currentMainCourse.id });
                linkedSessions++;
              }
            }
          }

          // Link All Students
          const studentsSnapshot = await getDocs(query(coll(db, 'users'), wh('role', '==', 'student')));
          let enrolledCount = 0;
          let studentsChanged = false;
          for (const userDoc of studentsSnapshot.docs) {
            const userData = userDoc.data();
            const enrolled = userData.enrolledCourses || [];
            if (!enrolled.includes(currentMainCourse.id)) {
              const validEnrollments = enrolled.filter((id: string) => data.some(c => c.id === id));
              await updateDoc(doc(db, 'users', userDoc.id), {
                enrolledCourses: [...validEnrollments, currentMainCourse.id]
              });
              studentsChanged = true;
            }
            enrolledCount++;
          }

          if (studentsChanged || (currentMainCourse as any).students !== enrolledCount) {
            await updateDoc(doc(db, 'courses', currentMainCourse.id), { students: enrolledCount });
          }

          if (linkedSessions > 0 || studentsChanged) {
            toast.success(`تم استرجاع ${linkedSessions} درس و ${enrolledCount} طالب للمقرر.`);
          }
        } catch (err) {
          console.error('Final restoration error:', err);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingCourseId) {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'courses', editingCourseId), {
          ...newCourse,
          duration: `${newCourse.duration} دقيقة`
        });
      } else {
        const generatedCode = newCourse.courseCode || Math.random().toString(36).substring(2, 8).toUpperCase();
        await addDoc(collection(db, 'courses'), {
          ...newCourse,
          courseCode: generatedCode,
          teacherName: profile?.name || 'Teacher',
          teacherId: profile?.uid,
          rating: 5.0,
          students: 0,
          status: 'published',
          createdAt: serverTimestamp(),
          duration: `${newCourse.duration} دقيقة`
        });
      }
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
    } catch (error) {
      handleFirestoreError(error, editingCourseId ? OperationType.WRITE : OperationType.CREATE, 'courses');
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
    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${courseId}`);
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
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ريادة الأعمال الرقمية</h2>
          <p className="text-muted-foreground mt-1">استكشف وادر مقرراتك التعليمية.</p>
        </div>
        {isTeacher && (
          <div className="flex gap-4">
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
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
              <span>إضافة مقرر جديد</span>
            </button>
          </div>
        )}
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
                <Link to={`/courses/${course.id}`}>
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

            <div className="grid grid-cols-2 border-t">
              {isTeacher ? (
                <Link 
                  to={`/courses/${course.id}`}
                  className={cn(
                    "bg-muted/50 py-3 text-center text-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2 border-e",
                    course.teacherId === profile?.uid ? "col-span-1" : "col-span-2"
                  )}
                >
                  <span>{t('view_course')}</span>
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  {profile?.enrolledCourses?.includes(course.id) ? (
                    <Link 
                      to={`/courses/${course.id}`}
                      className="col-span-2 bg-muted/50 py-3 text-center text-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2"
                    >
                      <span>{t('view_course')}</span>
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
                </>
              )}
              {isTeacher && course.teacherId === profile?.uid && (
                <div className="flex divide-x rtl:divide-x-reverse">
                  <button 
                    onClick={() => openEditModal(course)}
                    className="flex-1 bg-muted/50 py-3 text-center text-sm font-bold hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center"
                    title={t('edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleTogglePublish(course)}
                    className={cn(
                      "flex-1 py-3 text-center text-sm font-bold transition-all flex items-center justify-center",
                      course.status === 'published' ? "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500 hover:text-white" : "bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white"
                    )}
                    title={course.status === 'published' ? t('unpublish') : t('publish')}
                  >
                    {course.status === 'published' ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button 
                    onClick={() => handleDeleteCourse(course.id)}
                    className="flex-1 bg-muted/50 py-3 text-center text-sm font-bold hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center justify-center"
                    title={t('delete')}
                  >
                    <Trash2 size={16} />
                  </button>
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
    </div>
  );
}
