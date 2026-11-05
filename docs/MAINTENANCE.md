# Maintenance: detection versus knowledge revision

Daily article arrival needs two processes. Structural reconciliation detects changed files, identity/metadata/link issues and explicit dependency impacts. Knowledge integration compares the new evidence with existing topics and proposes revised interpretations for economist review. A script does not replace the latter.

## Connected-note audit

Use [Zettel workflow / 한국어](ZETTEL_WORKFLOW.md) / [한국어 절차](ZETTEL_WORKFLOW_KO.md) for `scripts/zettel-audit.cjs`: read-only bounded snapshot checks for Ideas/Questions/summary-sidecars, current evidence/target hashes, quotes and explicit range/version coverage. Reports are create-only outside the snapshot. Descriptive native locators remain range/version-unverified; competing sidecars require owner appraisal, not automatic selection or re-pinning. This complements registry reconciliation; neither rewrites knowledge or grants approval.

## Standalone audit

```sh
node scripts/maintain-wiki.cjs --vault /absolute/vault --state-dir /private/external/registry --output /private/external/fresh-report.json
```

Add `--persist` to accept the scan as the new baseline. It persists derived state, not approval of every finding. First baseline is not today's new-article count. Use a fresh report path; do not put registry or output inside evidence folders. Inspect CLI help for optional index-state parameters. No network/model required for structural audit.

## Interpret results

Missing metadata: fill verified fields only. Duplicate candidates: inspect identity/version and Source/Literature pairs, never auto-merge. Broken links: find intended target. Orphans: add justified integration, not invented links. Changed dependency: reassess its actual content. Matching hashes: byte consistency, not scientific currency. Missing root schema/navigation: introduce or repair only with approved scope. Coverage limitations must accompany counts.

Dataset, policy or source changes should flag directly declared dependent records. Unrecorded semantic relationships can be missed. Dataset changes do not automatically rerun analyses. Changes in inspected material do not reverse economist decisions silently; preserve prior reviewed versions and propose bounded revisions.

## Material changes and preserved decisions

For the third-paper update and later revisions, default to one existing Topic plus index/log bookkeeping. Show old/proposed wording, located evidence and rationale; obtain authorization first. Preserve old bytes and bounded human decisions/receipts in a private non-indexed version archive, with a ledger/log reference. Set materially changed current content to `economist-review-needed`; archive/remove old current approval fields rather than copying or re-dating them. Fresh expert review is required for that new version. This is a helper/human workflow, not automatic maintenance or lint behavior. See the [run contract](AGENT_RUN_CONTRACT.md).

## After integration

Update index/log, refresh the dashboard and separately rebuild optional semantic search. Source changes alone do not regenerate Topic conclusions. Follow prompts/MAINTAIN.md and record unresolved work.

## Scheduling and backups

No schedule is installed by this kit. A technical helper may configure a script-only job after authorization with portable executable paths, bounded runtimes, locks, failure logs and local state. Obsidian report copying requires working desktop API access. A local report does not imply terminal/phone message delivery. Verify a manual run and later a clock-triggered run separately.

Keep actual reports, registry, PDFs, protected data, model caches and credentials private. The public/reusable construction repository contains none of them. Derived indexes are rebuildable, not evidence backups; test vault backup restoration separately.
