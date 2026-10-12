# Contributing to Trace2Test

Thanks for helping make LLM regressions easier to reproduce.

## Development

Requires Node.js 20+.

```bash
npm test
npm run lint
```

Start with a failing fixture or an approved-case test. Provider integrations must keep raw production data local by default and should normalize into the portable trace shape before touching candidate logic.

## Pull requests

- Keep changes dependency-free unless a dependency substantially improves safety or interoperability.
- Add tests for new assertions, adapters, or CLI commands.
- Never add real user prompts, secrets, or production traces to the repository.
- Explain whether a failure should be a release block (`stable_fail`) or a warning (`flaky`).

## Good first contributions

- Langfuse JSON export adapter
- OpenTelemetry trace adapter
- Additional deterministic assertions (`json-schema`, `regex`)
- PII redaction rules and fixtures
