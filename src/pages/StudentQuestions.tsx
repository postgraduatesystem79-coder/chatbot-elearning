import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { 
  MessageSquare, 
  Plus, 
  Search,
  User,
  Clock,
  Send,
  CheckCircle2,
  X,
  Trash2,
  MessageCircle,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

export default function StudentQuestions() {
  const { t, i18n } = useTranslation();
  const { profile, isAdmin, isTeacher } = useAuth();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewQuestionOpen, setIsNewQuestionOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: '', content: '' });
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const questionsRef = collection(db, 'student_questions');
    const q = query(questionsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuestions(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'student_questions');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.title || !newQuestion.content) return;

    try {
      await addDoc(collection(db, 'student_questions'), {
        ...newQuestion,
        authorId: profile.uid,
        authorName: profile.displayName,
        authorRole: profile.role,
        createdAt: serverTimestamp(),
        replies: [],
        status: 'pending'
      });
      setNewQuestion({ title: '', content: '' });
      setIsNewQuestionOpen(false);
      toast.success('تم إرسال سؤالك بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'student_questions');
    }
  };

  const handleReply = async (questionId: string) => {
    const text = replyText[questionId];
    if (!text?.trim()) return;

    try {
      await updateDoc(doc(db, 'student_questions', questionId), {
        replies: arrayUnion({
          id: Date.now().toString(),
          content: text,
          authorId: profile.uid,
          authorName: profile.displayName,
          authorRole: profile.role,
          createdAt: new Date().toISOString()
        }),
        status: 'answered'
      });
      setReplyText({ ...replyText, [questionId]: '' });
      toast.success('تم إضافة الرد بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `student_questions/${questionId}`);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'student_questions', id));
      toast.success('تم حذف السؤال');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `student_questions/${id}`);
    }
  };

  const filteredQuestions = questions.filter(q => 
    q.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">أسئلة واستفسارات الطلبة</h2>
          <p className="text-muted-foreground mt-1">تواصل مباشرة مع المعلمين واطرح أسئلتك واستفساراتك.</p>
        </div>
        {!isTeacher && !isAdmin && (
          <button 
            onClick={() => setIsNewQuestionOpen(true)}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            <span>طرح سؤال جديد</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          type="text"
          placeholder="ابحث في الأسئلة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-card border rounded-xl py-3 ps-10 pe-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {filteredQuestions.map((question, i) => (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {question.authorName?.[0]}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{question.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{question.authorName}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {question.createdAt?.seconds ? formatDistanceToNow(new Date(question.createdAt.seconds * 1000), { 
                        addSuffix: true,
                        locale: i18n.language === 'ar' ? ar : enUS
                      }) : 'الآن'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  question.status === 'answered' ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  {question.status === 'answered' ? 'تم الرد' : 'قيد الانتظار'}
                </span>
                {(isAdmin || profile?.uid === question.authorId) && (
                  <button 
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <p className="text-slate-700 mb-6 whitespace-pre-wrap">{question.content}</p>

            {/* Replies */}
            <div className="space-y-4 pt-4 border-t">
              {question.replies?.map((reply: any) => (
                <div key={reply.id} className={cn(
                  "p-4 rounded-xl",
                  reply.authorRole === 'teacher' || reply.authorRole === 'admin' ? "bg-primary/5 border border-primary/10" : "bg-muted/50"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{reply.authorName}</span>
                      {(reply.authorRole === 'teacher' || reply.authorRole === 'admin') && (
                        <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md">معلم</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: i18n.language === 'ar' ? ar : enUS })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{reply.content}</p>
                </div>
              ))}

              {/* Reply Input */}
              {(isTeacher || isAdmin || profile?.uid === question.authorId) && (
                <div className="flex gap-2 mt-4">
                  <input
                    type="text"
                    placeholder="اكتب ردك هنا..."
                    value={replyText[question.id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [question.id]: e.target.value })}
                    className="flex-1 bg-muted border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                  <button 
                    onClick={() => handleReply(question.id)}
                    className="bg-primary text-primary-foreground p-2 rounded-xl hover:bg-primary/90 transition-all"
                  >
                    <Send size={18} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {filteredQuestions.length === 0 && !loading && (
          <div className="text-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed">
            <HelpCircle size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-xl font-bold">لا توجد أسئلة حالياً</h3>
            <p className="text-muted-foreground mt-2">كن أول من يطرح سؤالاً أو استفساراً.</p>
          </div>
        )}
      </div>

      {/* New Question Modal */}
      <AnimatePresence>
        {isNewQuestionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card rounded-2xl border shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold mb-6">طرح سؤال جديد</h3>
              <form onSubmit={handleCreateQuestion} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold">عنوان السؤال</label>
                  <input
                    type="text"
                    required
                    value={newQuestion.title}
                    onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                    className="w-full bg-background border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="مثال: استفسار حول الدرس الأول"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">محتوى السؤال</label>
                  <textarea
                    required
                    rows={6}
                    value={newQuestion.content}
                    onChange={(e) => setNewQuestion({ ...newQuestion, content: e.target.value })}
                    className="w-full bg-background border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                    placeholder="اشرح سؤالك بالتفصيل هنا..."
                  />
                </div>
                <div className="flex gap-4 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setIsNewQuestionOpen(false)}
                    className="px-6 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    إرسال السؤال
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
