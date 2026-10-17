import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { compareJourneyLessons, emptyConfig, emptyProgress, gradeAssessment, journeyStage, validateConfig, type AssessmentStage, type JourneyProgress } from './courseJourney';
import { DEFAULT_SESSIONS } from './defaultData';

function getLocalProgress(courseId: string, uid: string): JourneyProgress {
  try {
    const raw = localStorage.getItem(`journey_progress_${courseId}_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return emptyProgress();
}

function saveLocalProgress(courseId: string, uid: string, progress: JourneyProgress) {
  try {
    localStorage.setItem(`journey_progress_${courseId}_${uid}`, JSON.stringify(progress));
  } catch (e) {}
}

function mergeProgress(a: JourneyProgress, b: JourneyProgress): JourneyProgress {
  return {
    attempts: { ...(a?.attempts || {}), ...(b?.attempts || {}) },
    completedLessonIds: Array.from(new Set([...(a?.completedLessonIds || []), ...(b?.completedLessonIds || [])])),
    background: { ...(a?.background || {}), ...(b?.background || {}) },
    snapshot: a?.snapshot || b?.snapshot
  };
}

// Firebase Hosting serves the app directly; use cloud data with rock-solid local persistence
export async function firebaseJourneyRequest(courseId: string, path: string, body?: any) {
  const user = auth.currentUser;
  if (!user) throw new Error('يُرجى تسجيل الدخول');
  const configRef = doc(db, 'quizzes', `course-journey-${courseId}`);
  const userRef = doc(db, 'users', user.uid);

  try {
    // 1. Updating config (teacher only)
    if (path === '/config') {
      validateConfig(body);
      await setDoc(configRef, { config: { ...body, version: crypto.randomUUID() } }, { merge: true });
      return { success: true };
    }

    // 2. Resolve lessons
    let lessonsSnapshot = await getDocs(query(collection(db, 'sessions'), where('courseId', '==', courseId))).catch(() => null);
    let lessons = (lessonsSnapshot?.docs || []).map(d => ({ ...d.data(), id: d.id })).filter((l: any) => l.status !== 'draft').sort(compareJourneyLessons);
    if (!lessons.length) {
      lessons = (DEFAULT_SESSIONS || []).filter((s: any) => s.courseId === courseId).sort(compareJourneyLessons);
    }
    const lessonIds = lessons.map(l => l.id);

    // 3. Resolve config and progress
    const [configDoc, profileDoc, courseDoc] = await Promise.all([
      getDoc(configRef).catch(() => null),
      getDoc(userRef).catch(() => null),
      getDoc(doc(db, 'courses', courseId)).catch(() => null)
    ]);

    const profile = profileDoc?.data();
    const cloudProgress: JourneyProgress = profile?.courseJourneys?.[courseId] || emptyProgress();
    const localProgress = getLocalProgress(courseId, user.uid);
    const progress = mergeProgress(cloudProgress, localProgress);
    saveLocalProgress(courseId, user.uid, progress);

    const teacher = profile?.role === 'teacher' || profile?.role === 'admin' || courseDoc?.data()?.teacherId === user.uid;
    const defaultConfig = emptyConfig();
    let config = teacher ? (configDoc?.data()?.config || defaultConfig) : (progress.snapshot || configDoc?.data()?.config || defaultConfig);
    if (!config || !config.test?.questions?.length) {
      config = defaultConfig;
    }

    // 4. Initial status check (path === '')
    if (!path) {
      const stage = journeyStage(config, progress, lessonIds);
      return { config, progress, lessonIds, stage, canManage: teacher };
    }

    // 5. Handling assessment submission
    if (path === '/attempt') {
      const stage = body.stage as AssessmentStage;
      const currentStage = journeyStage(config, progress, lessonIds);
      if (!['preTest', 'preScale', 'postTest', 'postScale'].includes(stage) || currentStage !== stage) {
        throw new Error('أكملي مراحل المقرر بالترتيب');
      }
      const grade = gradeAssessment(config, stage, body.answers);
      progress.snapshot ||= config;
      progress.attempts[stage] = { ...grade, answers: body.answers, submittedAt: new Date().toISOString(), version: config.version };
      if (stage === 'preTest' && body.background) progress.background = body.background;
      saveLocalProgress(courseId, user.uid, progress);
      setDoc(userRef, { courseJourneys: { [courseId]: progress } }, { merge: true }).catch(err => {
        console.warn("Firestore sync error on attempt:", err);
      });
      return { success: true };
    }

    // 6. Handling lesson completion
    if (path === '/complete-lesson') {
      if (!progress.attempts.preTest || !progress.attempts.preScale) throw new Error('أكملي القياس القبلي أولًا');
      const index = lessons.findIndex(l => l.id === body.lessonId);
      if (index < 0 || lessons.slice(0, index).some(l => !progress.completedLessonIds.includes(l.id))) {
        throw new Error('أكملي الدروس السابقة أولًا');
      }
      const evaluation = (lessons[index] as any).evaluation || [];
      if (evaluation.length && body.answers) {
        const correct = evaluation.filter((q: any, i: number) => q.options?.[body.answers?.[i]]?.id === q.correctId).length;
        if (correct / evaluation.length < 0.85) throw new Error('اجتازي تقييم الدرس بنسبة 85% أولًا');
      }
      if (!progress.completedLessonIds.includes(body.lessonId)) progress.completedLessonIds.push(body.lessonId);
      saveLocalProgress(courseId, user.uid, progress);
      setDoc(userRef, { courseJourneys: { [courseId]: progress } }, { merge: true }).catch(err => {
        console.warn("Firestore sync error on complete-lesson:", err);
      });
      return { success: true };
    }

    throw new Error('العملية غير متاحة');
  } catch (err: any) {
    console.warn("firebaseJourneyRequest fallback due to error:", err);
    const fallbackConfig = emptyConfig();
    const fallbackLessons = (DEFAULT_SESSIONS || []).filter((s: any) => s.courseId === courseId).sort(compareJourneyLessons);
    const lessonIds = fallbackLessons.map(l => l.id);
    const localProg = getLocalProgress(courseId, user.uid);
    return {
      config: fallbackConfig,
      progress: localProg,
      lessonIds,
      stage: journeyStage(fallbackConfig, localProg, lessonIds),
      canManage: false
    };
  }
}

