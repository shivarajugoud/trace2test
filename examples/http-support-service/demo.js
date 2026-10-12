#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { runApprovedCases } from '../../src/runner.js';
import { supportHandler } from './service.js';

const cases = JSON.parse(await readFile(new URL('./approved-cases.json', import.meta.url), 'utf8'));

async function runBuild(mode) {
  const server = createServer(supportHandler({ mode }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { return await runApprovedCases(cases, { baseUrl: `http://127.0.0.1:${port}`, repeats: 3 }); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

for (const mode of ['broken', 'fixed']) {
  const result = await runBuild(mode);
  const [record] = result.stability;
  console.log(`${mode.toUpperCase()}: ${record.verdict} (${record.passed}/${record.runs} runs passed)`);
  if (mode === 'broken') console.log(`  Example failure: ${result.results[0].runs[0].failures[0]}`);
}
