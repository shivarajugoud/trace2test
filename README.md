# Trace2Test

![Trace2Test banner](assets/trace2test-banner.svg)

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

## Adopt it in five minutes

Clone Trace2Test once, then run this from the repository you want to protect:

```bash
git clone https://github.com/shivarajugoud/trace2test.git
node /path/to/trace2test/src/cli.js init
```

It safely creates a config file, an empty approved-case catalog, and a GitHub Actions workflow without overwriting existing files. Then capture a production failure, mine it, and require a human to declare the expected behavior:

```bash
node /path/to/trace2test/src/cli.js mine --input traces.json --out .trace2test/candidates.json
node /path/to/trace2test/src/cli.js approve \
  --input .trace2test/candidates.json \
  --id t2t-abc123 \
  --path /answer \
  --method POST \
  --body '{"question":"{{input}}"}' \
  --contains "30 days"
```

`approve` deliberately requires `--contains`: a human owns the desired behavior. Trace2Test records the failing input as `{{input}}`, injects it into the HTTP request, and never promotes a model’s earlier output as the expected answer.

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

## Replay approved cases against a real HTTP service

Once a mined candidate has an owner-confirmed expected behavior, keep it as an approved case and replay it in CI. The runner uses Node's built-in `fetch`; it does not send data to a Trace2Test service.

```bash
# Runs the included HTTP service over a real localhost socket.
# It prints STABLE_FAIL for the intentionally broken build, then STABLE_PASS after the fix.
npm run demo:http

# In your own project, start your app, then run approved cases against it.
node src/cli.js run \
  --input examples/http-support-service/approved-cases.json \
  --base-url http://localhost:3000 \
  --repeats 3
```

An approved case is explicit about the HTTP call and assertions:

```json
{
  "id": "cancellation-refund-policy",
  "approved": true,
  "request": { "method": "GET", "path": "/answer" },
  "assertions": [
    { "type": "status", "equals": 200 },
    { "type": "json-path", "path": "answer", "contains": "30 days" }
  ]
}
```

`run` exits non-zero only for a stable failure or execution error. A mixed result is reported as `flaky` for investigation instead of becoming an accidental release block.

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
name: Trace2Test
on: [pull_request]
jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: shivarajugoud/trace2test@v0.2.1
        with:
          cases: trace2test.cases.json
          base-url: ${{ secrets.TRACE2TEST_BASE_URL }}
          repeats: "3"
```

The action writes these review artifacts:

- `.trace2test/candidates.json`
- `promptfooconfig.generated.yaml`
- `trace2test-report.md`
- `.trace2test/run.json`

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributor workflow and first contribution ideas.
