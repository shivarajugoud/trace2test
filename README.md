# Trace2Test

**Promote production LLM failures into reviewable regression tests.**

LLM teams collect traces, evaluator scores, and user corrections, but too often the feedback loop ends in a dashboard. Trace2Test is a provider-neutral CLI that finds failed or low-scored production traces, turns them into regression candidates, measures repeatability, and exports a reviewable Promptfoo configuration.

It is intentionally local-first: no keys, telemetry, or model provider are required for the first workflow.

## Why it exists

One production failure can be a product bug, a bad prompt, a retrieval miss, a model limitation, or a transient error. Re-running an entire LLM workflow repeatedly is expensive and hides the important question:

> Did we fix the failure, or did we get lucky once?

Trace2Test makes that question a concrete engineering loop.

```text
production traces + feedback
            ↓
regression candidates
            ↓
repeatability / flaky analysis
            ↓
Promptfoo-ready tests + Markdown report
```

## Quick start

Requires Node.js 20+.

```bash
git clone https://github.com/shivarajugoud/trace2test.git
cd trace2test
npm test

# Find bad traces and promote them to candidates.
node src/cli.js mine --input fixtures/traces.json

# Measure whether a candidate is stable or flaky across repeated attempts.
node src/cli.js stability --input fixtures/samples.json

# Create a Promptfoo configuration for human review.
node src/cli.js export --input .trace2test/candidates.json --format promptfoo

# Write a shareable report.
node src/cli.js report --candidates .trace2test/candidates.json --stability .trace2test/stability.json
```

## Commands

| Command | Purpose |
| --- | --- |
| `ingest` | Normalize a supported JSON trace export into a portable local format. |
| `mine` | Find errors, empty outputs, and low-feedback responses; deduplicate them into regression candidates. |
| `stability` | Classify repeated outcomes as `stable_pass`, `flaky`, `stable_fail`, or `error`. |
| `export` | Produce a reviewable Promptfoo YAML file. |
| `report` | Create a Markdown report for a pull request or incident review. |

## Try the complete failure-to-fix loop

This repository includes a small support-answer bot with a real business rule: a customer who cancels an annual plan within 30 days gets a full refund. The `broken` build omits that policy; the `fixed` build includes it. No model key is needed, so you can follow the whole product loop locally.

```bash
# 1. See the application-level regression fail on purpose (exit code 1).
npm run demo:broken

# 2. Capture the failed response as a production-style trace.
npm run demo:record

# 3. Use Trace2Test to mine the trace into a regression candidate.
npm run demo:mine

# 4. Run the corrected implementation against the same rubric.
npm run demo:fix

# Or print the entire lifecycle, including Promptfoo-ready output.
npm run demo:walkthrough
```

The important distinction is deliberate: `demo:broken` tests the product and fails; the repository test suite proves that Trace2Test *detects* that failure and that the corrected response passes the exact same rubric.

## Supported input shape

The normalizer accepts an array, a `{ "data": [...] }` wrapper, or a `{ "traces": [...] }` wrapper. It maps common fields such as `input`, `output`, `response`, `feedback`, `scores`, `error`, `latencyMs`, and `costUsd`.

```json
{
  "id": "trace-101",
  "input": "What is the cancellation policy?",
  "output": "It is probably flexible.",
  "feedback": -1,
  "latencyMs": 420,
  "costUsd": 0.0021
}
```

## GitHub Action

Use the repository as an action after publishing it:

```yaml
      - uses: shivarajugoud/trace2test@main
  with:
    traces: exports/latest-traces.json
    threshold: "0.5"
```

The action writes these review artifacts:

- `.trace2test/candidates.json`
- `promptfooconfig.generated.yaml`
- `trace2test-report.md`

## Principles

- A mined candidate is **not** ground truth; review expected behaviour before adding a release gate.
- Trace collection and evaluation should be separable, so teams can re-evaluate cached outputs without paying to replay a full workflow.
- A single pass/fail is insufficient for nondeterministic systems; record pass rate and variance.
- Do not store secrets or raw sensitive production data in a test repository.

## Roadmap

- Native adapters for Langfuse, LangSmith, OpenTelemetry, and Promptfoo artifacts
- Redaction and PII-safe candidate snapshots
- GitHub PR annotations and a `flaky` release-gate mode
- Pluggable evaluator contracts and cached-output re-evaluation

## Development

```bash
npm run lint
npm test
```

Contributions are welcome. Start with a failing fixture and test; keep provider-specific code behind a small adapter.
