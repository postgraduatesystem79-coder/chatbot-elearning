import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  addDoc,
  increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  GraduationCap, 
  Trash2, 
  Download, 
  X, 
  Save, 
  Loader2,
  AlertCircle,
  FileText,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Activity {
  id: string;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
}

interface Session {
  id: string;
  title: string;
  lessonNumber?: number;
  activities?: Activity[];
}

export function ActivitiesManagement() {
  const { t } = useTranslation();
  const { user, isTeacher, profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Submission state
  const [submittingActivity, setSubmittingActivity] = useState<any>(null);
  const [answerText, setAnswerText] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Grading state
  const [gradingSubmission, setGradingSubmission] = useState<any>(null);
  const [viewingActivitySubmissions, setViewingActivitySubmissions] = useState<any>(null);
  const [gradeValue, setGradeValue] = useState<number>(100);
  const [feedbackValue, setFeedbackValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const sessionsRef = collection(db, 'sessions');
    const unsubscribeSessions = onSnapshot(sessionsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Session[];
      setSessions(list.sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    const subsRef = collection(db, 'submissions');
    let subsQuery = query(subsRef);
    
    // If student, only show their submissions
    if (!isTeacher && user?.uid) {
      subsQuery = query(subsRef, where('studentId', '==', user.uid));
    }

    const unsubscribeSubmissions = onSnapshot(subsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubmissions(list);
      
      // Update gradingSubmission if it's currently open to reflect real-time changes
      if (gradingSubmission) {
        const updated = list.find(s => s.id === gradingSubmission.id);
        if (updated) setGradingSubmission(updated);
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });

    return () => {
      unsubscribeSessions();
      unsubscribeSubmissions();
    };
  }, [isTeacher, user?.uid, gradingSubmission?.id]);

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingActivity || !user) return;

    if (!answerText.trim() && !uploadFile) {
      toast.error('يرجى كتابة إجابة أو إرفاق ملف');
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl = '';
      if (uploadFile) {
        const toastId = toast.info('جاري رفع الملف...', { duration: Infinity });
        try {
          console.log('Starting file upload to local server...');
          
          const fileExt = uploadFile.name.split('.').pop()?.toLowerCase() || '';
          const validExtensions = ['pdf', 'doc', 'docx'];
          if (!validExtensions.includes(fileExt)) {
            throw new Error('يرجى رفع ملفات Word أو PDF فقط.');
          }
          
          const formData = new FormData();
          formData.append('file', uploadFile);
          formData.append('userId', user.uid);
          formData.append('activityId', submittingActivity.id);

          const response = await fetch('/api/upload-submission', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'فشل الرفع عبر الخادم');
          }

          const result = await response.json();
          fileUrl = result.url;
          
          toast.dismiss(toastId);
          toast.success('تم رفع الملف بنجاح');
          console.log('File uploaded successfully, URL:', fileUrl);
        } catch (uploadError: any) {
          toast.dismiss(toastId);
          console.error('Server-side upload error details:', uploadError);
          throw new Error(`فشل رفع الملف: ${uploadError.message || 'خطأ غير معروف'}`);
        }
      }

      toast.info('جاري حفظ التسليم...');
      console.log('Saving submission to Firestore...');
      const submissionData = {
        activityId: submittingActivity.id,
        activityTitle: submittingActivity.title || 'نشاط بدون عنوان',
        sessionId: submittingActivity.sessionId || '',
        studentId: user.uid,
        studentName: profile?.displayName || profile?.name || user.displayName || user.email || 'طالب',
        answer: answerText.trim(),
        fileUrl: fileUrl,
        status: 'pending',
        submittedAt: serverTimestamp()
      };

      console.log('Submission data:', submissionData);
      const docRef = await addDoc(collection(db, 'submissions'), submissionData);
      console.log('Submission saved with ID:', docRef.id);
      
      // Update performance stats
      if (profile?.uid && submittingActivity.sessionId) {
        const session = sessions.find(s => s.id === submittingActivity.sessionId);
        const totalActivities = session?.activities?.length || 1;
        const incrementValue = Math.round(100 / totalActivities);
        
        const statsRef = doc(db, 'users', profile.uid);
        const statsKey = session?.lessonNumber ? `session-${session.lessonNumber}` : submittingActivity.sessionId;
        
        await updateDoc(statsRef, {
          [`stats.activityPerformance.${statsKey}`]: increment(incrementValue)
        }).catch(err => console.error("Error saving activity performance:", err));
      }

      toast.success('تم تسليم النشاط بنجاح');
      setSubmittingActivity(null);
      setAnswerText('');
      setUploadFile(null);
    } catch (error: any) {
      console.error('Submission error full details:', error);
      toast.error(`فشل تسليم النشاط: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    setIsSaving(true);
    try {
      const subRef = doc(db, 'submissions', gradingSubmission.id);
      await updateDoc(subRef, {
        grade: gradeValue,
        feedback: feedbackValue,
        status: 'graded',
        gradedAt: serverTimestamp(),
        gradedBy: user?.uid
      });
      
      toast.success('تم رصد الدرجة بنجاح');
      // Don't close the modal immediately if we are in the "View All" view
      if (!viewingActivitySubmissions) {
        setGradingSubmission(null);
      }
    } catch (error) {
      toast.error('فشل رصد الدرجة');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التسليم؟')) return;
    
    try {
      await deleteDoc(doc(db, 'submissions', id));
      toast.success('تم حذف التسليم بنجاح');
    } catch (error) {
      toast.error('فشل حذف التسليم');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header Info */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          <ClipboardList size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">
            {isTeacher ? 'إدارة وتقييم الأنشطة التعليمية' : 'أنشطتي التعليمية'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isTeacher 
              ? 'تابع تسليمات الطلاب وقم بتقييم أدائهم في الأنشطة المختلفة.' 
              : 'استعرض الأنشطة المطلوبة وتابع حالة تسليماتك وتقييمات المعلم.'}
          </p>
        </div>
      </div>

      {/* Activities List */}
      <div className="space-y-6">
        {sessions.map((session) => (
          <div key={session.id} className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-sm">
                {session.lessonNumber}
              </div>
              <h3 className="font-bold text-lg">{session.title}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {session.activities?.map((activity: any) => {
                const activitySubmissions = submissions.filter(s => s.activityId === activity.id);
                const userSubmission = !isTeacher ? activitySubmissions[0] : null;
                
                return (
                  <motion.div 
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-bold text-base">{activity.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{activity.description}</p>
                      </div>
                      <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                        <FileText size={18} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {activity.startDate && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                          <Clock size={12} />
                          <span>بدأ: {new Date(activity.startDate).toLocaleDateString('ar-EG')}</span>
                        </div>
                      )}
                      {activity.endDate && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                          <AlertCircle size={12} />
                          <span>ينتهي: {new Date(activity.endDate).toLocaleDateString('ar-EG')}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t flex items-center justify-between">
                      {isTeacher ? (
                        <>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">التسليمات</span>
                            <span className="text-sm font-bold">{activitySubmissions.length} طالب</span>
                          </div>
                          <button 
                            onClick={() => {
                              setViewingActivitySubmissions({
                                ...activity,
                                sessionTitle: session.title,
                                submissions: activitySubmissions
                              });
                            }}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            عرض وتقييم
                            <ExternalLink size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">الحالة</span>
                            <span className={cn(
                              "text-xs font-bold",
                              userSubmission ? (userSubmission.status === 'graded' ? "text-green-600" : "text-yellow-600") : "text-red-500"
                            )}>
                              {userSubmission 
                                ? (userSubmission.status === 'graded' ? 'تم التقييم' : 'قيد الانتظار') 
                                : 'لم يتم التسليم'}
                            </span>
                          </div>
                          {userSubmission ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">الدرجة</span>
                              <span className="text-sm font-bold text-primary">
                                {userSubmission.status === 'graded' ? `${userSubmission.grade}/100` : '--'}
                              </span>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setSubmittingActivity({ ...activity, sessionId: session.id, courseId: session.courseId })}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              تسليم النشاط
                              <ExternalLink size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Teacher: List of submissions for this activity */}
                    {isTeacher && activitySubmissions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase px-1">تسليمات الطلاب:</p>
                        <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                          {activitySubmissions.map(sub => (
                            <div key={sub.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-xs">
                              <span className="font-bold truncate max-w-[100px]">{sub.studentName}</span>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                                  sub.status === 'graded' ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
                                )}>
                                  {sub.status === 'graded' ? `${sub.grade}%` : 'انتظار'}
                                </span>
                                <button 
                                  onClick={() => {
                                    setGradingSubmission(sub);
                                    setGradeValue(sub.grade || 100);
                                    setFeedbackValue(sub.feedback || '');
                                  }}
                                  className="p-1 hover:bg-primary/10 rounded text-primary transition-colors"
                                >
                                  <GraduationCap size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {(!session.activities || session.activities.length === 0) && (
                <div className="col-span-full py-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                  لا توجد أنشطة لهذا الدرس بعد
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Student Submission Modal */}
      <AnimatePresence>
        {submittingActivity && (
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
                    <ClipboardList size={20} />
                  </div>
                  <h3 className="font-bold text-xl">تسليم النشاط</h3>
                </div>
                <button 
                  onClick={() => setSubmittingActivity(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitActivity} className="p-6 space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold">{submittingActivity.title}</h4>
                  <p className="text-xs text-muted-foreground">{submittingActivity.description}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">إجابتك</label>
                  <textarea 
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium min-h-[120px]"
                    placeholder="اكتب إجابتك هنا..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">إرفاق ملف (اختياري)</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden" 
                      id="activity-file-upload"
                    />
                    <label 
                      htmlFor="activity-file-upload"
                      className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-muted-foreground/20 rounded-xl cursor-pointer hover:bg-muted/50 transition-all"
                    >
                      {uploadFile ? (
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <CheckCircle2 size={18} />
                          <span className="text-xs truncate max-w-[200px]">{uploadFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Download size={18} />
                          <span className="text-xs font-bold">انقر لرفع ملف</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setSubmittingActivity(null)}
                    className="flex-1 py-3 rounded-xl border font-bold hover:bg-muted transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>تسليم الآن</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Submissions Modal */}
      <AnimatePresence>
        {viewingActivitySubmissions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border shadow-2xl rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">{viewingActivitySubmissions.title}</h3>
                    <p className="text-xs text-muted-foreground">{viewingActivitySubmissions.sessionTitle}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setViewingActivitySubmissions(null);
                    setGradingSubmission(null);
                  }}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Students List */}
                <div className="w-full md:w-1/3 border-l bg-muted/10 overflow-y-auto p-4 space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase px-2 mb-4">قائمة التسليمات</h4>
                  {viewingActivitySubmissions.submissions.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      لا توجد تسليمات لهذا النشاط بعد
                    </div>
                  ) : (
                    viewingActivitySubmissions.submissions.map((sub: any) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setGradingSubmission(sub);
                          setGradeValue(sub.grade || 100);
                          setFeedbackValue(sub.feedback || '');
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-xl transition-all text-right",
                          gradingSubmission?.id === sub.id 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                            : "bg-card border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                            gradingSubmission?.id === sub.id ? "bg-white/20" : "bg-primary/10 text-primary"
                          )}>
                            {sub.studentName?.charAt(0)}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-bold text-sm">{sub.studentName}</span>
                            <span className={cn(
                              "text-[10px]",
                              gradingSubmission?.id === sub.id ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {sub.status === 'graded' ? `تم التقييم: ${sub.grade}%` : 'بانتظار التقييم'}
                            </span>
                          </div>
                        </div>
                        {sub.status === 'graded' && <CheckCircle2 size={16} className={gradingSubmission?.id === sub.id ? "text-white" : "text-green-500"} />}
                      </button>
                    ))
                  )}
                </div>

                {/* Evaluation Area */}
                <div className="flex-1 overflow-y-auto p-6">
                  {gradingSubmission ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                      <div className="bg-muted/30 p-5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-primary flex items-center gap-2">
                            <GraduationCap size={18} />
                            تقييم إجابة: {gradingSubmission.studentName}
                          </h4>
                          <span className="text-[10px] text-muted-foreground">
                            تاريخ التسليم: {gradingSubmission.submittedAt?.toDate().toLocaleString('ar-EG')}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-muted-foreground uppercase">إجابة الطالب:</p>
                          <div className="bg-card border p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap">
                            {gradingSubmission.answer || 'لا توجد إجابة نصية'}
                          </div>
                        </div>

                        {gradingSubmission.fileUrl && (
                          <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/10">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <FileText size={18} />
                              </div>
                              <span className="text-xs font-bold">الملف المرفق</span>
                            </div>
                            <a 
                              href={gradingSubmission.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                            >
                              <Download size={14} />
                              تحميل وعرض
                            </a>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleGradeSubmission} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold">الدرجة المستحقة (من 100)</label>
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
                            <label className="text-sm font-bold">حالة التقييم</label>
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                              <CheckCircle2 size={18} className={gradingSubmission.status === 'graded' ? "text-green-500" : "text-muted-foreground"} />
                              <span className="text-sm font-bold">
                                {gradingSubmission.status === 'graded' ? 'تم التقييم مسبقاً' : 'بانتظار رصد الدرجة'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold">ملاحظات وتوجيهات المعلم</label>
                          <textarea 
                            value={feedbackValue}
                            onChange={(e) => setFeedbackValue(e.target.value)}
                            className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all font-medium min-h-[120px]"
                            placeholder="اكتب ملاحظاتك للطالب هنا لمساعدته على التحسن..."
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button 
                            type="submit"
                            disabled={isSaving}
                            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            <span>حفظ ورصد الدرجة</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted-foreground">
                      <div className="p-6 bg-muted rounded-full">
                        <GraduationCap size={48} />
                      </div>
                      <div>
                        <p className="font-bold text-lg">اختر طالباً للبدء في التقييم</p>
                        <p className="text-sm">سيظهر هنا محتوى إجابة الطالب وأدوات رصد الدرجات.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grading Modal (Fallback for direct access) */}
      <AnimatePresence>
        {gradingSubmission && !viewingActivitySubmissions && (
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
    </div>
  );
}
