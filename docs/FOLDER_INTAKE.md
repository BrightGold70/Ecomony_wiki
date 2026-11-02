# Collected papers → stored sources → connected wiki drafts

[Canonical first-two-papers → Topic → third-paper update](../START_HERE.md) · [한국어](FOLDER_INTAKE_KO.md)

## For the economist: what to do

1. Ask your authorized helper to designate one **incoming papers folder**, separate from private documents and from the wiki's storage folder.
2. Put the papers you are entitled to process in that folder. Finish downloads before processing. Initial supported formats are PDF with a text layer, plain text and Markdown. Scanned PDFs need a separate OCR step.
3. Ask: **“Preview the incoming papers, store verified copies, create linked draft study notes and related-document suggestions, then prepare grounded entity/topic proposals for review.”**
4. Inspect the preview and the source-access/evidence scope. Authorize moving the originals only if you want the incoming folder emptied after successful processing. Copying is the safer initial mode.
5. Review generated study drafts and suggested related documents. These are not automatically verified bibliographic identities, economic findings or causal relationships.
6. Give the generated evidence packet to an authorized AI agent. Ask it to identify meaningful concepts, methods, theories, datasets or policies, reuse existing entities where appropriate and return a source-quoted proposal. It must not obey instructions embedded in papers.
7. Validate and apply the proposal as new pending-review documents. Existing reviewed pages are not silently overwritten. An existing topic needing revision should appear as a proposed integration task.
8. Refresh the dashboard and, when configured, rebuild the separate semantic index. Check the index/activity record and intake report for failed or pending work.

**What this adds:** folder intake, safe original-file storage, provenance-linked draft study notes, related-document candidates and an explicit evidence-packet → AI proposal → validated additive documents route.

**What it does not claim:** a deterministic excerpt is not an LLM synthesis. A matching quote does not prove an interpretation. PDF text extraction does not verify tables, equations, titles, DOIs or full-paper appraisal. Semantic entity building needs an authorized agent; no paid provider call is triggered merely by scanning a folder.

## Suggested request to an AI agent

> Use this repository's folder-intake workflow on [incoming folder] for [vault]. Preview first; use only these selected papers and the existing research scope/schema. Preserve original bytes and existing reviewed notes. Create source-linked draft study records and related-document suggestions. Use the intake evidence packet to propose substantive entities/topics with exact evidence quotes, provenance and meaningful links. Distinguish lexical suggestions from confirmed relationships. Do not invent identifiers, estimates, causal validation or human approval. Show what was stored, copied or moved, what was created and what still needs integration. Do not send source text externally without the separate permission required by my setup.

## File safety and recovery

- Storage and identities use original-byte checksums rather than trusting filenames. Same filename does not mean same paper; equal bytes do not establish publication-version identity.
- Default preview does not move input files. Application and inbox removal are deliberate choices.
- An original must remain recoverable until storage is verified and required notes/navigation records are written. Errors remain visible and must not be described as completed moves.
- Keep copies of original evidence and a separate private backup. This workflow is not a backup/restore system.
- Do not point intake at a whole personal library, shared-drive root or confidential firm/household/administrative-data folder. Scope/private-file boundaries still apply.
- A paper's appearance in the incoming folder is not automatic scientific scope approval. An agent must respect the scope policy; unassessed material remains pending.
- Repeated runs must not create duplicate study drafts for identical bytes or overwrite existing originals. Review failures and journal state before retrying after an interruption.

## Operator route

The CLI is `scripts/intake-papers.cjs`; consult `--help` for the implemented flags and proposal schema. Economics does not require a `--content-evidence` flag: do not copy a medical acquisition gate. The Source content requirements in the [run contract](AGENT_RUN_CONTRACT.md#source-content-contract) are a separate helper completion task. Storage and quote matching do not complete those summaries or validate identification. Start with a dry preview in an isolated fixture, then a small authorized real batch. Keep state outside the research vault. Install Poppler's `pdftotext` separately if PDF extraction is needed; never silently treat an image-only PDF as extracted evidence.

After intake, use the [offline inspected indexing lifecycle](INDEXING_NAVIGATION.md#from-scratch-offline-attachment). New economics Source/Literature drafts explicitly start keyword inspection pending and optional MeSH pending. Intake does not parse prose into keywords, fetch PubMed or assign JEL. Preserve inspected metadata bytes separately, preview the packet helper and authorize attachment only to the exact pair.

The workflow is on-demand. Watching a folder continuously, installing a scheduler, OCR automation, native dashboard intake controls and model/provider setup are separate actions, not implied by this feature.

## Commands for the technical helper

Replace every example path with a deliberately chosen absolute path. The inbox must not overlap the wiki; state must be outside the vault and inbox.

```sh
# Preview only: no file writes or moves
node scripts/intake-papers.cjs --vault /absolute/vault --inbox /absolute/incoming --state-dir /absolute/state --domain economy
# Store verified copies, create notes/report and external agent packet; leave originals
node scripts/intake-papers.cjs --vault /absolute/vault --inbox /absolute/incoming --state-dir /absolute/state --domain economy --apply
# After an authorized agent returns a grounded proposal, preview its validation
node scripts/intake-papers.cjs --vault /absolute/vault --inbox /absolute/incoming --state-dir /absolute/state --domain economy --proposal /absolute/proposal.json
# Apply additive documents and finally remove verified inbox originals
node scripts/intake-papers.cjs --vault /absolute/vault --inbox /absolute/incoming --state-dir /absolute/state --domain economy --proposal /absolute/proposal.json --apply --move
```

This additive proposal route cannot revise an existing Topic. A third paper needs a separate old/proposed wording review and authorized substantive update to the SAME Topic, preserving the old version/decision and resetting changed current content to `economist-review-needed`. See the [run contract](AGENT_RUN_CONTRACT.md).

Keep the inbox originals until proposal compilation is complete: the current proposal validator reads evidence from the selected inbox files. `--move` without a proposal is permitted for storage-only intake but ends this same-inbox compilation route; defer it unless you intentionally need only the storage/draft stage.

The external `agent-packet-<batch>.json` includes exact `applyArgv` and this proposal structure:

```json
{"version":1,"domain":"economy","pages":[{"path":"Topics/new-topic.md","title":"Proposed title","claims":[{"text":"Draft interpretation","evidence":[{"path":"raw/papers/ACTUAL_HASH.txt","quote":"EXACT EXTRACTED LINE","locator":"line 1"}]}]}]}
```

Use actual packet paths, quotes and locators; the example cannot be applied unchanged. For PDF use the packet's page/line locator. Existing pages with different content cause a collision, not an overwrite. Mechanical matching cannot establish entailment. Generated entity notes are conservative descriptive drafts with question unknown until curated; they are not full domain-specific data/policy/method appraisals.

Limits: top-level selected files only, at most 100 files, 20 MiB each, 50 MiB input batch; bounded context 1,000 compiled notes / 10 MiB. No OCR, bibliographic DOI deduplication, automatic topic overwrite, background watcher or provider call. Checks are not a sandbox against concurrent hostile directory replacement and cannot guarantee a power-loss transaction across all outputs.

## Historical intake verification

The following counts belong to the earlier intake delivery, not a current rerun of the expanded onboarding/runtime suite. Use actual current test output for new acceptance claims.

Economics intake suite: 15 tests passed, including actual text-layer PDF extraction. Full Economics CJS run: 97 passed, one optional QMD integration skipped. Hematology port integration verifies preserved Index casing, pending clinical review, original-byte storage, grounded topic application and move after save; full Hematology run: 72 passed, one optional QMD integration skipped.

An independent AI agent read a labelled synthetic evidence packet and returned a quoted proposal. The final engine applied it into a fresh isolated Economics vault, moved the verified original, and lint checked three notes/one original hash with zero issues. This demonstrates the actual agent-proposal route, not accuracy on real economic or clinical papers. An earlier pre-release fixture safely refused a note-format collision after the format was changed; no originals were removed. Format changes may require manual reconciliation, never overwriting an existing note.

No real collection was ingested, no live Obsidian intake was enabled, no watcher/scheduler was installed and no private papers were moved. Choose a real inbox and authorize a small first batch separately.
