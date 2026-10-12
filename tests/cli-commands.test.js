import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

test('init scaffolds safely and approve creates a human-gated replay case', async () => {
  const project = await mkdtemp(join(tmpdir(), 'trace2test-cli-'));
  try {
    const { stdout } = await execFileAsync(process.execPath, [cli, 'init'], { cwd: project });
    assert.match(stdout, /Created trace2test.config.json/);
    const config = JSON.parse(await readFile(join(project, 'trace2test.config.json'), 'utf8'));
    assert.equal(config.repeats, 3);
    const candidatePath = join(project, 'candidates.json');
    await writeFile(candidatePath, JSON.stringify([{ id: 't2t-refund', input: 'Can I get a refund?', reason: 'low feedback score (0)', sourceTraceIds: ['trace-1'] }]));
    await execFileAsync(process.execPath, [cli, 'approve', '--input', candidatePath, '--id', 't2t-refund', '--path', '/answer', '--contains', '30 days', '--body', '{"question":"{{input}}"}'], { cwd: project });
    const approved = JSON.parse(await readFile(join(project, 'trace2test.cases.json'), 'utf8'));
    assert.equal(approved.cases[0].approved, true);
    assert.equal(approved.cases[0].request.body.question, '{{input}}');
    assert.equal(approved.cases[0].assertions[1].value, '30 days');
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});
