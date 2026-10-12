import test from 'node:test';
import assert from 'node:assert/strict';
import { mineCandidates, normalizeTraces } from '../src/core.js';
import { answerCancellationQuestion, cancellationQuestion, evaluateCancellationAnswer } from '../examples/support-answer-bot/support-bot.js';

test('Trace2Test promotes the observed broken support answer', () => {
  const output = answerCancellationQuestion({ mode: 'broken' });
  const evaluation = evaluateCancellationAnswer(output);
  assert.equal(evaluation.passed, false);
  const [candidate] = mineCandidates(normalizeTraces([{ id: 'prod-101', input: cancellationQuestion, output, feedback: evaluation.score }]));
  assert.match(candidate.reason, /low feedback/);
  assert.match(candidate.observedOutput, /contact support/i);
});

test('the fixed support answer satisfies the same rubric', () => {
  const evaluation = evaluateCancellationAnswer(answerCancellationQuestion({ mode: 'fixed' }));
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.score, 1);
});
