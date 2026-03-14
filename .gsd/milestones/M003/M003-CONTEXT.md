# M003: Upstream Reconciliation and PR Preparation — Context

**Gathered:** 2026-03-14
**Status:** Queued — pending auto-mode execution.

## Project Description

Reconcile the local milestone work with the current `gsd-build/gsd-2` upstream state, merge in upstream changes from `origin/main`, preserve the implemented behavior from M001 and the completed M002 work, and update the codebase where necessary to align with upstream design decisions so the combined result is ready for a clean pull request.

## Why This Milestone

M001 and M002 introduce substantial local changes on top of an upstream codebase that has continued moving. Before the registry work can be proposed upstream, the branch needs a deliberate reconciliation pass: merge the latest upstream state, resolve conflicts without regressing the milestone work, proactively align local implementation choices with upstream conventions where that improves maintainability or reviewability, and leave the branch in a verified PR-ready state.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Diff the milestone branch against current upstream and see a coherent, reviewable set of changes that preserves the intended M001 and M002 behavior.
- Run the project’s verification workflow on the reconciled branch and get green signal before manually opening a PR to `gsd-build/gsd-2`.

### Entry point / environment

- Entry point: local git branch and project verification workflows
- Environment: local dev, git merge/rebase workflows, production-like verification commands
- Live dependencies involved: `origin/main` from `gsd-build/gsd-2`, local filesystem, project build/test toolchain

## Completion Class

- Contract complete means: milestone artifacts define the upstream target, preserved behavior, alignment expectations, and verification surface clearly enough to implement reconciliation without ambiguity.
- Integration complete means: the local milestone branch incorporates current upstream `origin/main`, preserves M001 and completed M002 behavior, and resolves design mismatches intentionally rather than accidentally.
- Operational complete means: the reconciled branch passes the relevant build/test verification and is locally ready to turn into a pull request without further restructuring.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Merging or rebasing against current `origin/main` retains the intended M001 registry behavior and the finalized M002 hardening work, with conflicts resolved and verified rather than hand-waved.
- Any code or test changes needed to align with upstream design decisions are applied intentionally and leave the resulting diff coherent for review.
- The reconciled branch finishes with green verification on the relevant workflows and is locally PR-ready, while the actual GitHub PR creation remains a separate explicit user-approved action.

## Risks and Unknowns

- **Upstream reconciliation may expose hidden assumptions in M001/M002** — Behavior that passed locally before merge may fail once upstream changes alter neighboring code paths, tests, or packaging expectations.
- **"Align with upstream design decisions" can expand scope if left vague** — The milestone needs discipline to distinguish worthwhile convention alignment from unnecessary rewrite churn.
- **PR-readiness depends on reviewability, not just a successful merge** — A technically correct merge can still leave a noisy or confusing diff that is hard to upstream cleanly.

## Existing Codebase / Prior Art

- `packages/pi-ai/src/models-dev.ts` — Core M001 registry-fetch path that must survive upstream reconciliation without losing intended fallback and cache behavior.
- `packages/pi-coding-agent/src/core/model-registry.ts` — Startup integration point where M001 and M002 behavior must remain correct after upstream merge/alignment.
- `.gsd/milestones/M001/` and `.gsd/milestones/M002/` — Authoritative local milestone intent, acceptance criteria, and decisions that M003 must preserve while reconciling.
- `origin/main` (`gsd-build/gsd-2`) — Upstream source of truth to merge and align against for PR preparation.

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R007 — M003 must preserve the trustworthy build/test workflow established by M002 after upstream reconciliation.
- R008 — M003 must preserve the production-like registry verification coverage while integrating upstream changes.
- R009 — M003 must keep live models.dev verification intact through the upstream merge/alignment.
- R010 — M003 may consume the hardened registry-path cleanup from M002 but should not regress it.
- R011 — Primary requirement: reconcile local milestone work with current upstream `origin/main` while preserving intended behavior.
- R012 — Primary requirement: leave the reconciled branch in a verified, locally PR-ready state.

## Scope

### In Scope

- Fetch and integrate the latest upstream `origin/main` changes from `gsd-build/gsd-2` into the local milestone branch.
- Resolve merge/rebase conflicts while preserving the intended outcomes of M001 and completed M002 work.
- Proactively align local implementation and tests to upstream conventions where that materially improves correctness, maintainability, or reviewability.
- Update code, tests, and milestone-owned artifacts as needed to keep the reconciled result coherent and verifiable.
- Run the relevant build/test verification needed to declare the reconciled branch locally PR-ready.
- Prepare the branch for a future PR without performing the GitHub-side PR creation.

### Out of Scope / Non-Goals

- Opening, updating, or merging the GitHub pull request as part of this milestone.
- Broad opportunistic refactors unrelated to upstream reconciliation or PR readiness.
- Rewriting milestone history solely for aesthetics if the current branch can be made reviewable without it.

## Technical Constraints

- Must use current `origin/main` as the upstream merge target.
- Must preserve M001 behavior and the completed outputs of M002 unless a verified defect requires intentional change.
- Alignment to upstream design choices should be proactive but bounded to changes that materially improve compatibility, correctness, or reviewability.
- Verification must include the relevant project workflows; a conflict-free merge alone is not sufficient.
- No outward-facing GitHub action is permitted without later explicit user confirmation.

## Integration Points

- **`origin/main` / `gsd-build/gsd-2`** — Upstream branch whose current state and conventions define the reconciliation target.
- **M001 registry implementation** — Feature work that must remain intact and reviewable after upstream integration.
- **M002 hardening work** — In-progress prerequisite whose final completed state M003 depends on and must preserve.
- **Build/test toolchain** — Final verification surface for proving the branch is PR-ready rather than merely merged.

## Open Questions

- Should PR-readiness eventually include a reviewer-facing reconciliation summary even if it is not required for queueing? — Current direction: no; done means green, reviewable branch, with optional PR narrative left for later if needed.
