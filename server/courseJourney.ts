import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyConfig, emptyProgress, gradeAssessment, journeyStage, validateConfig, type JourneyConfig, type JourneyProgress, type AssessmentStage } from '../src/lib/courseJourney';

interface Identity { uid: string; email?: string }
interface Dependencies {
  directory: string;
  authenticate: (token: string) => Promise<Identity>;
  getLessons: (courseId: string) => Promise<any[]>;
  getCourse: (courseId: string) => Promise<any>;
}
export function createCourseJourneyRouter(deps: Dependencies) {
  const router = Router();
  const file = path.join(deps.directory, 'course_journeys.json');
  const read = (): Record<string, { config: JourneyConfig; students: Record<string, JourneyProgress> }> => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const write = (data: ReturnType<typeof read>) => {
    fs.mkdirSync(deps.directory, { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, file);
  };
  router.use('/:courseId', async (req, res, next) => {
    try {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) return res.status(401).json({ error: 'يُرجى تسجيل الدخول مجددًا لفتح التقييمات' });
      const identity = await deps.authenticate(token);
      res.locals.identity = identity;
      next();
    } catch (error: any) {
      console.warn('[Course Journey] Authentication failed:', error?.code || 'unknown');
      const invalid = ['auth/id-token-expired', 'auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-revoked', 'auth/user-disabled'].includes(error?.code);
      res.status(invalid ? 401 : 503).json({ code: invalid ? 'AUTH_REQUIRED' : 'AUTH_CHECK_FAILED', error: invalid ? 'الجلسة الحالية غير صالحة. يُرجى تسجيل الدخول مجددًا' : 'تعذر التحقق من تسجيل الدخول حاليًا. حاولي مرة أخرى.' });
    }
  });
  const isTeacher = (identity: Identity, course: any) => course?.teacherId === identity.uid ||
    ['postgraduatesystem79@gmail.com', 'drosamaayed@gmail.com', 'gradateminia@gmail.com', 'admin@adptive.edu.eg', 'admin@system.com'].includes(identity.email || '');
  router.get('/:courseId', async (req, res) => {
    try {
      const course = await deps.getCourse(req.params.courseId);
      if (!course) return res.status(404).json({ error: 'المقرر غير موجود' });
      const record = read()[req.params.courseId];
      const progress = record?.students[res.locals.identity.uid] || emptyProgress();
      const teacher = isTeacher(res.locals.identity, course);
      const config = progress.snapshot || record?.config || emptyConfig();
      const lessonIds = (await deps.getLessons(req.params.courseId)).map(l => l.id);
      const safeConfig = teacher ? record?.config || emptyConfig() : {
        ...config, test: { ...config.test, questions: config.test.questions.map(({ correctIndex, ...q }) => q) }
      };
      // Answer keys and questionnaire scoring are never sent to students before submission.
      const { snapshot, ...safeProgress } = progress;
      const stage = journeyStage(config, progress, lessonIds);
      const attempts = teacher || stage === 'complete' ? safeProgress.attempts : Object.fromEntries(Object.entries(safeProgress.attempts).map(([key, a]) => [key, { submittedAt: a!.submittedAt, version: a!.version }]));
      res.json({ config: safeConfig, progress: { ...safeProgress, attempts }, lessonIds, stage, canManage: teacher });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  router.put('/:courseId/config', async (req, res) => {
    try {
      const course = await deps.getCourse(req.params.courseId);
      if (!isTeacher(res.locals.identity, course)) return res.status(403).json({ error: 'تعديل التقييمات متاح لمعلم المقرر فقط' });
      validateConfig(req.body);
      const data = read();
      const config = { ...req.body, version: randomUUID() };
      data[req.params.courseId] = { config, students: data[req.params.courseId]?.students || {} };
      write(data);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  router.post('/:courseId/attempt', async (req, res) => {
    try {
      const lessonIds = (await deps.getLessons(req.params.courseId)).map(l => l.id);
      const data = read();
      const record = data[req.params.courseId];
      if (!record) throw new Error('لم يتم إعداد التقييمات لهذا المقرر');
      const progress = record.students[res.locals.identity.uid] || emptyProgress();
      const config = progress.snapshot || record.config;
      const stage = req.body.stage as AssessmentStage;
      if (!['preTest', 'preScale', 'postTest', 'postScale'].includes(stage) || journeyStage(config, progress, lessonIds) !== stage) throw new Error('هذا التقييم غير متاح في المرحلة الحالية أو تم إرساله بالفعل');
      const grade = gradeAssessment(config, stage, req.body.answers);
      if (stage === 'preTest' && config.backgroundFields?.length) {
        const background: Record<string, string> = {};
        for (const field of config.backgroundFields) {
          const value = req.body.background?.[field.id];
          if (value !== undefined && value !== '') {
            if (typeof value !== 'string' || value.length > 250 || (field.options && !field.options.includes(value))) throw new Error('راجعي البيانات الأولية');
            background[field.id] = value;
          }
        }
        progress.background = background;
      }
      progress.snapshot ||= structuredClone(config);
      progress.attempts[stage] = { ...grade, answers: req.body.answers, submittedAt: new Date().toISOString(), version: config.version };
      record.students[res.locals.identity.uid] = progress;
      write(data);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  router.post('/:courseId/complete-lesson', async (req, res) => {
    try {
      const lessons = await deps.getLessons(req.params.courseId);
      const data = read();
      const record = data[req.params.courseId];
      if (!record) return res.json({ success: true });
      const progress = record.students[res.locals.identity.uid] || emptyProgress();
      const config = progress.snapshot || record.config;
      if (!config.enabled) return res.json({ success: true });
      if (!progress.attempts.preTest || !progress.attempts.preScale) throw new Error('أكملي الاختبار والمقياس القبلي أولًا');
      const index = lessons.findIndex(l => l.id === req.body.lessonId);
      if (index < 0 || lessons.slice(0, index).some(l => !progress.completedLessonIds.includes(l.id))) throw new Error('أكملي الدروس بالترتيب');
      const lesson = lessons[index];
      if (lesson.evaluation?.length) {
        const grade = gradeAssessment({ ...config, test: { title: '', questions: lesson.evaluation.map((q: any) => ({ id: q.id, text: q.question, options: q.options.map((o: any) => o.text), correctIndex: q.options.findIndex((o: any) => o.id === q.correctId) })) } }, 'preTest', req.body.answers);
        if (grade.score / grade.maximum < 0.85) throw new Error('اجتازي تقييم الدرس أولًا');
      }
      if (!progress.completedLessonIds.includes(lesson.id)) progress.completedLessonIds.push(lesson.id);
      record.students[res.locals.identity.uid] = progress;
      write(data);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  return router;
}
