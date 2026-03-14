# M002: Model Registry Hardening and Real-Scenario Verification — Context

**Gathered:** 2026-03-14
**Status:** Queued — pending auto-mode execution.

## Project Description

Harden the models.dev registry path after M001 by doing a focused code review, improving code quality where the current design makes verification or maintenance brittle, repairing the build/test seams around the registry path, and adding more rigorous testing that replicates real startup and runtime scenarios as closely as practical.

## Why This Milestone

M001 established the core models.dev fetch/cache/snapshot/override flow, but much of its proof is contract-level or source-level rather than production-like. The current codebase still has build/test friction around this path, and the user wants stronger engineering hygiene plus testing that exercises real conditions instead of mostly mocked behavior. This milestone closes that trust gap before more registry-dependent work accumulates on top.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Trust that model registry startup behavior holds under realistic conditions: fresh install, cached startup, stale cache, version change, offline fallback, and local override scenarios.
- Run the model-registry-related test/build workflow and get stronger signal from it, including live models.dev verification in the main suite.

### Entry point / environment

- Entry point: `pi` CLI startup and model registry test/build workflows
- Environment: local dev, CI, and production-like temporary home/cache setups
- Live dependencies involved: models.dev API, local filesystem, build/test toolchain

## Completion Class

- Contract complete means: registry-path tests cover realistic lifecycle scenarios, failure modes, and diagnostics instead of only isolated unit behavior.
- Integration complete means: the model registry loads correct models across cache, snapshot, live fetch, and `models.json` override flows using the actual startup path and repaired test/build infrastructure.
- Operational complete means: the registry path is buildable/testable in normal project workflows, and live models.dev verification runs as part of the main suite by design.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Starting from a production-like temporary home directory with no cache exercises the real registry startup path and yields correct behavior for live fetch success, snapshot fallback, and local override application.
- Starting with valid cache, stale cache, and version-mismatched cache exercises the real startup path and yields the expected cache-hit, refresh, and fallback behavior without losing user overrides.
- The project’s standard build/test workflow can execute the registry-path verification without the current import/build failures, and the suite includes live models.dev coverage as an intentional part of main verification.

## Risks and Unknowns

- **Live models.dev tests in the main suite may be flaky** — Network or upstream instability can fail CI unless the scope defines clear expectations and diagnostics.
- **Quality cleanup may expose design seams beyond the registry module itself** — Fixing realistic verification may require nearby infrastructure changes in package builds, test loaders, or startup wiring.
- **Current milestone notes may overstate verification quality** — The follow-on work needs to reconcile what was claimed versus what actually runs today.

## Existing Codebase / Prior Art

- `packages/pi-coding-agent/src/core/model-registry.ts` — Actual startup path that chooses cache, snapshot, or built-in fallback and re-applies overrides.
- `packages/pi-coding-agent/src/core/model-registry.test.ts` — Existing registry integration tests, currently closer to source-level behavior than real startup scenarios.
- `packages/pi-ai/src/models-dev.ts` — Cache/fetch/orchestration code with current build and nullability seams that affect trust in the verification path.
- `src/resources/extensions/gsd/tests/resolve-ts.mjs` and `src/resources/extensions/gsd/tests/resolve-ts-hooks.mjs` — Prior art for TypeScript test execution and package-resolution behavior.

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R007 — Make the model registry path buildable and testable through standard project workflows.
- R008 — Verify model registry behavior through production-like startup scenarios, not just isolated unit tests.
- R009 — Add live models.dev verification to the main suite with clear expectations and diagnostics.
- R010 — Improve model-registry-path code quality where review findings reveal brittle or misleading behavior.

## Scope

### In Scope

- Code review of the M001 model registry path and adjacent test/build seams.
- Targeted refactors in registry-related code and nearby infrastructure where needed for correctness, observability, and maintainability.
- Production-like test scenarios using temporary home directories, cache files, snapshot fallback, version changes, offline/network-failure cases, and `models.json` overrides.
- Repair of current build/test issues that prevent trustworthy registry verification.
- Live models.dev checks included in the main test suite.
- Reconciliation of milestone documentation and proof claims if the implemented verification differs from what M001 artifacts currently imply.

### Out of Scope / Non-Goals

- Broad project-wide testing or code-quality cleanup unrelated to the model registry path.
- Reworking the product scope of M001’s registry feature itself.
- New registry features such as custom models.dev endpoints, UI status surfaces, or background polling.

## Technical Constraints

- Must preserve M001 user-facing behavior unless a defect is found and intentionally corrected.
- Real-scenario tests should use production-like filesystem and startup conditions rather than only deep mocks.
- Live models.dev verification belongs in the main suite because the user explicitly chose that tradeoff.
- Any diagnostics added for testability or failure analysis must avoid logging secrets.

## Integration Points

- **`@gsd/pi-ai`** — Supplies models.dev fetch/cache/snapshot primitives that need stronger build/test correctness.
- **`@gsd/pi-coding-agent` ModelRegistry** — Owns the startup integration path and override behavior under real scenarios.
- **Test/build toolchain** — TypeScript compilation, test loaders, and workspace package resolution may need repair for the registry path to be verifiable.
- **models.dev API** — Live verification target for upstream compatibility and real registry freshness.

## Open Questions

- How much of the broader package/test infrastructure must be repaired before the registry path can be considered truly hardened? — Expected answer: repair only what is necessary to make registry-path verification trustworthy and repeatable.
- How should live-test failures be reported and diagnosed in CI? — Current direction: keep them in the main suite and make failures explicit rather than silently downgraded.
