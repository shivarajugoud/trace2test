#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { answerCancellationQuestion, cancellationQuestion, evaluateCancellationAnswer } from './support-bot.js';

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    result[value.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return result;
}

const options = args(process.argv.slice(2));
const mode = options.mode || 'broken';
if (!['broken', 'fixed'].includes(mode)) throw new Error('--mode must be `broken` or `fixed`.');

const output = answerCancellationQuestion({ mode });
const evaluation = evaluateCancellationAnswer(output);
const trace = {
  id: `support-cancellation-${mode}-001`,
  input: cancellationQuestion,
  output,
  feedback: evaluation.score,
  metadata: { demo: 'support-answer-bot', mode, ...evaluation },
};

if (options.out) {
  const target = resolve(options.out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify([trace], null, 2) + '\n');
  console.log(`Trace written → ${target}`);
}

console.log(`\nMode: ${mode}`);
console.log(`Question: ${trace.input}`);
console.log(`Answer: ${trace.output}`);
console.log(`Evaluation: ${evaluation.passed ? 'PASS' : 'FAIL'} (${evaluation.score})`);
console.log(`Missing checks: ${Object.entries(evaluation.checks).filter(([, passed]) => !passed).map(([name]) => name).join(', ') || 'none'}`);

if (options.assert && !evaluation.passed) {
  console.error('\nRegression test failed: the response violates the cancellation-policy rubric.');
  process.exitCode = 1;
}
