import { analyseStability } from './core.js';

function asArray(value) { return Array.isArray(value) ? value : []; }

function getPath(value, path) {
  return String(path || '').split('.').filter(Boolean).reduce((current, key) => current?.[key], value);
}

function responseText(body) {
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function evaluateAssertions({ status, body }, assertions) {
  const failures = [];
  const text = responseText(body);
  for (const assertion of asArray(assertions)) {
    if (assertion.type === 'status' && status !== Number(assertion.equals)) failures.push(`expected status ${assertion.equals}, received ${status}`);
    if (assertion.type === 'contains' && !text.includes(String(assertion.value))) failures.push(`response must contain ${JSON.stringify(assertion.value)}`);
    if (assertion.type === 'not-contains' && text.includes(String(assertion.value))) failures.push(`response must not contain ${JSON.stringify(assertion.value)}`);
    if (assertion.type === 'json-path') {
      const actual = getPath(body, assertion.path);
      if ('equals' in assertion && actual !== assertion.equals) failures.push(`expected ${assertion.path} to equal ${JSON.stringify(assertion.equals)}, received ${JSON.stringify(actual)}`);
      if ('contains' in assertion && !String(actual ?? '').includes(String(assertion.contains))) failures.push(`expected ${assertion.path} to contain ${JSON.stringify(assertion.contains)}`);
    }
  }
  return failures;
}

function endpointFor(testCase, baseUrl) {
  const path = testCase.request?.path || testCase.request?.url;
  if (!path) throw new Error(`Case ${testCase.id || 'unknown'} needs request.path or request.url.`);
  return new URL(path, baseUrl).toString();
}

async function replayOnce(testCase, { baseUrl, fetchImpl, timeoutMs }) {
  const startedAt = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const request = testCase.request || {};
    const headers = { ...(request.headers || {}) };
    const init = { method: request.method || 'GET', headers, signal: controller.signal };
    if (request.body !== undefined) {
      init.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (!headers['content-type']) headers['content-type'] = 'application/json';
    }
    const response = await fetchImpl(endpointFor(testCase, baseUrl), init);
    clearTimeout(timer);
    const raw = await response.text();
    let body = raw;
    try { body = raw ? JSON.parse(raw) : null; } catch { /* text response */ }
    const failures = evaluateAssertions({ status: response.status, body }, testCase.assertions);
    return { passed: failures.length === 0, score: failures.length === 0 ? 1 : 0, status: response.status, latencyMs: Math.round(performance.now() - startedAt), failures };
  } catch (error) {
    return { passed: false, score: 0, latencyMs: Math.round(performance.now() - startedAt), error: error.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : error.message, failures: [] };
  }
}

export async function runApprovedCases(cases, { baseUrl, fetchImpl = fetch, repeats = 3, timeoutMs = 10_000, passThreshold = 1 } = {}) {
  if (!Array.isArray(cases) || !cases.length) throw new Error('Run input must contain at least one approved case.');
  if (!baseUrl) throw new Error('A base URL is required (for example, http://localhost:3000).');
  const samples = [];
  const results = [];
  for (const testCase of cases) {
    if (testCase.approved !== true) continue;
    if (!testCase.id) throw new Error('Every approved case needs an id.');
    const runs = [];
    for (let run = 1; run <= repeats; run += 1) {
      const result = await replayOnce(testCase, { baseUrl, fetchImpl, timeoutMs });
      runs.push({ run, ...result });
      samples.push({ testId: testCase.id, passed: result.passed, score: result.score, error: result.error });
    }
    results.push({ id: testCase.id, title: testCase.title || testCase.id, runs });
  }
  const stability = analyseStability(samples, { passThreshold });
  const failing = stability.filter((record) => record.verdict === 'stable_fail' || record.verdict === 'error');
  return { results, stability, passed: failing.length === 0, failing };
}
