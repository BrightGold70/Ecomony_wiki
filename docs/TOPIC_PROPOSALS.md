# Human-controlled Topic revision proposals

The local synchronous engine revises **one existing** canonical `economy_wiki/Topics/**/*.md` per proposal. It reads only compiled `economy_wiki/Sources` or `economy_wiki/Literature` as evidence. It never generates acceptance, executes text, contacts a network, authenticates an economist or validates causal identification. An exact quote being present does not prove proposed wording is scientifically supported.

## Dashboard

Set local plugin `repositoryPath` to the explicit absolute economics checkout path (a trusted local executable-code boundary). Open **Topic revision proposals**, paste proposal JSON, and choose **Preview proposal — read only**. The preview shows exact old/new wording, reasons, quotes, optional locators, source/target/proposal/inspection hashes, automatic metadata effects and a nonaccepting decision template as literal JSON text. Select accept/reject **individually for every change**, then check the fresh confirmation and deliberately click **Apply explicit decisions**. No approve-all/default acceptance exists. Input edits, new previews, decision changes and replacing the panel invalidate confirmation; closed/detached handlers cannot apply. Apply revalidates all bytes/bindings and reports the persisted receipt or incomplete observation. Refresh the dashboard afterward. No provider is used; semantic preview controls remain independent.

## API and CLI

```js
const {DOMAIN, inspectProposal, applyProposal} = require('../scripts/topic-proposals.cjs');
const preview = inspectProposal({vaultRoot, proposal}); // reads only
const decisions = preview.decisionTemplate; // placeholders, NOT acceptance
// Human explicitly sets each decision to accept or reject after inspecting.
const receipt = applyProposal({vaultRoot, proposal, decisions});
```

```sh
node scripts/topic-proposals.cjs preview --vault /absolute/vault --proposal proposal.json
node scripts/topic-proposals.cjs apply --vault /absolute/vault --proposal proposal.json --decisions decisions.json
```

`vaultRoot` is an absolute lexical-canonical non-symlink vault directory, not the economy_wiki subtree. Existing safe-fs guards check every ancestor and read through O_NOFOLLOW. Targets, sources, history and CLI JSON reject symlinks. Relative wiki paths reject traversal, backslashes, hidden/private/personal/secrets/raw components. This is not a sandbox against adversarial concurrent local pathname changes. DOMAIN is frozen, not caller-selectable. Unknown/duplicate/missing CLI flags and traversal-bearing paths fail closed; JSON errors go to stderr with nonzero exit. No shell, network or approve-all switch.

## Proposal JSON v1

```json
{
  "version": 1,
  "id": "synthetic-revision-1",
  "targetPath": "economy_wiki/Topics/example.md",
  "beforeSha256": "<lowercase SHA256 of exact original bytes>",
  "changes": [{
    "id": "qualification-1",
    "before": "Exact old body wording.",
    "after": "Proposed qualified wording.",
    "reason": "Explain evidence versus interpretation and applicability changes.",
    "evidence": [{
      "path": "economy_wiki/Sources/example.md",
      "quote": "Exact passage in the compiled source.",
      "locator": "Table 2, column (4); printed p. 9"
    }]
  }]
}
```

Unknown schema fields fail. IDs match `^[a-z0-9][a-z0-9-]{0,79}$`. There must be 1–100 unique changes. Each nonempty before appears **exactly once** in original UTF-8 body; original intervals cannot overlap. After/reason are nonempty; after differs from before. Replacements use original offsets, not cascading substitution. Frontmatter edits are forbidden. Invalid UTF-8, malformed/unsupported metadata, duplicate top-level keys and aliases/tags/merge keys fail closed. Only flat mappings with simple unquoted top-level keys and single-line plain or quoted scalar values are supported. Indented fields/continuations, nested mappings, collections and block scalars fail closed before any history/target writes. The narrow metadata parser is not general YAML.

Each change needs an existing canonical compiled Markdown evidence path and nonempty exact quote. Raw/private files and Topics-as-evidence are denied. Optional locator text is displayed but not independently pagination-validated. All evidence hashes bind inspection, **including rejected changes' evidence**.

## Bound decisions

Copy the preview template and explicitly replace every placeholder:

```json
{
  "version": 1,
  "proposalSha256": "<from preview>",
  "inspectionSha256": "<from preview>",
  "decisions": [{"id": "qualification-1", "decision": "accept"}]
}
```

Every change has exactly one accept/reject; missing, duplicate, unknown and placeholder values fail. Proposal and decisions hashes are UTF-8 `JSON.stringify` hashes, including object property order, not input JSON whitespace. Inspection hash binds proposal, exact target and changes with current evidence hashes. Hashes are **not signatures**, identity checks or trusted timestamps. Whoever can replace both data and bindings can forge declarations.

Apply checks schema, target hash, exact quotes and both decision bindings; rechecks source/target inspection after preparing history and target immediately before rename. Changed target/source (even with the quote still present), proposal or decisions requires fresh inspection and decisions.

## Effects and recovery

Any accepted change sets type topic and review_status **economist-review-needed**. Prior keys starting review/economist/approved/approval are removed from current metadata; unsupported continuation lines fail closed. Only original parsed frontmatter supplies retained metadata: replacement text stays body text even when it begins with `---` and metadata-like lines on a previously bare note; unrelated metadata/body are retained except accepted edits (frontmatter formatting may normalize). Old review remains attached to exact old bytes in before.md, never silently transferred. External review receipts remain untouched and become stale on changed bytes. All-reject still records decisions/history but preserves target bytes **and inode**, without normalization/rename.

Exclusive history:

```text
economy_wiki/Review/proposals/<safe-proposal-id>/
  journal.json       immutable prepared intent and planned hashes
  before.md          exact original including historical approval metadata
  proposal.json
  decisions.json
  inspection.json
  receipt.json       complete only after target read-back
  incomplete.json    best-effort caught-failure observation
```

IDs cannot be reused, including rejection-only/incomplete attempts. Never delete history to retry. A per-target exclusive directory lock coordinates engine writers. Only single-target replacement is atomic: exclusive fsynced same-directory temporary file then rename. **History/target/receipt are not a multi-file transaction**; power-loss directory durability is not promised. Crashes can leave reserved IDs, journal, partial receipt, temp or lock. Receipts do not prove no later edits.

Caught failures after reservation throw `code: PROPOSAL_INCOMPLETE` with observed hash, targetWritten and targetState (unchanged, matches-planned-after, unknown); best-effort incomplete.json takes precedence over a partial receipt. Receipt writing can fail **after successful target replacement**. Inspect original, journal, decisions, all hashes, incomplete marker, receipt and actual target before manual reconciliation; never infer rollback or blindly reapply. Hard-crash locks require manual investigation after confirming no writer runs. No automatic rollback/recovery.

The engine edits one Topic and its exclusive history only. It does **not** update index/log; after authorized integration the helper must perform that separate bookkeeping. This is a bounded revision mechanism, not autonomous synthesis or an expert-review workflow.

## Lock cleanup outcomes

Lock cleanup cannot replace a primary application error. If application and
receipt persistence completed but cleanup failed, the engine throws
`code: PROPOSAL_CLEANUP_FAILED` with `.receipt` equal to the persisted **complete**
receipt; this does not mean rollback or incomplete application. If application
already failed, the original error/code and incomplete receipt are preserved.
Both cases attach `.cleanupWarning` with `code: PROPOSAL_LOCK_CLEANUP_FAILED`,
`lockPath`, observed `lockState` (`present`, `absent`, or `unknown`), and the cleanup
error. CLI stderr includes code, receipt and cleanupWarning, with nonzero exit.
Cleanup warnings do not rewrite immutable receipts or add an incomplete marker to
an otherwise complete application.

Cleanup checks the acquired lock's device/inode identity and refuses to remove a
replacement lock. Preexisting locks are not acquired or removed. Failed cleanup
can leave a stale lock: investigate it and actual target/history state manually;
do not blindly retry or automatically delete it. These pathname checks still
require the documented non-adversarial local filesystem assumption.

## Verification

Synthetic fixtures only: `npm test`, `npm run test:python`, `npm run build`. Proposal tests cover stale/tampered bindings, quote/offset/overlap validation, malformed schema/metadata, symlink ancestors, CLI, mixed/all-reject outcomes, immutable history, metadata reset and injected journal/backup/rename/receipt failures. Source and actual generated-bundle VM tests exercise exact literal preview, per-change choices, explicit confirmation/apply, stale evidence and disabled detached handlers. No live vault or native desktop acceptance is claimed.
