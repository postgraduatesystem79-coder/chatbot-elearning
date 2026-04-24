import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { 
  HelpCircle, 
  Search, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit,
  CheckCircle2,
  Clock,
  Users,
  X,
  Save,
  Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, normalizeEvaluation } from '../lib/utils';
import { toast } from 'sonner';

export function QuizManagement() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newQuiz, setNewQuiz] = useState({
    title: '',
    courseId: '',
    evaluation: [
      { id: 'q1', question: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correctId: 'a' }
    ]
  });

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  useEffect(() => {
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
      setLoading(false);
    });

    // Fetch courses for the dropdown
    getDocs(collection(db, 'courses')).then(snapshot => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(list);
    });

    return () => unsubscribe();
  }, []);

  const handleAddQuestion = () => {
    setNewQuiz({
      ...newQuiz,
      evaluation: [
        ...newQuiz.evaluation,
        { id: `q${newQuiz.evaluation.length + 1}`, question: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correctId: 'a' }
      ]
    });
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = [...newQuiz.evaluation];
    updated.splice(index, 1);
    setNewQuiz({ ...newQuiz, evaluation: updated });
  };

  const handleAddOption = (qIndex: number) => {
    const updated = [...newQuiz.evaluation];
    const question = updated[qIndex];
    const lastOpt = question.options[question.options.length - 1];
    const nextCharCode = lastOpt ? lastOpt.id.charCodeAt(0) + 1 : 97;
    const nextId = String.fromCharCode(nextCharCode);
    question.options.push({ id: nextId, text: '' });
    setNewQuiz({ ...newQuiz, evaluation: updated });
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const updated = [...newQuiz.evaluation];
    const question = updated[qIndex];
    if (question.options.length <= 2) return;
    
    const removedOptionId = question.options[optIndex].id;
    question.options.splice(optIndex, 1);
    
    // If the removed option was the correct one, set the first option as correct
    if (question.correctId === removedOptionId) {
      question.correctId = question.options[0].id;
    }
    
    setNewQuiz({ ...newQuiz, evaluation: updated });
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuiz.title || !newQuiz.courseId) {
      toast.error('يرجى إدخال عنوان الاختبار واختيار المقرر');
      return;
    }

    setIsSaving(true);
    try {
      const quizData = {
        ...newQuiz,
        evaluation: normalizeEvaluation(newQuiz.evaluation),
        lessonNumber: sessions.filter(s => s.courseId === newQuiz.courseId).length + 1,
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        content: [
          { id: 'quiz', type: 'evaluation', title: 'اختبار تقييمي', icon: 'HelpCircle', color: 'text-primary' }
        ]
      };
      await addDoc(collection(db, 'sessions'), quizData);
      toast.success('تم إضافة الاختبار بنجاح');
      setIsAddModalOpen(false);
      setNewQuiz({
        title: '',
        courseId: '',
        evaluation: [
          { id: 'q1', question: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correctId: 'a' }
        ]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvaluation = async (sessionId: string) => {
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      toast.success('تم حذف الاختبار بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessions/${sessionId}`);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('manage_quizzes')}</h2>
          <p className="text-muted-foreground mt-1">Manage lesson evaluations, quizzes, and student performance tracking.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          <span>إضافة اختبار جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
            <HelpCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">إجمالي الاختبارات</p>
            <h3 className="text-2xl font-bold">{sessions.length}</h3>
          </div>
        </div>
        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">متوسط النجاح</p>
            <h3 className="text-2xl font-bold">82%</h3>
          </div>
        </div>
        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">إجمالي المشاركات</p>
            <h3 className="text-2xl font-bold">450</h3>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">قائمة التقييمات</h3>
          <div className="relative w-64">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-muted border-none rounded-lg py-2 ps-10 pe-4 text-sm outline-none"
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-start">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">الدرس</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">عدد الأسئلة</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">الحالة</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">آخر تحديث</th>
                <th className="px-6 py-4 text-end text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <HelpCircle size={20} />
                      </div>
                      <span className="font-bold text-sm">{session.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {session.evaluation?.length || 0} أسئلة
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      session.status === 'published' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {session.status || 'published'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {session.updatedAt?.toDate ? session.updatedAt.toDate().toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => setSessionToDelete(session.id)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
              {filteredSessions.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    لم يتم العثور على تقييمات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Quiz Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-card rounded-2xl border shadow-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">إضافة اختبار جديد</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-muted rounded-full">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveQuiz} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">عنوان الاختبار</label>
                    <input
                      type="text"
                      required
                      value={newQuiz.title}
                      onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                      className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                      placeholder="مثال: اختبار الوحدة الأولى"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">المقرر الدراسي</label>
                    <select
                      required
                      value={newQuiz.courseId}
                      onChange={(e) => setNewQuiz({ ...newQuiz, courseId: e.target.value })}
                      className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                    >
                      <option value="">اختر المقرر...</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-lg">الأسئلة</h4>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="text-primary font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus size={18} />
                      <span>إضافة سؤال</span>
                    </button>
                  </div>

                  {newQuiz.evaluation.map((q, qIndex) => (
                    <div key={qIndex} className="p-6 bg-muted/30 rounded-2xl border space-y-4 relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        className="absolute top-4 left-4 text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors"
                      >
                        <Trash size={18} />
                      </button>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-bold">السؤال {qIndex + 1}</label>
                        <input
                          type="text"
                          required
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...newQuiz.evaluation];
                            updated[qIndex].question = e.target.value;
                            setNewQuiz({ ...newQuiz, evaluation: updated });
                          }}
                          className="w-full bg-card border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 transition-all"
                          placeholder="اكتب نص السؤال هنا..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2 group/opt">
                            <input
                              type="radio"
                              name={`correct-${qIndex}`}
                              checked={q.correctId === opt.id}
                              onChange={() => {
                                const updated = [...newQuiz.evaluation];
                                updated[qIndex].correctId = opt.id;
                                setNewQuiz({ ...newQuiz, evaluation: updated });
                              }}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <input
                              type="text"
                              required
                              value={opt.text}
                              onChange={(e) => {
                                const updated = [...newQuiz.evaluation];
                                updated[qIndex].options[optIndex].text = e.target.value;
                                setNewQuiz({ ...newQuiz, evaluation: updated });
                              }}
                              className="flex-1 bg-card border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                              placeholder={`الخيار ${opt.id.toUpperCase()}`}
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(qIndex, optIndex)}
                                className="p-1 text-destructive opacity-0 group-hover/opt:opacity-100 transition-opacity hover:bg-destructive/10 rounded"
                                title="حذف الاختيار"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddOption(qIndex)}
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        + إضافة خيار آخر
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Clock className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>حفظ الاختبار</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-8 text-center relative"
          >
            <button 
              onClick={() => setSessionToDelete(null)}
              className="absolute top-4 left-4 p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2">{t('confirm_delete')}</h3>
            <p className="text-muted-foreground mb-8">
              {t('delete_quiz_warning') || 'Are you sure you want to delete this quiz? This action cannot be undone.'}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setSessionToDelete(null)}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-all"
              >
                {t('cancel')}
              </button>
              <button
                onClick={async () => {
                  if (sessionToDelete) {
                    await handleDeleteEvaluation(sessionToDelete);
                    setSessionToDelete(null);
                  }
                }}
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20"
              >
                {t('delete')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

