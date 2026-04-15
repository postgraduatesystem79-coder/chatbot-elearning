import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { db, handleFirestoreError, OperationType, createSecondaryAuth } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  addDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { 
  Users, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Plus,
  MoreVertical,
  GraduationCap,
  FileText,
  HelpCircle,
  ArrowUpRight,
  Search,
  Edit,
  Video,
  FileCode,
  FileAudio,
  Target,
  X,
  ClipboardList,
  Trash2,
  UserPlus,
  UserCheck,
  Mail,
  Shield,
  User,
  ArrowDown,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Download,
  Globe,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn, getYouTubeEmbedUrl, normalizeEvaluation } from '../lib/utils';
import { Link } from 'react-router-dom';

export function TeacherDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardTab, setDashboardTab] = useState<'courses' | 'users' | 'analytics' | 'submissions'>('courses');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({ displayName: '', email: '', password: '', academicId: '' });
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<any>(null);
  const [gradeValue, setGradeValue] = useState<number>(100);
  const [feedbackValue, setFeedbackValue] = useState<string>('');
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<any>(null);
  const [courseFilter, setCourseFilter] = useState<string>('all');

  const [activityData, setActivityData] = useState<any[]>([]);
  const [evaluationData, setEvaluationData] = useState<any[]>([]);
  const [contentAccess, setContentAccess] = useState<any[]>([]);
  const [passRateData, setPassRateData] = useState<any[]>([]);

  // Filter students and courses based on teacher ownership
  const teacherCourses = useMemo(() => {
    return courses.filter(c => profile?.role === 'admin' || c.teacherId === profile?.uid);
  }, [courses, profile]);

  const teacherCourseIds = useMemo(() => {
    return teacherCourses.map(c => c.id);
  }, [teacherCourses]);

  // Base list of students the teacher is authorized to see
  const authorizedStudents = useMemo(() => {
    return students.filter(student => {
      // Only show students
      if (student.role !== 'student') return false;

      // Admins see everyone
      if (profile?.role === 'admin') return true;
      
      // Show students enrolled in teacher's courses
      const isEnrolled = student.enrolledCourses?.some((id: string) => teacherCourseIds.includes(id));
      
      // Also show students manually added by this teacher or assigned to them
      const isAddedByTeacher = student.teacherId === profile?.uid;
      
      // Also check if any of the student's enrolled courses belong to this teacher
      // (This is redundant with isEnrolled but good for clarity)
      const hasTeacherCourse = student.enrolledCourses?.some((courseId: string) => {
        const course = courses.find(c => c.id === courseId);
        return course?.teacherId === profile?.uid;
      });

      return isEnrolled || isAddedByTeacher || hasTeacherCourse;
    });
  }, [students, teacherCourseIds, profile, courses]);

  const filteredStudents = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return authorizedStudents.filter(student => {
      const matchesSearch = (
        (student.name || '').toLowerCase().includes(searchLower) ||
        (student.displayName || '').toLowerCase().includes(searchLower) ||
        (student.email || '').toLowerCase().includes(searchLower) ||
        (student.academicId || '').toLowerCase().includes(searchLower)
      );
      
      const matchesCourse = courseFilter === 'all' || student.enrolledCourses?.includes(courseFilter);
      
      return matchesSearch && matchesCourse;
    });
  }, [authorizedStudents, searchTerm, courseFilter]);

  useEffect(() => {
    if (authorizedStudents.length === 0) return;

    // 1. Activity & Evaluation Performance (Count students who completed each session)
    const lessons = ['1', '2', '3', '4', '5', '6', '7'];
    const colors = ['#ef4444', '#ef4444', '#ef4444', '#ef4444', '#eab308', '#22c55e', '#22c55e'];

    const actData = lessons.map((l, i) => {
      const count = authorizedStudents.filter(s => s.stats?.activityPerformance?.[`session-${l}`] > 0).length;
      return { name: l, value: count, color: colors[i] };
    }).reverse();
    setActivityData(actData);

    const evalData = lessons.map((l, i) => {
      const count = authorizedStudents.filter(s => s.stats?.evaluationPerformance?.[`session-${l}`] > 0).length;
      return { name: l, value: count, color: colors[i] };
    }).reverse();
    setEvaluationData(evalData);

    // 2. Content Access Frequency (Aggregate visits)
    const visits = { word: 0, ppt: 0, pdf: 0, video: 0, audio: 0 };
    authorizedStudents.forEach(s => {
      const v = s.stats?.contentVisits || {};
      visits.word += v.word || 0;
      visits.ppt += v.ppt || 0;
      visits.pdf += v.pdf || 0;
      visits.video += v.video || 0;
      visits.audio += v.audio || 0;
    });

    const maxVisits = Math.max(...Object.values(visits), 1);
    const access = [
      { type: 'Word', count: visits.word.toString().padStart(2, '0'), icon: FileText, color: 'bg-orange-500', progress: (visits.word / maxVisits) * 100 },
      { type: 'PPT', count: visits.ppt.toString().padStart(2, '0'), icon: FileCode, color: 'bg-orange-400', progress: (visits.ppt / maxVisits) * 100 },
      { type: 'PDF', count: visits.pdf.toString().padStart(2, '0'), icon: FileText, color: 'bg-orange-500', progress: (visits.pdf / maxVisits) * 100 },
      { type: 'Video', count: visits.video.toString().padStart(2, '0'), icon: Video, color: 'bg-orange-600', progress: (visits.video / maxVisits) * 100 },
      { type: 'Audio', count: visits.audio.toString().padStart(2, '0'), icon: FileAudio, color: 'bg-orange-500', progress: (visits.audio / maxVisits) * 100 },
    ];
    setContentAccess(access);

    // 3. Student Pass Rate (Per Course)
    const courseStats: Record<string, { pass: number, fail: number }> = {};
    submissions.forEach(s => {
      const cid = s.courseId || 'default';
      if (!courseStats[cid]) courseStats[cid] = { pass: 0, fail: 0 };
      if ((s.grade || 0) >= 50) courseStats[cid].pass++;
      else courseStats[cid].fail++;
    });

    const passRate = Object.entries(courseStats).map(([cid, stats]) => {
      const course = courses.find(c => c.id === cid);
      const total = stats.pass + stats.fail || 1;
      return {
        name: course?.title || cid,
        pass: stats.pass / total,
        fail: stats.fail / total
      };
    });
    setPassRateData(passRate.length > 0 ? passRate : [
      { name: 'مقرر أ', pass: 0.85, fail: 0.15 },
      { name: 'مقرر ب', pass: 0.92, fail: 0.08 }
    ]);

  }, [authorizedStudents, submissions, courses]);

  // Fetch students and sessions from Firestore
  const handleEnroll = async (courseId: string) => {
    if (!profile?.uid) return;
    try {
      const userRef = doc(db, 'users', profile.uid);
      const enrolledCourses = profile.enrolledCourses || [];
      if (!enrolledCourses.includes(courseId)) {
        // Update user's enrolled courses
        await updateDoc(userRef, {
          enrolledCourses: [...enrolledCourses, courseId],
          updatedAt: serverTimestamp()
        });

        // Increment course student count
        const { increment } = await import('firebase/firestore');
        const courseRef = doc(db, 'courses', courseId);
        await updateDoc(courseRef, {
          students: increment(1)
        });

        toast.success('تم التسجيل في المقرر بنجاح');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  useEffect(() => {
    if (!profile) return;

    const studentsRef = collection(db, 'users');
    let studentsQuery;
    
    if (profile.role === 'admin') {
      studentsQuery = query(studentsRef);
    } else {
      // Fetch all users and filter in-memory to be safe
      studentsQuery = query(studentsRef);
    }

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const sessionsRef = collection(db, 'sessions');
    const sessionsQuery = query(sessionsRef);
    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setSessions(sessionsList);
      
      // If we have sessions, initialize editingSession with the first one if not already set
      if (sessionsList.length > 0 && !selectedSessionId) {
        const firstSession = sessionsList[0];
        setEditingSession({
          id: firstSession.id,
          title: firstSession.title,
          videoUrl: firstSession.videoUrl || '',
          wordUrl: firstSession.wordUrl || '',
          pptUrl: firstSession.pptUrl || '',
          pdfUrl: firstSession.pdfUrl || '',
          audioUrl: firstSession.audioUrl || '',
          objectives: (firstSession.objectives || []).join('\n'),
          activities: [...(firstSession.activities || [])],
          evaluation: normalizeEvaluation(firstSession.evaluation || [])
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    const recommendationRef = doc(db, 'recommendations', 'global');
    const unsubscribeRecommendation = onSnapshot(recommendationRef, (doc) => {
      if (doc.exists()) {
        setRecommendation(doc.data().text);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'recommendations/global');
    });

    const submissionsRef = collection(db, 'submissions');
    const unsubscribeSubmissions = onSnapshot(submissionsRef, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubmissions(subs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });

    const coursesRef = collection(db, 'courses');
    const unsubscribeCourses = onSnapshot(coursesRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });

    return () => {
      unsubscribeStudents();
      unsubscribeSessions();
      unsubscribeRecommendation();
      unsubscribeSubmissions();
      unsubscribeCourses();
    };
  }, []);

  const handleGradeSubmission = async (e: FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'submissions', gradingSubmission.id), {
        grade: gradeValue,
        feedback: feedbackValue,
        status: 'graded',
        gradedAt: serverTimestamp()
      });
      setGradingSubmission(null);
      toast.success('تم رصد الدرجة بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `submissions/${gradingSubmission.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<'basic' | 'content' | 'activities' | 'evaluation'>('basic');
  const [editingSession, setEditingSession] = useState<any>({
    title: '',
    webUrl: '',
    videoUrl: '',
    wordUrl: '',
    pptUrl: '',
    pdfUrl: '',
    audioUrl: '',
    objectives: '',
    activities: [],
    evaluation: []
  });

  const handleAddSession = () => {
    setSelectedSessionId(null);
    setEditingSession({
      title: '',
      webUrl: '',
      videoUrl: '',
      wordUrl: '',
      pptUrl: '',
      pdfUrl: '',
      audioUrl: '',
      objectives: '',
      activities: [],
      evaluation: []
    });
    setEditTab('basic');
    setIsEditModalOpen(true);
  };

  const handleEditSession = (session: any) => {
    setSelectedSessionId(session.id);
    setEditingSession({
      id: session.id,
      title: session.title,
      webUrl: session.webUrl || '',
      videoUrl: session.videoUrl || '',
      wordUrl: session.wordUrl || '',
      pptUrl: session.pptUrl || '',
      pdfUrl: session.pdfUrl || '',
      audioUrl: session.audioUrl || '',
      objectives: (session.objectives || []).join('\n'),
      activities: [...(session.activities || [])],
      evaluation: normalizeEvaluation(session.evaluation || [])
    });
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
      const sessionId = editingSession.id || 'session-1';
      const newObjectives = editingSession.objectives.split('\n').filter((o: string) => o.trim() !== '');
      
      const updatedData = {
        title: editingSession.title,
        webUrl: editingSession.webUrl,
        videoUrl: getYouTubeEmbedUrl(editingSession.videoUrl),
        wordUrl: editingSession.wordUrl,
        pptUrl: editingSession.pptUrl,
        pdfUrl: editingSession.pdfUrl,
        audioUrl: editingSession.audioUrl,
        objectives: newObjectives,
        activities: Array.isArray(editingSession.activities) ? editingSession.activities : [],
        evaluation: (Array.isArray(editingSession.evaluation) ? editingSession.evaluation : []).map((q: any) => {
          // Ensure each question has a correctId that exists in its options
          const hasCorrectId = q.options.some((opt: any) => opt.id === q.correctId);
          return {
            ...q,
            correctId: hasCorrectId ? q.correctId : (q.options[0]?.id || '')
          };
        }),
        updatedAt: serverTimestamp(),
        // Update content array if it exists
        content: [
          { id: 'web', type: 'web', title: 'صفحة ويب', icon: 'Globe', color: 'text-blue-600', url: editingSession.webUrl },
          { id: 'video', type: 'video', title: 'فيديو تعليمي', icon: 'Video', color: 'text-purple-500', url: getYouTubeEmbedUrl(editingSession.videoUrl) },
          { id: 'pdf', type: 'pdf', title: 'ملف PDF', icon: 'FileText', color: 'text-red-500', url: editingSession.pdfUrl },
          { id: 'ppt', type: 'ppt', title: 'عرض تقديمي (PPT)', icon: 'Presentation', color: 'text-orange-500', url: editingSession.pptUrl },
          { id: 'word', type: 'word', title: 'مستند نصي (Word)', icon: 'FileText', color: 'text-blue-500', url: editingSession.wordUrl },
          { id: 'audio', type: 'audio', title: 'تسجيل صوتي', icon: 'FileAudio', color: 'text-green-500', url: editingSession.audioUrl },
        ].filter(item => item.url)
      };

      await setDoc(doc(db, 'sessions', sessionId), updatedData, { merge: true });
      toast.success('تم حفظ التعديلات بنجاح');
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${editingSession.id || 'session-1'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStudent = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Create Auth user using secondary instance to avoid signing out the teacher
      const secondaryAuth = createSecondaryAuth();
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStudent.email, newStudent.password);
      const user = userCredential.user;

      // Update profile in secondary instance
      await updateProfile(user, { displayName: newStudent.displayName });

      // Sign out from secondary instance to clean up
      await signOut(secondaryAuth);

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: newStudent.displayName,
        email: newStudent.email,
        academicId: newStudent.academicId,
        role: 'student',
        teacherId: profile?.uid,
        progress: 0,
        lastActive: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        stats: {
          hoursSpent: 0,
          coursesCompleted: 0,
          totalPoints: 0
        }
      });

      setIsAddStudentModalOpen(false);
      setNewStudent({ displayName: '', email: '', password: '', academicId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setIsSaving(false);
    }
  };


  const stats = [
    { label: t('total_students') || 'Total Students', value: authorizedStudents.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: t('active_courses') || 'Active Courses', value: teacherCourses.length, icon: BookOpen, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: t('avg_score') || 'Avg. Score', value: submissions.length > 0 ? `${Math.round(submissions.reduce((acc, s) => acc + (s.grade || 0), 0) / submissions.length)}%` : '0%', icon: TrendingUp, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: t('pending_grading') || 'Pending Grading', value: submissions.filter(s => s.status === 'pending').length, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  // Calculate dynamic performance data
  const studentPerformance = teacherCourses.map(course => {
    const courseSubmissions = submissions.filter(s => {
      const session = sessions.find(sess => sess.id === s.sessionId);
      return session?.courseId === course.id || s.courseId === course.id;
    });
    
    const pass = courseSubmissions.filter(s => (s.grade || 0) >= 50).length;
    const fail = courseSubmissions.length - pass;
    
    return {
      name: course.title,
      pass: courseSubmissions.length > 0 ? (pass / courseSubmissions.length) * 100 : 80, // Fallback to mock if no data
      fail: courseSubmissions.length > 0 ? (fail / courseSubmissions.length) * 100 : 20
    };
  }).slice(0, 4);

  const quizDifficulty = [
    { name: 'Easy', value: submissions.filter(s => (s.grade || 0) >= 80).length || 45, color: '#22c55e' },
    { name: 'Medium', value: submissions.filter(s => (s.grade || 0) >= 50 && (s.grade || 0) < 80).length || 35, color: '#eab308' },
    { name: 'Hard', value: submissions.filter(s => (s.grade || 0) < 50).length || 20, color: '#ef4444' },
  ];

  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isDeleteCourseModalOpen, setIsDeleteCourseModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [addCourseTab, setAddCourseTab] = useState<'basic' | 'image'>('basic');
  const [isEditRecommendationModalOpen, setIsEditRecommendationModalOpen] = useState(false);
  const [recommendation, setRecommendation] = useState<string>("الطالب حسن لوحظ أن أداؤه قد تعثر فى تقييم الدرس الثالث، ساعده فى تحديد هدفه وتنفيذه.");
  const [newRecommendationText, setNewRecommendationText] = useState("");
  const [selectedStudentForRecommendation, setSelectedStudentForRecommendation] = useState<any>(null);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    category: 'Programming',
    imageUrl: '',
    duration: '45',
    courseCode: '',
    startDate: '',
  });

  const handleCreateCourse = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
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
      setIsAddCourseModalOpen(false);
      setNewCourse({
        title: '',
        description: '',
        category: 'Programming',
        imageUrl: '',
        duration: '45',
        courseCode: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'courses');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    setCourseToDelete(courseId);
    setIsDeleteCourseModalOpen(true);
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'courses', courseToDelete));
      toast.success('تم حذف المقرر بنجاح');
      setIsDeleteCourseModalOpen(false);
      setCourseToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${courseToDelete}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStudentActivation = async (student: any) => {
    const newStatus = student.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', student.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(newStatus === 'active' ? 'تم تفعيل الطالب بنجاح' : 'تم إلغاء تفعيل الطالب');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${student.id}`);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!studentToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', studentId));
      toast.success('تم حذف الطالب بنجاح');
      setStudentToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${studentId}`);
    }
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `submissions/${submissionId}`);
    }
  };

  const handleTogglePublish = async (session: any) => {
    const newStatus = session.status === 'published' ? 'draft' : 'published';
    try {
      await updateDoc(doc(db, 'sessions', session.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${session.id}`);
    }
  };

  const handleSaveRecommendation = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docId = selectedStudentForRecommendation ? selectedStudentForRecommendation.id : 'global';
      await setDoc(doc(db, 'recommendations', docId), {
        text: newRecommendationText,
        updatedAt: serverTimestamp(),
        teacherId: profile?.uid,
        studentId: selectedStudentForRecommendation ? selectedStudentForRecommendation.id : null
      });
      setIsEditRecommendationModalOpen(false);
      setSelectedStudentForRecommendation(null);
      toast.success('تم حفظ التوجيه بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'recommendations');
    } finally {
      setIsSaving(false);
    }
  };

  const openRecommendationModal = (student: any = null) => {
    setSelectedStudentForRecommendation(student);
    setNewRecommendationText(student ? "" : recommendation);
    setIsEditRecommendationModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('teacher_dashboard') || 'Teacher Dashboard'}</h2>
          <p className="text-muted-foreground mt-1">{t('teacher_subtitle') || 'Manage your courses and track student performance.'}</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              window.location.reload();
            }}
            className="p-3 rounded-xl border hover:bg-muted transition-all"
            title={t('refresh') || 'تحديث البيانات'}
          >
            <RefreshCw size={20} />
          </button>
          <button 
            onClick={() => setIsAddCourseModalOpen(true)}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            <span>{t('create_course') || 'إنشاء مقرر جديد'}</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card p-6 rounded-xl border shadow-sm flex items-center gap-4"
          >
            <div className={cn("p-3 rounded-lg", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pass Rate Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-card p-6 rounded-xl border shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">{t('student_pass_rate') || 'Student Pass Rate by Course'}</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentPerformance} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="pass" fill="#22c55e" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="fail" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Quiz Difficulty Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-card p-6 rounded-xl border shadow-sm"
        >
          <h3 className="font-bold text-lg mb-6">{t('quiz_difficulty') || 'Quiz Difficulty Analysis'}</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={quizDifficulty}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {quizDifficulty.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {quizDifficulty.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Tabs for Dashboard Sections */}
      <div className="flex items-center gap-4 border-b pb-1">
        <button
          onClick={() => setDashboardTab('courses')}
          className={cn(
            "pb-3 px-4 text-sm font-bold transition-all relative",
            dashboardTab === 'courses' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={18} />
            <span>{t('my_courses') || 'الدورات التدريبية'}</span>
          </div>
          {dashboardTab === 'courses' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setDashboardTab('users')}
          className={cn(
            "pb-3 px-4 text-sm font-bold transition-all relative",
            dashboardTab === 'users' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Users size={18} />
            <span>{t('user_management') || 'إدارة الطلاب'}</span>
          </div>
          {dashboardTab === 'users' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setDashboardTab('submissions')}
          className={cn(
            "pb-3 px-4 text-sm font-bold transition-all relative",
            dashboardTab === 'submissions' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <ClipboardList size={18} />
            <span>{t('submissions') || 'تسليمات الطلاب'}</span>
          </div>
          {dashboardTab === 'submissions' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {dashboardTab === 'courses' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-lg">{t('my_courses')}</h3>
            </div>
          </div>
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-start">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('course_name') || 'Course Name'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('course_code') || 'Course Code'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('students') || 'Students'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('avg_progress') || 'Avg. Progress'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('status') || 'Status'}</th>
                  <th className="px-6 py-4 text-end text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teacherCourses.map((course: any) => (
                  <tr key={course.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <BookOpen size={20} />
                        </div>
                        <span className="font-bold text-sm">{course.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded border">
                        {course.courseCode || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{course.students || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${course.progress || 0}%` }}></div>
                        </div>
                        <span className="text-xs font-bold">{course.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        (course.status || 'published') === 'published' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                      )}>
                        {t(course.status || 'published')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setCourseFilter(course.id);
                            setDashboardTab('users');
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                          title={t('view_students') || 'عرض الطلاب'}
                        >
                          <Users size={16} />
                          <span>{t('students') || 'الطلاب'}</span>
                        </button>
                        <button 
                          onClick={() => handleTogglePublish(course)}
                          className={cn(
                            "p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold",
                            course.status === 'published' ? "text-yellow-600 hover:bg-yellow-50" : "text-green-600 hover:bg-green-50"
                          )}
                          title={course.status === 'published' ? t('unpublish') : t('publish')}
                        >
                          {course.status === 'published' ? <EyeOff size={16} /> : <Eye size={16} />}
                          <span>{course.status === 'published' ? t('unpublish') : t('publish')}</span>
                        </button>
                        <button 
                          onClick={() => handleEditSession(course)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                          title={t('edit_session_content') || 'Edit Session Content'}
                        >
                          <Edit size={16} />
                          <span>{t('edit_content') || 'تعديل المحتوى'}</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteCourse(course.id)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {teacherCourses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                      {t('no_courses_found') || 'لا توجد مقررات حالياً. قم بإنشاء أول مقرر لك للبدء.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : dashboardTab === 'users' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t('student_list') || 'قائمة الطلاب'}</h3>
            <div className="flex items-center gap-4">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="bg-muted border-none rounded-lg py-2 px-4 text-sm outline-none focus:ring-2 ring-primary/20"
              >
                <option value="all">{t('all_courses') || 'جميع المقررات'}</option>
                {teacherCourses.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <div className="relative w-64">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('search_students') || 'البحث عن طالب...'}
                  className="w-full bg-muted border-none rounded-lg py-2 ps-10 pe-4 text-sm outline-none"
                />
              </div>
              <button 
                onClick={() => setIsAddStudentModalOpen(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-primary/90 transition-all text-sm"
              >
                <UserPlus size={18} />
                <span>{t('add_student') || 'إضافة طالب'}</span>
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-start">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('student_name') || 'اسم الطالب'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('academic_id') || 'الرقم الأكاديمي'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('enrolled_courses') || 'المقررات المسجلة'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('email') || 'البريد الإلكتروني'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('progress') || 'التقدم'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('last_active') || 'آخر ظهور'}</th>
                  <th className="px-6 py-4 text-end text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('actions') || 'إجراءات'}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {student.name ? student.name.charAt(0) : (student.displayName ? student.displayName.charAt(0) : (student.email ? student.email.charAt(0) : '?'))}
                        </div>
                        <span className="font-bold text-sm">{student.name || student.displayName || student.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{student.academicId}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {student.enrolledCourses?.map((courseId: string) => {
                          const course = courses.find(c => c.id === courseId);
                          return course ? (
                            <span key={courseId} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                              {course.title}
                            </span>
                          ) : null;
                        })}
                        {(!student.enrolledCourses || student.enrolledCourses.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">لا يوجد</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{student.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-24">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${student.progress}%` }}></div>
                        </div>
                        <span className="text-xs font-bold">{student.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{student.lastActive}</td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setSelectedStudentForDetails(student)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="عرض تفاصيل التفاعل"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleStudentActivation(student)}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            student.status === 'active' ? "text-green-600 hover:bg-green-50" : "text-slate-400 hover:bg-slate-50"
                          )}
                          title={student.status === 'active' ? 'إلغاء التفعيل' : 'تفعيل الطالب'}
                        >
                          <UserCheck size={16} />
                        </button>
                        <button 
                          onClick={() => openRecommendationModal(student)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="إضافة توجيه للمعلم"
                        >
                          <Target size={16} />
                        </button>
                        <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                          <Mail size={16} />
                        </button>
                        <button 
                          onClick={() => setStudentToDelete(student)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="حذف الطالب"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">
                      {t('no_students_found') || 'لم يتم العثور على طلاب ينتمون لمقرراتك حالياً'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : dashboardTab === 'submissions' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t('student_submissions') || 'تسليمات الطلاب'}</h3>
          </div>
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-start">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('student_name') || 'اسم الطالب'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('activity_title') || 'النشاط'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('status') || 'الحالة'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('grade') || 'الدرجة'}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('submitted_at') || 'تاريخ التسليم'}</th>
                  <th className="px-6 py-4 text-end text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('actions') || 'إجراءات'}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {submissions
                  .filter(s => profile?.role === 'admin' || teacherCourseIds.includes(s.courseId) || sessions.find(sess => sess.id === s.sessionId)?.teacherId === profile?.uid)
                  .map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-sm">{sub.studentName}</td>
                    <td className="px-6 py-4 text-sm">{sub.activityTitle}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        sub.status === 'graded' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                      )}>
                        {sub.status === 'graded' ? 'تم التقييم' : 'قيد الانتظار'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-sm">
                      {sub.status === 'graded' ? `${sub.grade}/100` : '--'}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleString() : '---'}
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setGradingSubmission(sub);
                            setGradeValue(sub.grade || 100);
                            setFeedbackValue(sub.feedback || '');
                          }}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="تقييم"
                        >
                          <GraduationCap size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSubmission(sub.id)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                      لا توجد تسليمات حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {/* Delete Student Confirmation Modal */}
      <AnimatePresence>
        {studentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden relative"
            >
              <button 
                onClick={() => setStudentToDelete(null)}
                className="absolute top-4 left-4 p-2 hover:bg-muted rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">تأكيد حذف الطالب</h3>
                <p className="text-muted-foreground mb-6">
                  هل أنت متأكد من رغبتك في حذف الطالب <span className="font-bold text-foreground">{studentToDelete.name || studentToDelete.email}</span>؟ 
                  سيتم حذف كافة بياناته ولا يمكن التراجع عن هذا الإجراء.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setStudentToDelete(null)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={() => handleDeleteStudent(studentToDelete.id)}
                    className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20"
                  >
                    حذف الطالب
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                          <FileCode size={16} className="text-orange-500" />
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
                      <h4 className="font-bold text-sm text-muted-foreground uppercase">قائمة الأنشطة</h4>
                      <button 
                        type="button"
                        onClick={() => setEditingSession({
                          ...editingSession,
                          activities: [...editingSession.activities, { id: Date.now().toString(), title: '', description: '' }]
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
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground">تاريخ البدء</label>
                              <input 
                                type="datetime-local"
                                value={act.startDate || ''}
                                onChange={(e) => {
                                  const newActs = [...editingSession.activities];
                                  newActs[idx].startDate = e.target.value;
                                  setEditingSession({...editingSession, activities: newActs});
                                }}
                                className="w-full bg-muted border-none rounded-lg px-3 py-2 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground">تاريخ الانتهاء</label>
                              <input 
                                type="datetime-local"
                                value={act.endDate || ''}
                                onChange={(e) => {
                                  const newActs = [...editingSession.activities];
                                  newActs[idx].endDate = e.target.value;
                                  setEditingSession({...editingSession, activities: newActs});
                                }}
                                className="w-full bg-muted border-none rounded-lg px-3 py-2 text-xs"
                              />
                            </div>
                          </div>
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
                              { id: 'd', text: '' },
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
                      {editingSession.evaluation.map((q: any, qIdx: number) => (
                        <div key={q.id} className="p-4 border rounded-xl space-y-4 relative group bg-muted/10">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-primary uppercase">السؤال {qIdx + 1}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const newEval = [...editingSession.evaluation];
                                newEval.splice(qIdx, 1);
                                setEditingSession({...editingSession, evaluation: newEval});
                              }}
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
                              newEval[qIdx] = { ...newEval[qIdx], question: e.target.value };
                              setEditingSession({...editingSession, evaluation: newEval});
                            }}
                            className="w-full bg-card border rounded-lg px-3 py-2 text-sm font-bold"
                            placeholder="نص السؤال..."
                          />
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">الخيارات</span>
                              <button 
                                type="button"
                                onClick={() => {
                                  const newEval = [...editingSession.evaluation];
                                  const nextId = String.fromCharCode(97 + newEval[qIdx].options.length);
                                  newEval[qIdx] = {
                                    ...newEval[qIdx],
                                    options: [...newEval[qIdx].options, { id: nextId, text: '' }]
                                  };
                                  setEditingSession({...editingSession, evaluation: newEval});
                                }}
                                className="text-[10px] text-primary hover:underline"
                              >
                                + إضافة خيار
                              </button>
                            </div>
                            {q.options.map((opt: any, oIdx: number) => (
                              <div key={opt.id} className="flex items-center gap-2 group/opt">
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
                                  value={opt.text}
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
                                {q.options.length > 2 && (
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newEval = [...editingSession.evaluation];
                                      const newOptions = [...newEval[qIdx].options];
                                      newOptions.splice(oIdx, 1);
                                      newEval[qIdx] = { ...newEval[qIdx], options: newOptions };
                                      // If we deleted the correct one, reset correctId
                                      if (q.correctId === opt.id) {
                                        newEval[qIdx].correctId = newOptions[0].id;
                                      }
                                      setEditingSession({...editingSession, evaluation: newEval});
                                    }}
                                    className="p-1 text-destructive opacity-0 group-hover/opt:opacity-100 transition-opacity"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
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
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>{t('save_changes') || 'حفظ التعديلات'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grading Modal */}
      <AnimatePresence>
        {gradingSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <GraduationCap size={20} />
                  </div>
                  <h3 className="font-bold text-xl">تقييم النشاط</h3>
                </div>
                <button 
                  onClick={() => setGradingSubmission(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleGradeSubmission} className="p-6 space-y-4">
                <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                  <p className="text-xs text-muted-foreground">إجابة الطالب ({gradingSubmission.studentName}):</p>
                  <p className="text-sm font-medium">{gradingSubmission.answer || 'لا توجد إجابة نصية'}</p>
                  {gradingSubmission.fileUrl && (
                    <a 
                      href={gradingSubmission.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs font-bold flex items-center gap-1 hover:underline pt-2"
                    >
                      <Download size={14} />
                      عرض الملف المرفق
                    </a>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">الدرجة (من 100)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    required
                    value={gradeValue}
                    onChange={(e) => setGradeValue(parseInt(e.target.value))}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">ملاحظات المعلم</label>
                  <textarea 
                    value={feedbackValue}
                    onChange={(e) => setFeedbackValue(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium min-h-[100px]"
                    placeholder="اكتب ملاحظاتك للطالب هنا..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setGradingSubmission(null)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-muted transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>رصد الدرجة</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <UserPlus size={20} />
                  </div>
                  <h3 className="font-bold text-xl">{t('add_new_student') || 'إضافة طالب جديد'}</h3>
                </div>
                <button 
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddStudent} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <User size={16} className="text-primary" />
                    {t('full_name') || 'الاسم الكامل'}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={newStudent.displayName}
                    onChange={(e) => setNewStudent({...newStudent, displayName: e.target.value})}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    placeholder="أدخل اسم الطالب..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Shield size={16} className="text-primary" />
                    {t('academic_id') || 'الرقم الأكاديمي'}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={newStudent.academicId}
                    onChange={(e) => setNewStudent({...newStudent, academicId: e.target.value})}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    placeholder="أدخل الرقم الأكاديمي..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Mail size={16} className="text-primary" />
                    {t('email') || 'البريد الإلكتروني'}
                  </label>
                  <input 
                    type="email" 
                    required
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    placeholder="example@university.edu"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <X size={16} className="text-primary" />
                    {t('password') || 'كلمة المرور'}
                  </label>
                  <input 
                    type="password" 
                    required
                    value={newStudent.password}
                    onChange={(e) => setNewStudent({...newStudent, password: e.target.value})}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddStudentModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-muted transition-all"
                  >
                    {t('cancel') || 'إلغاء'}
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                    <span>{t('create_account') || 'إنشاء الحساب'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Create Course Modal */}
      <AnimatePresence>
        {isAddCourseModalOpen && (
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
                    <Plus size={20} />
                  </div>
                  <h3 className="font-bold text-xl">{t('create_course')}</h3>
                </div>
                <button 
                  onClick={() => setIsAddCourseModalOpen(false)}
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
                  {t('course_basic_info')}
                </button>
                <button
                  onClick={() => setAddCourseTab('image')}
                  className={cn(
                    "flex-1 py-3 font-bold text-sm transition-all border-b-2",
                    addCourseTab === 'image' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {t('course_image_tab')}
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
                {addCourseTab === 'basic' ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('course_title')}</label>
                      <input 
                        type="text" 
                        required
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({...newCourse, title: e.target.value})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                        placeholder={t('course_title')}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('course_start_date')}</label>
                      <input 
                        type="date" 
                        required
                        value={newCourse.startDate}
                        onChange={(e) => setNewCourse({...newCourse, startDate: e.target.value})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('course_description')}</label>
                      <textarea 
                        required
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all min-h-[100px]"
                        placeholder={t('course_description')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold">{t('course_category')}</label>
                        <select 
                          value={newCourse.category}
                          onChange={(e) => setNewCourse({...newCourse, category: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                        >
                          <option value="Programming">Programming</option>
                          <option value="Design">Design</option>
                          <option value="Data">Data</option>
                          <option value="Marketing">Marketing</option>
                          <option value="بيئة التعلم الإلكترونية وروبوتات الدردشة">بيئة التعلم الإلكترونية وروبوتات الدردشة</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold">{t('course_duration')}</label>
                        <input 
                          type="number" 
                          required
                          value={newCourse.duration}
                          onChange={(e) => setNewCourse({...newCourse, duration: e.target.value})}
                          className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('course_code') || 'Course Code'}</label>
                      <input 
                        type="text" 
                        value={newCourse.courseCode}
                        onChange={(e) => setNewCourse({...newCourse, courseCode: e.target.value.toUpperCase()})}
                        className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                        placeholder={t('course_code_placeholder') || 'Enter or leave blank to generate'}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('course_image')}</label>
                      <div className="flex gap-2">
                        <input 
                          type="url" 
                          value={newCourse.imageUrl}
                          onChange={(e) => setNewCourse({...newCourse, imageUrl: e.target.value})}
                          className="flex-1 bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                          placeholder="https://..."
                        />
                        <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary p-3 rounded-xl transition-all flex items-center justify-center min-w-[48px]">
                          {uploadingField === 'courseImage' ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadingField('courseImage');
                                try {
                                  const fileRef = ref(storage, `courses/${Date.now()}_${file.name}`);
                                  const snapshot = await uploadBytes(fileRef, file);
                                  const url = await getDownloadURL(snapshot.ref);
                                  setNewCourse({ ...newCourse, imageUrl: url });
                                  toast.success('تم رفع الصورة بنجاح');
                                } catch (error) {
                                  toast.error('فشل رفع الصورة');
                                } finally {
                                  setUploadingField(null);
                                }
                              }
                            }}
                            disabled={!!uploadingField}
                          />
                        </label>
                      </div>
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
                    onClick={() => setIsAddCourseModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : t('save_course')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Recommendation Modal */}
      <AnimatePresence>
        {isEditRecommendationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600">
                    <Edit size={20} />
                  </div>
                  <h3 className="font-bold text-xl">
                    {selectedStudentForRecommendation ? `توجيه للطالب: ${selectedStudentForRecommendation.name || selectedStudentForRecommendation.email}` : 'تعديل توجيهات المعلم العامة'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsEditRecommendationModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveRecommendation} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <FileText size={16} className="text-orange-600" />
                    نص التوصية
                  </label>
                  <textarea 
                    required
                    value={newRecommendationText}
                    onChange={(e) => setNewRecommendationText(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-orange-500/20 transition-all font-medium min-h-[150px] text-right"
                    placeholder="أدخل التوصيات هنا..."
                    dir="rtl"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditRecommendationModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-muted transition-all"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>حفظ التوصية</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Student Details Modal */}
      <AnimatePresence>
        {selectedStudentForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-4xl my-8 overflow-hidden relative"
              dir="rtl"
            >
              <div className="p-6 border-b flex items-center justify-between bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {selectedStudentForDetails.name?.charAt(0) || selectedStudentForDetails.displayName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">{selectedStudentForDetails.name || selectedStudentForDetails.displayName || selectedStudentForDetails.email}</h3>
                    <p className="text-sm text-muted-foreground">تفاصيل تفاعل الطالب وأداؤه الأكاديمي</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedStudentForDetails(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-600/70 uppercase">التقدم الكلي</p>
                      <h4 className="text-xl font-bold text-blue-700">{selectedStudentForDetails.progress || 0}%</h4>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 text-green-600 rounded-xl">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-green-600/70 uppercase">الدروس المكتملة</p>
                      <h4 className="text-xl font-bold text-green-700">{selectedStudentForDetails.stats?.completedLessons?.length || 0}</h4>
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 text-orange-600 rounded-xl">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-orange-600/70 uppercase">الوقت المستغرق</p>
                      <h4 className="text-xl font-bold text-orange-700">
                        {Math.floor((Object.values(selectedStudentForDetails.stats?.sessionTiming || {}).reduce((a: any, b: any) => a + b, 0) as number) / 60)} دقيقة
                      </h4>
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
                      <Target size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-purple-600/70 uppercase">النقاط الكلية</p>
                      <h4 className="text-xl font-bold text-purple-700">{selectedStudentForDetails.stats?.totalPoints || 0}</h4>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Lesson Performance Table */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <ClipboardList size={20} className="text-primary" />
                      أداء الدروس والتقييمات
                    </h4>
                    <div className="bg-muted/30 rounded-2xl border overflow-hidden">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="px-4 py-3 text-xs font-bold">الدرس</th>
                            <th className="px-4 py-3 text-xs font-bold">النشاط</th>
                            <th className="px-4 py-3 text-xs font-bold">التقييم</th>
                            <th className="px-4 py-3 text-xs font-bold">الوقت</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[1, 2, 3, 4, 5, 6, 7].map(num => {
                            const key = `session-${num}`;
                            const actScore = selectedStudentForDetails.stats?.activityPerformance?.[key] || 0;
                            const evalScore = selectedStudentForDetails.stats?.evaluationPerformance?.[key] || 0;
                            const time = selectedStudentForDetails.stats?.sessionTiming?.[key] || 0;
                            
                            return (
                              <tr key={num} className="hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3 text-sm font-bold">الدرس {num}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    actScore >= 50 ? "bg-green-500/10 text-green-600" : (actScore > 0 ? "bg-red-500/10 text-red-600" : "bg-slate-100 text-slate-400")
                                  )}>
                                    {actScore}%
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    evalScore >= 85 ? "bg-blue-500/10 text-blue-600" : (evalScore > 0 ? "bg-red-500/10 text-red-600" : "bg-slate-100 text-slate-400")
                                  )}>
                                    {evalScore}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {Math.floor(time / 60)}:{ (time % 60).toString().padStart(2, '0') }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Content Access Chart */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <Eye size={20} className="text-primary" />
                      تفاعل المحتوى (عدد الزيارات)
                    </h4>
                    <div className="bg-muted/30 rounded-2xl border p-6 h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={[
                            { name: 'Word', value: selectedStudentForDetails.stats?.contentVisits?.word || 0, color: '#3b82f6' },
                            { name: 'PPT', value: selectedStudentForDetails.stats?.contentVisits?.ppt || 0, color: '#f97316' },
                            { name: 'PDF', value: selectedStudentForDetails.stats?.contentVisits?.pdf || 0, color: '#ef4444' },
                            { name: 'Video', value: selectedStudentForDetails.stats?.contentVisits?.video || 0, color: '#8b5cf6' },
                            { name: 'Audio', value: selectedStudentForDetails.stats?.contentVisits?.audio || 0, color: '#10b981' },
                          ]}
                          layout="vertical"
                          margin={{ left: 20, right: 20 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                          <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                            { [1,2,3,4,5].map((_, i) => <Cell key={i} fill={['#3b82f6', '#f97316', '#ef4444', '#8b5cf6', '#10b981'][i]} />) }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Recent Submissions */}
                <div className="space-y-4">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    <FileCode size={20} className="text-primary" />
                    آخر التسليمات
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {submissions
                      .filter(s => s.studentId === selectedStudentForDetails.id)
                      .sort((a, b) => (b.submittedAt?.toDate()?.getTime() || 0) - (a.submittedAt?.toDate()?.getTime() || 0))
                      .slice(0, 4)
                      .map(sub => {
                        const session = sessions.find(sess => sess.id === sub.sessionId);
                        return (
                          <div key={sub.id} className="p-4 bg-card border rounded-xl flex items-center justify-between hover:shadow-md transition-all">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/5 rounded-lg text-primary">
                                <FileText size={18} />
                              </div>
                              <div>
                                <p className="font-bold text-sm">{session?.title || 'درس'}</p>
                                <p className="text-[10px] text-muted-foreground">{sub.submittedAt?.toDate().toLocaleDateString('ar-EG')}</p>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className={cn(
                                "text-xs font-bold",
                                sub.status === 'graded' ? "text-green-600" : "text-yellow-600"
                              )}>
                                {sub.status === 'graded' ? `${sub.grade}/100` : 'قيد الانتظار'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    {submissions.filter(s => s.studentId === selectedStudentForDetails.id).length === 0 && (
                      <div className="col-span-full py-8 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        لا توجد تسليمات لهذا الطالب بعد
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-muted/30 flex justify-end">
                <button 
                  onClick={() => setSelectedStudentForDetails(null)}
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Course Confirmation Modal */}
      <AnimatePresence>
        {isDeleteCourseModalOpen && (
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
                <h3 className="text-xl font-bold">{t('confirm_delete_course') || 'حذف المقرر'}</h3>
                <p className="text-muted-foreground">
                  {t('delete_course_warning') || 'هل أنت متأكد من رغبتك في حذف هذا المقرر؟ سيتم حذف جميع البيانات المرتبطة به نهائياً.'}
                </p>
                
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => {
                      setIsDeleteCourseModalOpen(false);
                      setCourseToDelete(null);
                    }}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-accent transition-all"
                  >
                    {t('cancel') || 'إلغاء'}
                  </button>
                  <button 
                    onClick={confirmDeleteCourse}
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
