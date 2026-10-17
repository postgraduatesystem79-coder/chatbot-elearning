import coursesJson from '../../local_db/courses.json';
import sessionsJson from '../../local_db/sessions.json';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { defaultJourneyConfig } from './courseJourney';

export const DEFAULT_COURSES: any[] = coursesJson;
export const DEFAULT_SESSIONS: any[] = sessionsJson;

export const DEFAULT_COURSE = DEFAULT_COURSES[0] || {
  id: "course_1792174732543_4i1dv",
  title: "تطبيقات الذكاء الاصطناعي لتنمية الوعي الصحي بمكملات الملابس",
  description: "تُعد هذه الوحدة إحدى الوحدات التعليمية التي تهدف إلى تنمية الوعي الصحي لدى الطلاب بمكملات الملابس، من خلال توظيف تطبيقات الذكاء الاصطناعي في تقديم محتوى تعليمي تفاعلي يجمع بين المعرفة العلمية والتطبيق العملي، بما يساعد الطلاب على فهم الجوانب الصحية المرتبطة باختيار مكملات الملابس واستخدامها والعناية بها بصورة آمنة وصحية.",
  category: "Programming",
  imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
  duration: "45 دقيقة",
  courseCode: "LSJBJJ",
  startDate: "2026-10-16",
  teacherName: "معلم المقرر",
  teacherId: "joGE90WmwLaVVhnUmzXbe9Bbdra2",
  rating: 5,
  students: 0,
  status: "published",
  createdAt: "2026-10-16T18:18:52.543Z"
};

let syncInProgress = false;

export async function syncDefaultDataToFirestore(db: any) {
  if (syncInProgress || !db) return;
  syncInProgress = true;
  try {
    // 1. Sync courses
    const coursesSnap = await getDocs(collection(db, 'courses')).catch(() => null);
    if (!coursesSnap || coursesSnap.empty) {
      console.log('[Sync] Seeding default courses into Firestore...');
      for (const course of DEFAULT_COURSES) {
        await setDoc(doc(db, 'courses', course.id), course, { merge: true }).catch(() => {});
      }
    }

    // 2. Sync sessions
    const sessionsSnap = await getDocs(collection(db, 'sessions')).catch(() => null);
    if (!sessionsSnap || sessionsSnap.empty) {
      console.log('[Sync] Seeding default sessions into Firestore...');
      for (const session of DEFAULT_SESSIONS) {
        await setDoc(doc(db, 'sessions', session.id), session, { merge: true }).catch(() => {});
      }
    }

    // 3. Sync default journey config
    const journeyRef = doc(db, 'quizzes', `course-journey-${DEFAULT_COURSE.id}`);
    const journeySnap = await getDoc(journeyRef).catch(() => null);
    if (!journeySnap || !journeySnap.exists() || !journeySnap.data()?.config?.enabled) {
      console.log('[Sync] Seeding default journey config into Firestore...');
      await setDoc(journeyRef, { config: defaultJourneyConfig }, { merge: true }).catch(() => {});
    }

  } catch (err) {
    console.warn('[Sync] Firestore seed error (safe to ignore in offline/static mode):', err);
  } finally {
    syncInProgress = false;
  }
}
