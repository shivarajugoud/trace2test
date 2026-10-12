#!/usr/bin/env node
import { analyseStability, mineCandidates, normalizeTraces, toPromptfoo } from '../../src/core.js';
import { answerCancellationQuestion, cancellationQuestion, evaluateCancellationAnswer } from './support-bot.js';

function traceFor(mode, run) {
  const output = answerCancellationQuestion({ mode });
  const evaluation = evaluateCancellationAnswer(output);
  return {
    id: `support-${mode}-${run}`,
    input: cancellationQuestion,
    output,
    feedback: evaluation.score,
    metadata: { mode, checks: evaluation.checks },
  };
}

const brokenTrace = traceFor('broken', 1);
const candidate = mineCandidates(normalizeTraces([brokenTrace]))[0];
const samples = [
  ...[1, 2, 3].map((run) => ({ testId: candidate.id, ...evaluateCancellationAnswer(answerCancellationQuestion({ mode: 'broken' })), run })),
  ...[4, 5, 6].map((run) => ({ testId: candidate.id, ...evaluateCancellationAnswer(answerCancellationQuestion({ mode: 'fixed' })), run })),
];
const stability = analyseStability(samples)[0];

console.log('1. Simulated production response (broken)');
console.log(`   score: ${brokenTrace.feedback} | output: ${brokenTrace.output}`);
console.log('\n2. Trace2Test promoted it');
console.log(`   ${candidate.id} — ${candidate.reason}`);
console.log('\n3. Repeated-run analysis across broken then fixed builds');
console.log(`   pass rate: ${stability.passRate}; verdict: ${stability.verdict}`);
console.log('\n4. Promptfoo-ready candidate (review before committing)');
console.log(toPromptfoo([candidate]));
