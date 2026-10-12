#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { analyseStability, markdownReport, mineCandidates, normalizeTraces, toPromptfoo } from './core.js';
import { runApprovedCases } from './runner.js';

const help = `Trace2Test — turn production LLM failures into regression candidates

Commands:
  ingest --input traces.json [--out .trace2test/traces.json]
  mine --input traces.json [--out .trace2test/candidates.json] [--threshold 0.5]
  stability --input samples.json [--out .trace2test/stability.json] [--pass-threshold 0.8]
  export --input candidates.json --format promptfoo [--out promptfooconfig.yaml]
  report --candidates candidates.json [--stability stability.json] [--out trace2test-report.md]
  run --input approved-cases.json --base-url http://localhost:3000 [--repeats 3] [--timeout-ms 10000] [--pass-threshold 1] [--out .trace2test/run.json]
  init [--force]
  approve --input candidates.json --id t2t-... --path /answer --contains "expected behavior" [--method POST] [--body '{"input":"{{input}}"}'] [--out trace2test.cases.json]
`;

function args(argv) { const result = { _: [] }; for (let i = 0; i < argv.length; i += 1) { const value = argv[i]; if (value.startsWith('--')) result[value.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; else result._.push(value); } return result; }
async function json(path) { return JSON.parse(await readFile(resolve(path), 'utf8')); }
async function output(path, value) { const target = resolve(path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); return target; }
async function exists(path) { try { await access(resolve(path)); return true; } catch { return false; } }
async function writeNew(path, value, force) { if (!force && await exists(path)) return false; await output(path, value); return true; }
function parseBody(value) { if (!value) return undefined; try { return JSON.parse(value); } catch { throw new Error('--body must be valid JSON.'); } }

const options = args(process.argv.slice(2));
const command = options._[0];
if (!command || options.help) { console.log(help); process.exit(command ? 0 : 1); }
try {
  if (command === 'ingest') { const traces = normalizeTraces(await json(options.input)); console.log(`Normalized ${traces.length} traces → ${await output(options.out || '.trace2test/traces.json', traces)}`); }
  else if (command === 'init') {
    const files = {
      'trace2test.config.json': { baseUrl: 'http://localhost:3000', repeats: 3, passThreshold: 1, redaction: { enabled: true, fields: ['email', 'phone', 'authorization', 'apiKey'] } },
      'trace2test.cases.json': { cases: [] },
      '.github/workflows/trace2test.yml': `name: Trace2Test\non:\n  pull_request:\n  workflow_dispatch:\njobs:\n  regression:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - uses: shivarajugoud/trace2test@v0.2.1\n        with:\n          cases: trace2test.cases.json\n          base-url: \${{ secrets.TRACE2TEST_BASE_URL }}\n          repeats: '3'\n`,
    };
    const results = await Promise.all(Object.entries(files).map(async ([path, value]) => ({ path, created: await writeNew(path, value, options.force) })));
    for (const result of results) console.log(`${result.created ? 'Created' : 'Kept existing'} ${result.path}`);
  }
  else if (command === 'mine') { const traces = normalizeTraces(await json(options.input)); const candidates = mineCandidates(traces, { threshold: Number(options.threshold ?? 0.5) }); console.log(`Promoted ${candidates.length} regression candidates → ${await output(options.out || '.trace2test/candidates.json', candidates)}`); }
  else if (command === 'stability') { const samples = await json(options.input); const records = analyseStability(Array.isArray(samples) ? samples : samples.samples, { passThreshold: Number(options['pass-threshold'] ?? 0.8) }); console.log(`Analysed ${records.length} test groups → ${await output(options.out || '.trace2test/stability.json', records)}`); }
  else if (command === 'export') { if (options.format !== 'promptfoo') throw new Error('Only `--format promptfoo` is currently supported.'); const candidates = await json(options.input); console.log(`Generated Promptfoo config → ${await output(options.out || 'promptfooconfig.generated.yaml', toPromptfoo(candidates))}`); }
  else if (command === 'report') { const candidates = await json(options.candidates); const stability = options.stability ? await json(options.stability) : []; console.log(`Generated report → ${await output(options.out || 'trace2test-report.md', markdownReport(candidates, stability))}`); }
  else if (command === 'run') {
    const payload = await json(options.input); const cases = Array.isArray(payload) ? payload : payload.cases;
    const run = await runApprovedCases(cases, { baseUrl: options['base-url'], repeats: Number(options.repeats ?? 3), timeoutMs: Number(options['timeout-ms'] ?? 10_000), passThreshold: Number(options['pass-threshold'] ?? 1) });
    console.log(`Replayed ${run.results.length} approved cases → ${await output(options.out || '.trace2test/run.json', run)}`);
    for (const record of run.stability) console.log(`${record.verdict.toUpperCase()} ${record.testId}: ${record.passed}/${record.runs} runs passed`);
    if (!run.passed) process.exitCode = 1;
  }
  else if (command === 'approve') {
    if (!options.input || !options.id || !options.path || !options.contains) throw new Error('approve requires --input, --id, --path, and a human-confirmed --contains assertion.');
    const candidates = await json(options.input); const candidate = candidates.find((item) => item.id === options.id);
    if (!candidate) throw new Error(`Candidate ${options.id} was not found.`);
    const target = options.out || 'trace2test.cases.json'; const existing = await exists(target) ? await json(target) : { cases: [] };
    const cases = Array.isArray(existing) ? existing : existing.cases || [];
    if (cases.some((item) => item.id === candidate.id)) throw new Error(`Case ${candidate.id} already exists in ${target}.`);
    const body = parseBody(options.body);
    const approved = {
      id: candidate.id, title: candidate.reason, approved: true, vars: { input: candidate.input },
      request: { method: options.method || 'POST', path: options.path, ...(body === undefined ? {} : { body }) },
      assertions: [{ type: 'status', equals: 200 }, { type: 'contains', value: options.contains }],
      source: { candidateId: candidate.id, traceIds: candidate.sourceTraceIds, observedFailure: candidate.reason },
    };
    console.log(`Approved ${candidate.id} → ${await output(target, { cases: [...cases, approved] })}`);
  }
  else throw new Error(`Unknown command: ${command}`);
} catch (error) { console.error(`trace2test: ${error.message}`); process.exit(1); }
