# Economist guide — build knowledge without writing code

[한국어](ECONOMIST_GUIDE_KO.md) · [README](../README.md)

A prepared dashboard needs no coding for ordinary use. One-time setup still needs an authorized tool-using AI assistant or technical helper; a chat-only answer cannot install software. The kit starts empty.

## 1. Define a first question

Start narrowly: for example, how tariff changes affect bilateral merchandise trade. Choose geography, years, products, source types and exclusions. Use a separate research-only vault; confidential firm/household data stay outside by default.

Send your helper:

> Build this repository in a new research-only vault using FROM_SCRATCH and the agent contract. My question is [question]. I will choose initial sources. Explain local/external processing and costs; do not enable cloud uploads or recurring jobs without permission. Show one verified study, then a connected topic from a few papers. Run checks and tell me what actually works. Keep economist review pending.

## 2. Build the first knowledge, not just a PDF folder

Choose a few authorized papers. The agent checks exact identity/version and creates Sources and Literature notes. Ask it to extract the question, setting/sample, estimand, identification assumptions, specification/inference, estimates/uncertainty, limitations and exact table/page/column. Theory needs assumptions/propositions, not a forced regression template.

Link relevant Dataset, Policy, Method or Theory records. Ask for one Topic explaining what the papers jointly support and where they differ. Working-paper and published versions may be the same study. Shared samples must not be counted as independent confirmation.

Review the important original passages. Separate author claim, supporting evidence and your judgment. Approval of an extracted coefficient is not endorsement of a policy recommendation.

## 3. Use the dashboard

Open Obsidian in the prepared vault. Use Command+P on Mac (usually Control+P elsewhere), search the dashboard command containing “economy” and select it. If absent, ask the helper to verify plugin activation.

Type a simple term such as `tariff`, `gravity` or `DiD`; read the title and stored findings, then open the complete note/source. A missing result means it was not retrieved from this collection, not that no literature exists. Reset search clears the current search/comparison state.

Use the comparison selection under result cards and **Compare selected** for side-by-side reading. Compare estimands, countries, periods, data versions and inference—not just coefficient size.

Use **Graphical paper links** to inspect recorded links and suggested similarities. Similarity is not agreement, causality or independent replication. A country/product record or research note can be navigational knowledge without being empirical evidence.

Optional semantic search requires local models and index setup. Provider-written synthesis requires a preview and deliberate external call. Never include confidential excerpts unless explicitly authorized. Citation checks do not establish entailment or econometric validity.

## 4. Add every new article through a repeatable request

> Read my existing schema, index and recent log. Process these selected authorized papers within scope. Check versions/duplicates, preserve originals, extract supported findings with locators and explicit gaps. Find affected existing topics and related datasets/policies/methods. Show old text, proposed text and source rationale. Preserve my prior decisions and leave new interpretation pending. After authorized integration, update navigation/log, audit structure and refresh indexes.

A dropped PDF alone is not processed knowledge. If topic integration remains pending, the agent must say so. Create new topics only when justified; do not duplicate existing concepts to increase page counts.

## 5. Understand economics-specific warnings

- Causal label: a claim under assumptions, not automatically valid identification.
- Pre-trend/density/first-stage checks: diagnostics, not proof of assumptions.
- Dataset update: a changed vintage may alter results; analyses need reassessment, not silent rerun.
- Policy announcement: not necessarily implementation or actual treatment exposure.
- Trade figures: check currency/price basis, CIF/FOB, classification edition and missing versus zero.
- Reproduced: requires actual execution record and comparison; synthetic examples only test mechanics.
- Current hash: bytes match, not evidence is scientifically current.

## 6. Maintain and review

After intake use Refresh wiki; optional semantic search has a separate index. Open Database health to inspect the latest saved audit when reports have been configured. Missing metadata, duplicate candidates, broken links, orphan notes and changed dependencies are repair requests—not automatic conclusions.

Ask the helper to prioritize broken provenance, identity ambiguity, affected conclusions and topic integration. Structural audits do not rewrite knowledge. Weekly, review a small number of important proposed changes. Periodically check scope/taxonomy and test a private backup restoration. Daily tasks/schedules need separate configuration; no phone alerts are implied.

A review should name reviewer/date, exact material, decision and limitations. Say “extraction accepted; causal interpretation deferred” when appropriate. Never approve to remove a warning.

## 7. Getting help

No dashboard: confirm vault/plugin. No results: try one word and refresh. No summary: request extraction of authorized sources. Old report: check scheduler/run failure. Semantic model failure: use basic keyword search. Wrong finding: preserve concern, inspect source, keep decision pending.

Report the button, query and error; remove confidential information from screenshots. Never share passwords/API keys in chat. The GitHub construction kit and search index are not backups of your working research.
