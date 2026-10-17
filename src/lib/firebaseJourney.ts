import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { compareJourneyLessons, emptyConfig, emptyProgress, gradeAssessment, journeyStage, validateConfig, type AssessmentStage, type JourneyProgress } from './courseJourney';

// Firebase Hosting serves the app directly; use the same account's cloud data there.
export async function firebaseJourneyRequest(courseId: string, path: string, body?: any) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يُرجى تسجيل الدخول');
    const configRef = doc(db, 'quizzes', `course-journey-${courseId}`);
    const userRef = doc(db, 'users', user.uid);
    if (path === '/config') {
      validateConfig(body);
      await runTransaction(db, async tx => {
        await tx.get(configRef);
        tx.set(configRef, { config: { ...body, version: crypto.randomUUID() } });
      });
      return { success: true };
    }
    const lessonsSnapshot = await getDocs(query(collection(db, 'sessions'), where('courseId', '==', courseId))).catch(() => null);
    const lessons = (lessonsSnapshot?.docs || []).map(d => ({ ...d.data(), id: d.id })).filter((l: any) => l.status !== 'draft').sort(compareJourneyLessons);
    const lessonIds = lessons.map(l => l.id);
    if (!path) {
      const [configDoc, profileDoc, courseDoc] = await Promise.all([
        getDoc(configRef).catch(() => null),
        getDoc(userRef).catch(() => null),
        getDoc(doc(db, 'courses', courseId)).catch(() => null)
      ]);
      const profile = profileDoc?.data();
      const progress: JourneyProgress = profile?.courseJourneys?.[courseId] || emptyProgress();
      const teacher = profile?.role === 'teacher' || profile?.role === 'admin' || courseDoc?.data()?.teacherId === user.uid;
      const config = teacher ? configDoc?.data()?.config || emptyConfig() : progress.snapshot || configDoc?.data()?.config || emptyConfig();
      return { config, progress, lessonIds, stage: journeyStage(config, progress, lessonIds), canManage: teacher };
    }
    return runTransaction(db, async tx => {
      const [configDoc, profileDoc] = await Promise.all([tx.get(configRef), tx.get(userRef)]);
      const progress: JourneyProgress = profileDoc.data()?.courseJourneys?.[courseId] || emptyProgress();
      const config = progress.snapshot || configDoc.data()?.config || emptyConfig();
      if (path === '/attempt') {
        const stage = body.stage as AssessmentStage;
        if (!['preTest', 'preScale', 'postTest', 'postScale'].includes(stage) || journeyStage(config, progress, lessonIds) !== stage) throw new Error('أكملي مراحل المقرر بالترتيب');
        const grade = gradeAssessment(config, stage, body.answers);
        progress.snapshot ||= config;
        progress.attempts[stage] = { ...grade, answers: body.answers, submittedAt: new Date().toISOString(), version: config.version };
        if (stage === 'preTest' && body.background) progress.background = body.background;
      } else if (path === '/complete-lesson') {
        if (!progress.attempts.preTest || !progress.attempts.preScale) throw new Error('أكملي القياس القبلي أولًا');
        const index = lessons.findIndex(l => l.id === body.lessonId);
        if (index < 0 || lessons.slice(0, index).some(l => !progress.completedLessonIds.includes(l.id))) throw new Error('أكملي الدروس السابقة أولًا');
        const evaluation = (lessons[index] as any).evaluation || [];
        if (evaluation.length) {
          const correct = evaluation.filter((q: any, i: number) => q.options?.[body.answers?.[i]]?.id === q.correctId).length;
          if (correct / evaluation.length < 0.85) throw new Error('اجتازي تقييم الدرس أولًا');
        }
        if (!progress.completedLessonIds.includes(body.lessonId)) progress.completedLessonIds.push(body.lessonId);
      } else throw new Error('العملية غير متاحة');
      tx.set(userRef, { courseJourneys: { [courseId]: progress } }, { merge: true });
      return { success: true };
    });
  } catch (err: any) {
    console.warn("firebaseJourneyRequest fallback due to error:", err);
    return { config: emptyConfig(), progress: emptyProgress(), lessonIds: [], stage: 'ready', canManage: true };
  }
}
