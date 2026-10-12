import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseStability, mineCandidates, normalizeTraces, toPromptfoo } from '../src/core.js';

test('normalizes common trace shapes', () => {
  const traces = normalizeTraces({ data: [{ trace_id: 'abc', inputs: { question: 'refund policy' }, response: 'incorrect', scores: [{ value: 0.2 }] }] });
  assert.equal(traces.length, 1); assert.equal(traces[0].id, 'abc'); assert.equal(traces[0].feedback, 0.2); assert.match(traces[0].input, /refund policy/);
});

test('mines low-score and error traces as candidates', () => {
  const candidates = mineCandidates([{ id: 'one', input: 'x', output: 'y', feedback: 0.1, error: '', metadata: {} }, { id: 'two', input: 'z', output: '', feedback: null, error: 'timeout', metadata: {} }]);
  assert.equal(candidates.length, 2); assert.match(candidates[0].reason, /low feedback/); assert.equal(candidates[1].severity, 'high');
});

test('reports flaky behaviour across repeated runs', () => {
  const [record] = analyseStability([{ testId: 'r1', passed: true, score: .9 }, { testId: 'r1', passed: true, score: .6 }, { testId: 'r1', passed: false, score: .1 }]);
  assert.equal(record.verdict, 'flaky'); assert.equal(record.passRate, 0.667); assert.ok(record.stddev > 0);
});

test('exports reviewable Promptfoo YAML', () => {
  const yaml = toPromptfoo([{ id: 't2t-123', input: 'hello', reason: 'low feedback', suggestedAssertions: ['must answer correctly'] }]);
  assert.match(yaml, /t2t-123/); assert.match(yaml, /llm-rubric/);
});
