import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { assessmentLabels, emptyConfig, emptyProgress, scaleOptions, statementResponse, validateConfig, type AssessmentStage, type JourneyConfig, type JourneyProgress, type JourneyStage } from '../lib/courseJourney';
import { toast } from 'sonner';
import { CheckCircle2, Lock, Plus, Trash2, Save } from 'lucide-react';
import { firebaseJourneyRequest } from '../lib/firebaseJourney';

interface JourneyData { config: JourneyConfig; progress: JourneyProgress; lessonIds: string[]; stage: JourneyStage; canManage: boolean }
interface JourneyContext extends JourneyData { refresh: () => Promise<void>; completeLesson: (id: string, answers?: number[]) => Promise<void> }
const Context = createContext<JourneyContext | null>(null);
export function useCourseJourney() { return useContext(Context); }
export async function journeyRequest(courseId: string, path = '', body?: unknown, method = 'POST') {
  await auth.authStateReady();
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return firebaseJourneyRequest(courseId, path, body);
  const currentUser = auth.currentUser;
  const token = await currentUser?.getIdToken();
  if (!token) throw Object.assign(new Error('يُرجى تسجيل الدخول مجددًا لفتح التقييمات'), { code: 'AUTH_REQUIRED' });
  const send = (accessToken: string) => fetch(`/api/course-journey/${encodeURIComponent(courseId)}${path}`, {
    method: body === undefined ? 'GET' : method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000)
  });
  let response = await send(token);
  if (response.status === 401 && currentUser) {
    response = await send(await currentUser.getIdToken(true));
  }
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'تعذر حفظ البيانات'), { code: response.status === 401 ? 'AUTH_REQUIRED' : result.code });
  return result;
}
export function CourseJourneyBoundary({ children }: { children: ReactNode }) {
  const { id, courseId: routeCourseId, lessonId } = useParams();
  const courseId = id || routeCourseId!;
  const { isTeacher, user, logout } = useAuth();
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState('');
  const [requiresLogin, setRequiresLogin] = useState(false);
  const refresh = async () => {
    const result = await journeyRequest(courseId);
    setData(result); setError(''); setRequiresLogin(false);
  };
  useEffect(() => {
    let active = true;
    setError(''); setRequiresLogin(false);
    journeyRequest(courseId)
      .then(result => { if (active) setData(result); })
      .catch(e => {
        console.warn("CourseJourney load warning:", e);
        if (active) {
          setError(e.message || '');
          // Keep a safe default data so lessons always display
          setData({
            config: emptyConfig(),
            progress: emptyProgress(),
            lessonIds: [],
            stage: 'ready',
            canManage: isTeacher
          });
        }
      });
    return () => { active = false; };
  }, [courseId, user?.uid, isTeacher]);

  const fallbackData: JourneyData = {
    config: emptyConfig(),
    progress: emptyProgress(),
    lessonIds: [],
    stage: 'ready',
    canManage: isTeacher
  };
  const currentData = data || fallbackData;

  const context: JourneyContext = {
    ...currentData,
    refresh,
    completeLesson: async (lessonId, answers) => {
      if (!currentData.config.enabled || isTeacher) return;
      try {
        await journeyRequest(courseId, '/complete-lesson', { lessonId, answers });
        await refresh();
      } catch (err) {
        console.warn("completeLesson warning:", err);
      }
    }
  };

  const needsPre = ['preTest', 'preScale', 'notReady'].includes(currentData.stage);
  const lessonIndex = lessonId ? currentData.lessonIds.indexOf(lessonId) : -1;
  const previousIncomplete = !!lessonId && (lessonIndex < 0 || currentData.lessonIds.slice(0, lessonIndex).some(l => !currentData.progress.completedLessonIds.includes(l)));

  return (
    <Context.Provider value={context}>
      {!isTeacher && currentData.config.enabled && (needsPre || (lessonId && previousIncomplete))
        ? <div className="space-y-6"><Link to={`/courses/${courseId}`} className="text-primary underline">العودة إلى مراحل المقرر</Link>{needsPre ? <JourneyStudentPanel courseId={courseId} /> : <p className="p-8 bg-card border rounded-xl">أكملي الدروس السابقة أولًا.</p>}</div>
        : children}
    </Context.Provider>
  );
}

export function CourseJourneyPanel({ courseId }: { courseId: string }) {
  const data = useCourseJourney();
  const { isTeacher } = useAuth();
  if (!data) return null;
  return isTeacher ? <JourneyEditor courseId={courseId} /> : data.config.enabled ? <JourneyStudentPanel courseId={courseId} /> : null;
}

function JourneyStudentPanel({ courseId }: { courseId: string }) {
  const data = useCourseJourney()!;
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [background, setBackground] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setAnswers({}); }, [data.stage]);
  const stage = data.stage;
  const assessment = ['preTest', 'preScale', 'postTest', 'postScale'].includes(stage) ? stage as AssessmentStage : null;
  const isScale = assessment?.endsWith('Scale');
  const items = isScale ? data.config.scale.statements : data.config.test.questions;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assessment || saving) return;
    if (items.some((_, i) => answers[i] === undefined)) { toast.error('أجيبي عن جميع البنود أولًا'); return; }
    setSaving(true);
    try {
      await journeyRequest(courseId, '/attempt', { stage: assessment, answers: items.map((_, i) => answers[i]), ...(assessment === 'preTest' ? { background } : {}) });
      await data.refresh(); toast.success('تم حفظ إجاباتك بنجاح');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return <section className="bg-card border rounded-2xl p-6 space-y-6" dir="rtl">
    <h2 className="text-2xl font-bold">رحلة دراسة المقرر</h2>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {(['preTest', 'preScale', 'content', 'postTest', 'postScale'] as const).map((key, i) => {
        const done = key === 'content' ? data.lessonIds.length > 0 && data.lessonIds.every(id => data.progress.completedLessonIds.includes(id)) : !!data.progress.attempts[key];
        return <div key={key} className={`p-3 rounded-xl border text-sm font-bold flex items-center gap-2 ${stage === key ? 'bg-primary text-primary-foreground' : 'bg-muted/40'}`}>
          {done ? <CheckCircle2 size={18} /> : stage === key ? <span>{i + 1}</span> : <Lock size={16} />}{key === 'content' ? 'دراسة المحتوى' : assessmentLabels[key]}
        </div>;
      })}
    </div>
    {stage === 'notReady' && <p>سيظهر الاختبار والمقياس عند إكمال المعلم إعدادهما.</p>}
    {stage === 'content' && <p className="text-muted-foreground">تم إكمال القياس القبلي. ادرسي الدروس بالترتيب؛ يظهر الاختبار والمقياس البعدي بعد إنهاء جميع الدروس. ({data.progress.completedLessonIds.filter(id => data.lessonIds.includes(id)).length} / {data.lessonIds.length})</p>}
    {assessment && <form key={assessment} onSubmit={submit} className="space-y-6">
      {assessment === 'preTest' && data.config.backgroundFields?.length && <fieldset className="p-5 border rounded-xl space-y-4"><legend className="font-bold px-2">البيانات الأولية</legend><p className="text-muted-foreground">{data.config.instructions}</p><div className="grid md:grid-cols-2 gap-4">{data.config.backgroundFields.map(field => <label key={field.id} className="space-y-2 block"><span>{field.label}</span>{field.options ? <select className="w-full border bg-background rounded-lg p-3" value={background[field.id] || ''} disabled={saving} onChange={e => setBackground(b => ({ ...b, [field.id]: e.target.value }))}><option value="">اختاري</option>{field.options.map(option => <option key={option}>{option}</option>)}</select> : <input className="w-full border bg-background rounded-lg p-3" maxLength={250} value={background[field.id] || ''} disabled={saving} onChange={e => setBackground(b => ({ ...b, [field.id]: e.target.value }))} />}</label>)}</div></fieldset>}
      <div><h3 className="text-xl font-bold">{assessmentLabels[assessment]} — {isScale ? data.config.scale.title : data.config.test.title}</h3><p className="text-muted-foreground mt-2">{isScale ? 'اختاري درجة موافقتك على كل عبارة. لا توجد إجابة صحيحة أو خاطئة.' : 'اختاري إجابة واحدة لكل سؤال. هذا القياس لا يتطلب درجة نجاح لفتح المرحلة التالية.'} تُحفظ الإجابات نهائيًا عند الإرسال.</p></div>
      {items.map((item, index) => <fieldset key={item.id} className="border rounded-xl p-5 space-y-3"><legend className="font-bold px-2">{isScale && statementResponse(data.config, index).section && <span className="block text-primary text-sm mb-2">{statementResponse(data.config, index).section!.title}</span>}{index + 1}. {item.text}</legend>
        {(isScale ? statementResponse(data.config, index).options : data.config.test.questions[index].options).map((option, value) => <label key={value} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer"><input required type="radio" name={`${assessment}-${item.id}`} value={value} checked={answers[index] === value} disabled={saving} onChange={() => setAnswers(previous => ({ ...previous, [index]: value }))} />{option}</label>)}
      </fieldset>)}
      <button disabled={saving} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold disabled:opacity-50">{saving ? 'جاري الحفظ...' : `إرسال ${assessmentLabels[assessment]}`}</button>
    </form>}
    {stage === 'complete' && <div className="space-y-4"><h3 className="font-bold text-xl text-primary">أكملتِ دراسة المقرر والقياس البعدي</h3><div className="overflow-x-auto"><table className="w-full text-right"><thead><tr><th className="p-3">الأداة</th><th>قبلي</th><th>بعدي</th></tr></thead><tbody>{(['Test', 'Scale'] as const).map(type => {
      const pre = data.progress.attempts[`pre${type}`]!; const post = data.progress.attempts[`post${type}`]!;
      return <tr key={type} className="border-t"><td className="p-3">{type === 'Test' ? 'الاختبار' : 'المقياس'}</td><td>{pre.score} / {pre.maximum}</td><td>{post.score} / {post.maximum}</td></tr>;
    })}{data.progress.attempts.preScale?.subscales?.map((subscale, i) => <tr className="border-t" key={subscale.title}><td className="p-3">{subscale.title}</td><td>{subscale.score} / {subscale.maximum}</td><td>{data.progress.attempts.postScale?.subscales?.[i]?.score} / {subscale.maximum}</td></tr>)}</tbody></table></div><p className="text-sm text-muted-foreground">يُصحح كل قسم وفق استجاباته ودرجاته، مع عكس تصحيح العبارات المعكوسة.</p></div>}
  </section>;
}

function JourneyEditor({ courseId }: { courseId: string }) {
  const data = useCourseJourney()!;
  const [config, setConfig] = useState<JourneyConfig>(() => structuredClone(data.config || emptyConfig()));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const updateQuestion = (index: number, patch: Partial<JourneyConfig['test']['questions'][number]>) => setConfig(c => ({ ...c, test: { ...c.test, questions: c.test.questions.map((q, i) => i === index ? { ...q, ...patch } : q) } }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      validateConfig(config); setSaving(true);
      await journeyRequest(courseId, '/config', config, 'PUT');
      await data.refresh(); setOpen(false); toast.success('تم حفظ إعدادات القياس القبلي والبعدي');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const input = 'w-full p-3 bg-background border rounded-lg';
  return <section className="bg-card border rounded-2xl p-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-xl">الاختبار والمقياس القبلي والبعدي</h3><p className="text-muted-foreground mt-2">{data.config.enabled ? 'مفعّل: القياس القبلي ← المحتوى ← القياس البعدي' : 'غير مفعّل — أضيفي أسئلة الاختبار وعبارات المقياس ثم فعّلي الترتيب.'}</p></div><button type="button" onClick={() => setOpen(!open)} className="px-5 py-3 rounded-xl border font-bold">{open ? 'إغلاق الإعدادات' : 'إعداد الاختبار والمقياس'}</button></div>
    {open && <form onSubmit={save} className="space-y-6">
      {!data.canManage && <p role="alert">الحفظ متاح لحساب معلم هذا المقرر فقط.</p>}
      <label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />تفعيل القياس القبلي والبعدي لهذا المقرر</label>
      <p className="text-sm text-muted-foreground">نفس الأسئلة والعبارات تُستخدم قبليًا وبعديًا. تُثبّت نسخة الأداة لكل طالبة عند أول إرسال، وتحفظ الإجابات والدرجات منفصلة. التعديلات التالية تطبق على الطالبات اللاتي لم يبدأن بعد.</p>
      <div className="space-y-4"><h4 className="text-lg font-bold">الاختبار</h4><input aria-label="عنوان الاختبار" className={input} value={config.test.title} onChange={e => setConfig({ ...config, test: { ...config.test, title: e.target.value } })} />
        {config.test.questions.map((q, index) => <fieldset key={q.id} className="border rounded-xl p-4 space-y-3"><legend>السؤال {index + 1}</legend><textarea required aria-label={`نص السؤال ${index + 1}`} className={input} value={q.text} onChange={e => updateQuestion(index, { text: e.target.value })} />
          {q.options.map((option, optIndex) => <div key={optIndex} className="flex items-center gap-3"><label className="flex items-center gap-2 shrink-0"><input aria-label={`الإجابة الصحيحة للسؤال ${index + 1}: الخيار ${optIndex + 1}`} type="radio" name={`correct-${q.id}`} checked={q.correctIndex === optIndex} onChange={() => updateQuestion(index, { correctIndex: optIndex })} />صحيحة</label><input required aria-label={`الخيار ${optIndex + 1} للسؤال ${index + 1}`} className={input} value={option} onChange={e => updateQuestion(index, { options: q.options.map((o, i) => i === optIndex ? e.target.value : o) })} /></div>)}
          <div className="flex gap-4"><button type="button" disabled={q.options.length >= 8} onClick={() => updateQuestion(index, { options: [...q.options, ''] })}>إضافة خيار</button><button type="button" disabled={q.options.length <= 2} onClick={() => updateQuestion(index, { options: q.options.slice(0, -1), correctIndex: Math.min(q.correctIndex || 0, q.options.length - 2) })}>حذف آخر خيار</button><button type="button" className="text-destructive" onClick={() => setConfig(c => ({ ...c, test: { ...c.test, questions: c.test.questions.filter((_, i) => i !== index) } }))}><Trash2 size={18} /> حذف السؤال</button></div>
        </fieldset>)}
        <button type="button" className="flex items-center gap-2 text-primary font-bold" onClick={() => setConfig(c => ({ ...c, test: { ...c.test, questions: [...c.test.questions, { id: crypto.randomUUID(), text: '', options: ['', '', '', ''], correctIndex: 0 }] } }))}><Plus size={18} />إضافة سؤال</button>
      </div>
      <div className="space-y-4"><h4 className="text-lg font-bold">المقياس</h4><input aria-label="عنوان المقياس" className={input} value={config.scale.title} onChange={e => setConfig({ ...config, scale: { ...config.scale, title: e.target.value } })} />{config.scale.sections?.length ? config.scale.sections.map(section => <p key={section.id} className="text-muted-foreground">{section.title}: {section.options.map((option, i) => `${option} (${section.scores[i]})`).join(' — ')}</p>) : <p className="text-muted-foreground">استجابات خماسية: {scaleOptions.join(' — ')}. لكل عبارة من 1 إلى 5 درجات.</p>}
        {config.scale.statements.map((s, index) => <div key={s.id} className="border rounded-xl p-4 space-y-3"><p className="font-bold text-primary">{statementResponse(config, index).section?.title || "عبارة المقياس"} — {index + 1}</p><textarea required aria-label={`عبارة المقياس ${index + 1}`} className={input} value={s.text} onChange={e => setConfig(c => ({ ...c, scale: { ...c.scale, statements: c.scale.statements.map((item, i) => i === index ? { ...item, text: e.target.value } : item) } }))} /><label className="flex items-center gap-2"><input type="checkbox" checked={s.reverse} onChange={e => setConfig(c => ({ ...c, scale: { ...c.scale, statements: c.scale.statements.map((item, i) => i === index ? { ...item, reverse: e.target.checked } : item) } }))} />عبارة معكوسة (عكس درجات استجابات القسم)</label><button type="button" className="text-destructive" onClick={() => setConfig(c => ({ ...c, scale: { ...c.scale, statements: c.scale.statements.filter((_, i) => i !== index) } }))}>حذف العبارة</button></div>)}
        <button type="button" className="flex items-center gap-2 text-primary font-bold" onClick={() => setConfig(c => ({ ...c, scale: { ...c.scale, statements: [...c.scale.statements, { id: crypto.randomUUID(), text: '', reverse: false }] } }))}><Plus size={18} />إضافة عبارة للمقياس</button>
      </div>
      <button disabled={saving || !data.canManage} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold disabled:opacity-50"><Save size={18} />{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</button>
    </form>}
  </section>;
}
