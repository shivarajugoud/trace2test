import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runApprovedCases } from '../src/runner.js';
import { supportHandler } from '../examples/http-support-service/service.js';

const execFileAsync = promisify(execFile);

const cases = [{
  id: 'refund-window', approved: true, request: { path: '/answer' },
  assertions: [{ type: 'status', equals: 200 }, { type: 'json-path', path: 'answer', contains: '30 days' }, { type: 'json-path', path: 'answer', contains: 'full refund' }],
}];

async function withServer(mode, callback) {
  const server = createServer(supportHandler({ mode }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { return await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('replays an approved HTTP case and blocks stable failures', async () => {
  const result = await withServer('broken', (baseUrl) => runApprovedCases(cases, { baseUrl, repeats: 3 }));
  assert.equal(result.passed, false);
  assert.equal(result.stability[0].verdict, 'stable_fail');
  assert.match(result.results[0].runs[0].failures[0], /30 days/);
});

test('replays an approved HTTP case successfully after the application fix', async () => {
  const result = await withServer('fixed', (baseUrl) => runApprovedCases(cases, { baseUrl, repeats: 3 }));
  assert.equal(result.passed, true);
  assert.equal(result.stability[0].verdict, 'stable_pass');
});

test('the CLI reports a passing approved HTTP case', async () => {
  await withServer('fixed', async (baseUrl) => {
    const { stdout } = await execFileAsync(process.execPath, [
      'src/cli.js', 'run', '--input', 'examples/http-support-service/approved-cases.json',
      '--base-url', baseUrl, '--repeats', '2', '--out', '.trace2test/cli-test-run.json',
    ], { cwd: process.cwd() });
    assert.match(stdout, /STABLE_PASS cancellation-refund-policy: 2\/2 runs passed/);
  });
});

test('interpolates approved-case variables into an HTTP request body', async () => {
  let receivedBody;
  const fetchImpl = async (_, init) => {
    receivedBody = JSON.parse(init.body);
    return { status: 200, text: async () => JSON.stringify({ answer: 'ok' }) };
  };
  const [result] = (await runApprovedCases([{
    id: 'templated-request', approved: true, vars: { input: 'refund policy' },
    request: { method: 'POST', path: '/answer', body: { question: '{{input}}' } },
    assertions: [{ type: 'status', equals: 200 }, { type: 'json-path', path: 'answer', equals: 'ok' }],
  }], { baseUrl: 'https://example.test', fetchImpl, repeats: 1 })).results;
  assert.equal(receivedBody.question, 'refund policy');
  assert.equal(result.runs[0].passed, true);
});
