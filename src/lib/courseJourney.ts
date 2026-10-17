export type AssessmentStage = 'preTest' | 'preScale' | 'postTest' | 'postScale';
export type JourneyStage = AssessmentStage | 'content' | 'complete' | 'notReady';
export interface TestQuestion { id: string; text: string; options: string[]; correctIndex?: number }
export interface ScaleStatement { id: string; text: string; reverse: boolean; sectionId?: string }
export interface ScaleSection { id: string; title: string; options: string[]; scores: number[] }
export interface JourneyConfig {
  enabled: boolean;
  version: string;
  test: { title: string; questions: TestQuestion[] };
  scale: { title: string; statements: ScaleStatement[]; sections?: ScaleSection[] };
  backgroundFields?: { id: string; label: string; options?: string[] }[];
  instructions?: string;
}
export interface AssessmentAttempt {
  answers: number[];
  score: number;
  maximum: number;
  submittedAt: string;
  version: string;
  subscales?: { title: string; score: number; maximum: number }[];
}
export interface JourneyProgress {
  attempts: Partial<Record<AssessmentStage, AssessmentAttempt>>;
  completedLessonIds: string[];
  snapshot?: JourneyConfig;
  background?: Record<string, string>;
}
export const assessmentLabels: Record<AssessmentStage, string> = {
  preTest: 'الاختبار القبلي', preScale: 'المقياس القبلي', postTest: 'الاختبار البعدي', postScale: 'المقياس البعدي'
};
export const scaleOptions = ['لا أوافق بشدة', 'لا أوافق', 'محايد', 'أوافق', 'أوافق بشدة'];
export function statementResponse(config: JourneyConfig, index: number) {
  const statement = config.scale.statements[index];
  const section = config.scale.sections?.find(s => s.id === statement.sectionId);
  const options = section?.options || scaleOptions;
  const baseScores = section?.scores || [1, 2, 3, 4, 5];
  return { options, scores: statement.reverse ? [...baseScores].reverse() : baseScores, section };
}
export function compareJourneyLessons(a: { id: string; lessonNumber?: number }, b: { id: string; lessonNumber?: number }) {
  return (a.lessonNumber ?? Number.MAX_SAFE_INTEGER) - (b.lessonNumber ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
}
export const emptyProgress = (): JourneyProgress => ({ attempts: {}, completedLessonIds: [] });
export const emptyConfig = (): JourneyConfig => ({
  enabled: false, version: '', test: { title: 'اختبار التحصيل', questions: [] },
  scale: { title: 'مقياس الوعي الصحي', statements: [] }
});
export function validateConfig(config: JourneyConfig): void {
  if (!config || typeof config.enabled !== 'boolean' || !config.test || !config.scale ||
      !Array.isArray(config.test.questions) || !Array.isArray(config.scale.statements)) throw new Error('بيانات التقييم غير صالحة');
  if (config.test.questions.length > 200 || config.scale.statements.length > 200) throw new Error('الحد الأقصى 200 سؤال أو عبارة');
  if (config.enabled && (!config.test.questions.length || !config.scale.statements.length)) throw new Error('أضيفي أسئلة الاختبار وعبارات المقياس قبل التفعيل');
  const ids = new Set<string>();
  for (const q of config.test.questions) {
    if (!q.id || ids.has(q.id) || !q.text?.trim() || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8 ||
        q.options.some(o => typeof o !== 'string' || !o.trim()) || !Number.isInteger(q.correctIndex) || q.correctIndex! < 0 || q.correctIndex! >= q.options.length) {
      throw new Error('أكملي نص كل سؤال وخياراته وحددي الإجابة الصحيحة');
    }
    ids.add(q.id);
  }
  for (const s of config.scale.statements) {
    if (!s.id || ids.has(s.id) || !s.text?.trim() || typeof s.reverse !== 'boolean') throw new Error('أكملي عبارات المقياس');
    ids.add(s.id);
  }
  for (const section of config.scale.sections || []) {
    if (!section.id || !section.title?.trim() || !Array.isArray(section.options) || !Array.isArray(section.scores) ||
        section.options.length < 2 || section.options.length > 8 || section.options.length !== section.scores.length ||
        section.options.some(o => typeof o !== 'string' || !o.trim()) || section.scores.some(s => !Number.isFinite(s) || s < 0)) throw new Error('راجعي استجابات المقياس ودرجاتها');
  }
  if (config.scale.statements.some(s => s.sectionId && !config.scale.sections?.some(section => section.id === s.sectionId))) throw new Error('قسم المقياس غير موجود');
}
export function journeyStage(config: JourneyConfig, progress: JourneyProgress, lessonIds: string[]): JourneyStage {
  if (!config.enabled) return 'content';
  if (!config.test.questions.length || !config.scale.statements.length) return 'notReady';
  if (!progress.attempts.preTest) return 'preTest';
  if (!progress.attempts.preScale) return 'preScale';
  if (!lessonIds.length || !lessonIds.every(id => progress.completedLessonIds.includes(id))) return 'content';
  if (!progress.attempts.postTest) return 'postTest';
  if (!progress.attempts.postScale) return 'postScale';
  return 'complete';
}
export function gradeAssessment(config: JourneyConfig, stage: AssessmentStage, answers: number[]): {score: number; maximum: number; subscales?: AssessmentAttempt['subscales']} {
  const isScale = stage.endsWith('Scale');
  const items = isScale ? config.scale.statements : config.test.questions;
  if (!Array.isArray(answers) || !items.length || answers.length !== items.length || answers.some((a, i) =>
    !Number.isInteger(a) || a < 0 || a >= (isScale ? statementResponse(config, i).options.length : config.test.questions[i].options.length))) throw new Error('أجيبي عن جميع البنود بإجابات صالحة');
  if (!isScale) return { score: answers.reduce((sum, a, i) => sum + Number(a === config.test.questions[i].correctIndex), 0), maximum: items.length };
  const score = answers.reduce((sum, a, i) => sum + statementResponse(config, i).scores[a], 0);
  const maximum = answers.reduce((sum, _, i) => sum + Math.max(...statementResponse(config, i).scores), 0);
  const subscales = config.scale.sections?.map(section => {
    const indices = config.scale.statements.flatMap((s, i) => s.sectionId === section.id ? [i] : []);
    return { title: section.title, score: indices.reduce((sum, i) => sum + statementResponse(config, i).scores[answers[i]], 0), maximum: indices.length * Math.max(...section.scores) };
  });
  return { score, maximum, ...(subscales ? { subscales } : {}) };
}
