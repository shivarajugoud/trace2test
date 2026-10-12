#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { analyseStability, markdownReport, mineCandidates, normalizeTraces, toPromptfoo } from './core.js';

const help = `Trace2Test — turn production LLM failures into regression candidates

Commands:
  ingest --input traces.json [--out .trace2test/traces.json]
  mine --input traces.json [--out .trace2test/candidates.json] [--threshold 0.5]
  stability --input samples.json [--out .trace2test/stability.json] [--pass-threshold 0.8]
  export --input candidates.json --format promptfoo [--out promptfooconfig.yaml]
  report --candidates candidates.json [--stability stability.json] [--out trace2test-report.md]
`;

function args(argv) { const result = { _: [] }; for (let i = 0; i < argv.length; i += 1) { const value = argv[i]; if (value.startsWith('--')) result[value.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; else result._.push(value); } return result; }
async function json(path) { return JSON.parse(await readFile(resolve(path), 'utf8')); }
async function output(path, value) { const target = resolve(path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); return target; }

const options = args(process.argv.slice(2));
const command = options._[0];
if (!command || options.help) { console.log(help); process.exit(command ? 0 : 1); }
try {
  if (command === 'ingest') { const traces = normalizeTraces(await json(options.input)); console.log(`Normalized ${traces.length} traces → ${await output(options.out || '.trace2test/traces.json', traces)}`); }
  else if (command === 'mine') { const traces = normalizeTraces(await json(options.input)); const candidates = mineCandidates(traces, { threshold: Number(options.threshold ?? 0.5) }); console.log(`Promoted ${candidates.length} regression candidates → ${await output(options.out || '.trace2test/candidates.json', candidates)}`); }
  else if (command === 'stability') { const samples = await json(options.input); const records = analyseStability(Array.isArray(samples) ? samples : samples.samples, { passThreshold: Number(options['pass-threshold'] ?? 0.8) }); console.log(`Analysed ${records.length} test groups → ${await output(options.out || '.trace2test/stability.json', records)}`); }
  else if (command === 'export') { if (options.format !== 'promptfoo') throw new Error('Only `--format promptfoo` is currently supported.'); const candidates = await json(options.input); console.log(`Generated Promptfoo config → ${await output(options.out || 'promptfooconfig.generated.yaml', toPromptfoo(candidates))}`); }
  else if (command === 'report') { const candidates = await json(options.candidates); const stability = options.stability ? await json(options.stability) : []; console.log(`Generated report → ${await output(options.out || 'trace2test-report.md', markdownReport(candidates, stability))}`); }
  else throw new Error(`Unknown command: ${command}`);
} catch (error) { console.error(`trace2test: ${error.message}`); process.exit(1); }
