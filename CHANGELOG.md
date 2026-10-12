# Changelog

## v0.2.1 — Marketplace metadata

- Add GitHub Marketplace badge branding for the Trace2Test Action.

## v0.2.0 — HTTP regression runner

- Replay human-approved HTTP cases with deterministic response assertions.
- Repeat each case and classify results as `stable_pass`, `flaky`, `stable_fail`, or `error`.
- Exit non-zero only for stable failures and execution errors, making the CLI safe for CI.
- Add `init` to scaffold configuration, a case catalog, and a GitHub Actions workflow without overwriting files.
- Add `approve` to convert one mined candidate into a human-owned regression case.
- Add a local real-HTTP demo, banner, and contributor guide.
