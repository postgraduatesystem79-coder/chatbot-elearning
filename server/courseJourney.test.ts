import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCourseJourneyRouter } from './courseJourney';
import { emptyProgress, gradeAssessment, journeyStage, validateConfig, type JourneyConfig } from '../src/lib/courseJourney';

const config: JourneyConfig = {
  enabled: true, version: 'v1',
  test: { title: 'Test', questions: [{ id: 'q1', text: 'Question', options: ['A', 'B'], correctIndex: 1 }] },
  scale: { title: 'Scale', statements: [{ id: 's1', text: 'Positive', reverse: false }, { id: 's2', text: 'Negative', reverse: true }] }
};
test('grades test and reversed scale; rejects incomplete or invalid answers', () => {
  assert.deepEqual(gradeAssessment(config, 'preTest', [1]), { score: 1, maximum: 1 });
  assert.deepEqual(gradeAssessment(config, 'postTest', [0]), { score: 0, maximum: 1 });
  assert.deepEqual(gradeAssessment(config, 'preScale', [4, 0]), { score: 10, maximum: 10 });
  assert.throws(() => gradeAssessment(config, 'preScale', [4]));
  assert.throws(() => gradeAssessment(config, 'preTest', [2]));
  assert.throws(() => gradeAssessment(config, 'preTest', [0.5]));
  assert.throws(() => validateConfig({ ...config, test: { title: '', questions: [] } }));
  assert.equal(journeyStage(config, emptyProgress(), []), 'preTest');
});
test('keeps three-point and five-point questionnaires separate and reverses only designated items', () => {
  const mixed: JourneyConfig = { ...structuredClone(config), scale: {
    title: 'Two sections',
    sections: [
      { id: 'behavior', title: 'Behavior', options: ['Agree', 'Partly', 'Disagree'], scores: [3, 2, 1] },
      { id: 'health', title: 'Health', options: ['Strongly agree', 'Agree', 'Partly', 'Disagree', 'Strongly disagree'], scores: [5, 4, 3, 2, 1] }
    ],
    statements: [
      { id: 'b1', text: 'Positive', reverse: false, sectionId: 'behavior' },
      { id: 'b2', text: 'Negative', reverse: true, sectionId: 'behavior' },
      { id: 'h1', text: 'Health', reverse: false, sectionId: 'health' }
    ]
  } };
  validateConfig(mixed);
  assert.deepEqual(gradeAssessment(mixed, 'preScale', [0, 2, 0]), {
    score: 11, maximum: 11, subscales: [{ title: 'Behavior', score: 6, maximum: 6 }, { title: 'Health', score: 5, maximum: 5 }]
  });
  assert.throws(() => gradeAssessment(mixed, 'preScale', [3, 2, 0]));
});
test('course journey enforces all stages, persists results and freezes pre/post instruments', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'course-journey-test-'));
  const app = express(); app.use(express.json());
  const dependencies = {
    directory,
    authenticate: async (token: string) => {
      if (token === 'offline') throw Object.assign(new Error('network unavailable'), { code: 'auth/network-error' });
      if (!['teacher', 'student', 'other'].includes(token)) throw Object.assign(new Error('invalid'), { code: 'auth/invalid-id-token' });
      return { uid: token };
    },
    getCourse: async (id: string) => id === 'course' ? { id, teacherId: 'teacher' } : null,
    getLessons: async () => [{ id: 'lesson1', evaluation: [] }, { id: 'lesson2', evaluation: [{ id: 'lq', question: 'Lesson quiz', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctId: 'b' }] }]
  };
  app.use('/journey', createCourseJourneyRouter(dependencies));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const request = async (token: string, suffix = '', body?: any, method = 'POST') => {
    const response = await fetch(`http://127.0.0.1:${address.port}/journey/course${suffix}`, {
      method: body === undefined ? 'GET' : method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal((await request('invalid')).status, 401);
    assert.equal((await request('offline')).status, 503);
    assert.equal((await request('student', '/config', config, 'PUT')).status, 403);
    assert.equal((await request('teacher', '/config', config, 'PUT')).status, 200);
    let state = (await request('student')).data;
    assert.equal(state.stage, 'preTest');
    assert.equal(state.config.test.questions[0].correctIndex, undefined);
    assert.equal((await request('student', '/attempt', { stage: 'postTest', answers: [1] })).status, 400);
    assert.equal((await request('student', '/complete-lesson', { lessonId: 'lesson1' })).status, 400);
    assert.equal((await request('student', '/attempt', { stage: 'preTest', answers: [1] })).status, 200);
    assert.equal((await request('student', '/attempt', { stage: 'preTest', answers: [0] })).status, 400);
    assert.equal((await request('student')).data.progress.attempts.preTest.score, undefined);
    // Later edits do not change an instrument already started by a student.
    const changed = structuredClone(config); changed.test.questions[0].correctIndex = 0;
    assert.equal((await request('teacher', '/config', changed, 'PUT')).status, 200);
    assert.equal((await request('student')).data.stage, 'preScale');
    assert.equal((await request('student', '/attempt', { stage: 'preScale', answers: [4, 0] })).status, 200);
    assert.equal((await request('student')).data.stage, 'content');
    assert.equal((await request('student', '/complete-lesson', { lessonId: 'lesson2', answers: [1] })).status, 400);
    assert.equal((await request('student', '/complete-lesson', { lessonId: 'lesson1' })).status, 200);
    assert.equal((await request('student', '/complete-lesson', { lessonId: 'lesson2', answers: [0] })).status, 400);
    assert.equal((await request('student', '/complete-lesson', { lessonId: 'lesson2', answers: [1] })).status, 200);
    assert.equal((await request('student')).data.stage, 'postTest');
    assert.equal((await request('student', '/attempt', { stage: 'postTest', answers: [1] })).status, 200);
    assert.equal((await request('student')).data.stage, 'postScale');
    assert.equal((await request('student', '/attempt', { stage: 'postScale', answers: [0, 4] })).status, 200);
    state = (await request('student')).data;
    assert.equal(state.stage, 'complete');
    assert.equal(state.progress.attempts.preTest.score, 1);
    assert.equal(state.progress.attempts.postTest.score, 1);
    assert.equal(state.progress.attempts.preScale.score, 10);
    assert.equal(state.progress.attempts.postScale.score, 2);
    assert.equal((await request('other')).data.stage, 'preTest');
    assert.equal((await request('other', '/attempt', { stage: 'preTest', answers: [1] })).status, 200);
    assert.equal((await request('other')).data.stage, 'preScale');
    // A fresh router instance still reads the saved results.
    const stored = JSON.parse(fs.readFileSync(path.join(directory, 'course_journeys.json'), 'utf8'));
    assert.equal(stored.course.students.student.attempts.postTest.score, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
