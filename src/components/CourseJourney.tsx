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
          const cfg = emptyConfig();
          const prog = emptyProgress();
          setData({
            config: cfg,
            progress: prog,
            lessonIds: [],
            stage: journeyStage(cfg, prog, []),
            canManage: isTeacher
          });
        }
      });
    return () => { active = false; };
  }, [courseId, user?.uid, isTeacher]);

  const fallbackConfig = emptyConfig();
  const fallbackProg = emptyProgress();
  const fallbackData: JourneyData = {
    config: fallbackConfig,
    progress: fallbackProg,
    lessonIds: [],
    stage: journeyStage(fallbackConfig, fallbackProg, []),
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
      {!isTeacher && currentData.config.enabled && (lessonId && (needsPre || previousIncomplete))
        ? <div className="space-y-6 max-w-4xl mx-auto p-4"><Link to={`/courses/${courseId}`} className="text-primary hover:underline font-bold inline-flex items-center gap-2">&rarr; العودة إلى صفحة المقرر</Link>{needsPre ? <JourneyStudentPanel courseId={courseId} /> : <div className="p-8 bg-card border rounded-2xl text-center space-y-3"><p className="text-lg font-bold">يجب إكمال الدروس السابقة واجتياز تقييمها أولاً.</p><Link to={`/courses/${courseId}`} className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold">الانتقال للدروس</Link></div>}</div>
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

  const answeredCount = Object.keys(answers).length;
  const totalCount = items?.length || 0;
  const percent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assessment || saving) return;

    // Check background fields for preTest
    if (assessment === 'preTest' && data.config.backgroundFields?.length) {
      const missingField = data.config.backgroundFields.find(f => !background[f.id]?.trim());
      if (missingField) {
        toast.error(`يرجى استكمال خانة (${missingField.label}) في البيانات الأولية أولاً`);
        const bgEl = document.getElementById('background-fieldset');
        if (bgEl) bgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    // Check all questions answered
    const firstUnanswered = items.findIndex((_, i) => answers[i] === undefined);
    if (firstUnanswered !== -1) {
      toast.error(`يرجى الإجابة عن البند رقم (${firstUnanswered + 1}) أولاً`);
      const el = document.getElementById(`journey-item-${firstUnanswered}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary');
        setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 3000);
      }
      return;
    }

    setSaving(true);
    try {
      await journeyRequest(courseId, '/attempt', {
        stage: assessment,
        answers: items.map((_, i) => answers[i]),
        ...(assessment === 'preTest' ? { background } : {})
      });
      await data.refresh();
      toast.success(`تم حفظ إجاباتك في ${assessmentLabels[assessment]} بنجاح`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border rounded-3xl p-6 md:p-8 space-y-6 shadow-sm" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <span className="w-3 h-8 bg-primary rounded-full inline-block" />
            رحلة دراسة المقرر والتجربة البحثية
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            وفقاً لمتطلبات البحث العلمي: يجب اجتياز القياسات القبلية، ثم إكمال الدروس المتتابعة، ويليهما القياس البعدي.
          </p>
        </div>
      </div>

      {/* Journey Stages Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['preTest', 'preScale', 'content', 'postTest', 'postScale'] as const).map((key, i) => {
          const done = key === 'content'
            ? data.lessonIds.length > 0 && data.lessonIds.every(id => data.progress.completedLessonIds.includes(id))
            : !!data.progress.attempts[key];
          const isCurrent = stage === key;
          return (
            <div
              key={key}
              className={`p-3.5 rounded-2xl border text-sm font-bold flex items-center gap-2.5 transition-all ${
                isCurrent
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                  : done
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-muted/40 text-muted-foreground'
              }`}
            >
              {done ? (
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              ) : isCurrent ? (
                <span className="w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center text-xs shrink-0 font-black">
                  {i + 1}
                </span>
              ) : (
                <Lock size={16} className="shrink-0 opacity-50" />
              )}
              <span className="truncate">{key === 'content' ? 'دراسة المحتوى' : assessmentLabels[key]}</span>
            </div>
          );
        })}
      </div>

      {stage === 'notReady' && (
        <div className="p-8 text-center bg-muted/20 border rounded-2xl">
          <p className="font-bold text-muted-foreground">سيظهر الاختبار والمقياس عند اكتمال إعدادهما.</p>
        </div>
      )}

      {stage === 'content' && (
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-200">
          <p className="font-bold">
            تهانينا! تم إكمال القياس القبلي بنجاح. يمكنكِ الآن دراسة الدروس التعليمية بالترتيب الموضح أدناه.
          </p>
          <p className="text-xs mt-1 text-emerald-700/80 dark:text-emerald-300/80">
            تم إنجاز {data.progress.completedLessonIds.filter(id => data.lessonIds.includes(id)).length} من أصل {data.lessonIds.length} درساً. سيُفتح القياس البعدي فور الانتهاء من جميع الدروس.
          </p>
        </div>
      )}

      {assessment && (
        <form key={assessment} onSubmit={submit} className="space-y-6 pt-2">
          {/* Sticky Progress Indicator */}
          <div className="sticky top-20 z-20 bg-background/95 backdrop-blur border rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {answeredCount}/{totalCount}
              </div>
              <div>
                <p className="font-bold text-sm">نسبة الإجابة عن {assessmentLabels[assessment]}</p>
                <p className="text-xs text-muted-foreground">{percent}% مكتمل ({totalCount - answeredCount} متبقي)</p>
              </div>
            </div>
            <div className="flex-1 min-w-[140px] max-w-xs bg-muted h-3 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <div>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs md:text-sm px-5 py-2.5 rounded-xl font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ...' : `إرسال ${assessmentLabels[assessment]}`}
              </button>
            </div>
          </div>

          {/* Demographic Background Fields (for preTest) */}
          {assessment === 'preTest' && data.config.backgroundFields?.length && (
            <fieldset id="background-fieldset" className="p-6 border rounded-2xl space-y-4 bg-muted/20">
              <legend className="font-bold px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm">
                البيانات الأولية للطالبة
              </legend>
              <p className="text-muted-foreground text-xs md:text-sm">{data.config.instructions}</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.config.backgroundFields.map(field => (
                  <label key={field.id} className="space-y-1.5 block">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {field.label} <span className="text-destructive">*</span>
                    </span>
                    {field.options ? (
                      <select
                        required
                        className="w-full border bg-background rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        value={background[field.id] || ''}
                        disabled={saving}
                        onChange={e => setBackground(b => ({ ...b, [field.id]: e.target.value }))}
                      >
                        <option value="">اختاري {field.label}</option>
                        {field.options.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        className="w-full border bg-background rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        maxLength={250}
                        placeholder={`أدخلي ${field.label}`}
                        value={background[field.id] || ''}
                        disabled={saving}
                        onChange={e => setBackground(b => ({ ...b, [field.id]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Assessment Title Header */}
          <div className="p-5 bg-card border rounded-2xl">
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
              {assessmentLabels[assessment]} — {isScale ? data.config.scale.title : data.config.test.title}
            </h3>
            <p className="text-muted-foreground text-xs md:text-sm mt-1.5">
              {isScale
                ? 'اختاري درجة موافقتك على كل عبارة من العبارات التالية. لا توجد إجابة صحيحة أو خاطئة.'
                : 'اختاري إجابة واحدة صحيحة لكل سؤال من الأسئلة التالية. القياس القبلي يهدف لتحديد المستوى المعرفي قبل البدء بالدراسة.'}
            </p>
          </div>

          {/* Assessment Items */}
          <div className="space-y-4">
            {items.map((item, index) => {
              const scaleResp = isScale ? statementResponse(data.config, index) : null;
              const options = isScale ? scaleResp!.options : data.config.test.questions[index].options;
              const isAnswered = answers[index] !== undefined;

              return (
                <fieldset
                  key={item.id}
                  id={`journey-item-${index}`}
                  className={`border rounded-2xl p-5 space-y-3.5 transition-all bg-card ${
                    isAnswered ? 'border-primary/40 bg-primary/[0.02]' : 'hover:border-slate-300'
                  }`}
                >
                  <legend className="font-bold px-2 text-sm text-foreground flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-mono">
                      {index + 1}
                    </span>
                    {isScale && scaleResp?.section && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                        {scaleResp.section.title}
                      </span>
                    )}
                  </legend>

                  <p className="font-medium text-base text-slate-800 dark:text-slate-200 leading-relaxed pr-2">
                    {item.text}
                  </p>

                  <div className={`grid gap-2.5 pt-1 ${options.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {options.map((option, value) => {
                      const selected = answers[index] === value;
                      return (
                        <label
                          key={value}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                            selected
                              ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                              : 'bg-muted/30 border-transparent hover:bg-muted/60 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`${assessment}-${item.id}`}
                            value={value}
                            checked={selected}
                            disabled={saving}
                            onChange={() => setAnswers(prev => ({ ...prev, [index]: value }))}
                            className="w-4 h-4 text-primary focus:ring-primary"
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>

          {/* Bottom Submit Button */}
          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/25 text-base transition-all disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : `إرسال ${assessmentLabels[assessment]}`}
            </button>
          </div>
        </form>
      )}

      {stage === 'complete' && (
        <div className="space-y-4 p-6 bg-card border rounded-2xl">
          <h3 className="font-black text-xl text-primary">أكملتِ دراسة المقرر والقياس البعدي بنجاح</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-sm font-bold">الأداة</th>
                  <th className="p-3 text-sm font-bold">الدرجة القبلية</th>
                  <th className="p-3 text-sm font-bold">الدرجة البعدية</th>
                </tr>
              </thead>
              <tbody>
                {(['Test', 'Scale'] as const).map(type => {
                  const pre = data.progress.attempts[`pre${type}`];
                  const post = data.progress.attempts[`post${type}`];
                  return (
                    <tr key={type} className="border-b">
                      <td className="p-3 font-semibold">{type === 'Test' ? 'الاختبار التحصيلي' : 'المقياس'}</td>
                      <td className="p-3">{pre ? `${pre.score} / ${pre.maximum}` : '—'}</td>
                      <td className="p-3">{post ? `${post.score} / ${post.maximum}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
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
