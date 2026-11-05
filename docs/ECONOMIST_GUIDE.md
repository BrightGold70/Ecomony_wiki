# Economist guide — build knowledge without writing code

[한국어](ECONOMIST_GUIDE_KO.md) · [Canonical AI-helper start request](../START_HERE.md) · [README](../README.md)

A prepared dashboard needs no coding for ordinary use. One-time setup still needs an authorized tool-using AI assistant or technical helper; a chat-only answer cannot install software. The kit starts empty.

## 1. Define a first question

Start narrowly: for example, minimum wages and employment, monetary policy transmission, education returns or tariff changes. Choose setting, years, population/sectors, source types and exclusions. Use a separate research-only vault; confidential firm/household data stay outside by default.

Copy the [canonical handoff](../START_HERE.md#one-request-to-give-your-ai-helper), filling in your question, new vault and selected sources. The helper should run the read-only doctor first. Node.js 22+ is core; full tests need working Python 3.10+. Poppler, QMD and Hermes/provider services are optional and separately authorized.

## 2. Build the first knowledge, not just a PDF folder

Choose two authorized papers first. For each, the agent checks identity/version and creates Sources and Literature drafts. Every Source needs a readable summary of question, mechanism/theory, data/sample/period, actual identification (or absent/not applicable), estimand, findings/units/uncertainty, limitations and relevance, with actual read scope and exact supporting quotes/locators. Literature carries the detailed specification/inference and extraction. Theory needs assumptions/propositions, not a forced regression template. Never invent causal identification or JEL codes.

Link relevant Dataset, Policy, Method or Theory records. Ask for one Topic explaining what the papers jointly support and where they differ. Working-paper and published versions may be the same study. Shared samples must not be counted as independent confirmation.

Review the important original passages. Separate author claim, supporting evidence and your judgment. Approval of an extracted coefficient is not endorsement of a policy recommendation.

Then select paper three and request a substantive update to that **same Topic**: old wording → proposed wording → exact source support → reason and applicability. Authorize before the edit; default maximum existing research notes changed is one Topic, plus index/log bookkeeping. A mere added link is not a substantive update. If no change is justified, record why without fabricating a finding. Preserve old version and review decisions/receipts in a private non-indexed archive. Materially changed current content returns to `economist-review-needed`; old approval fields must not carry over. Only a fresh bounded human expert review can approve that new version.

## 3. Use the dashboard

Open Obsidian in the prepared vault. Use Command+P on Mac (usually Control+P elsewhere), search the dashboard command containing “economy” and select it. If absent, ask the helper to verify plugin activation.

Type a simple term such as `tariff`, `gravity` or `DiD`; read the title and stored findings, then open the complete note/source. A missing result means it was not retrieved from this collection, not that no literature exists. Reset search clears the current search/comparison state.

Use the comparison selection under result cards and **Compare selected** for side-by-side reading. Compare estimands, countries, periods, data versions and inference—not just coefficient size.

Use **Graphical paper links** to inspect recorded links and suggested similarities. Similarity is not agreement, causality or independent replication. A country/product record or research note can be navigational knowledge without being empirical evidence.

Optional semantic search requires local models and index setup. **Semantic** beside the main search runs local semantic retrieval with the current question; **Semantic / LLM services** opens controls without starting work. Choose the method and Run semantic search in the question row. Controls stay above results. Semantic results honor active metadata filters; the index itself covers the allowed compiled folders, not only those filters.

For provider synthesis, select comparison notes (or preview locally retrieved candidates), click **Preview synthesis evidence**, inspect structured economics fields, exact excerpts and the full question/path/title/text payload, then check transmission permission and click **Generate grounded draft — provider call**. Explicit provider/model/Python settings are required. Costs and session retention can apply. Question, selection, filters, refresh or panel changes invalidate permission; preview again. Cancel stops the process tree and ignores late output; it cannot undo content already sent. No generated note is saved automatically. Ask this collection still returns local extracts only. Never send confidential excerpts without authorization. Citation checks do not establish entailment, causal identification or econometric validity. See [configuration and limits](OPTIONAL_SERVICES.md#dashboard-configuration-and-use).

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

## Connected reading, questions and ideas

Follow the [bounded Zettelkasten route](ZETTEL_WORKFLOW.md): inspected records → five explicit essentials → one-proposition Ideas → evidence-organized Question map → economist review. Open exact supporting passages and separate recorded relations from suggestions. Missing essentials stay pending; overlapping datasets and publication versions are not independent support. Keep detailed summaries/abstracts expandable. All nine compiled categories remain available; use the dashboard’s actual role/category filters without treating a filter label as evidence validation.

## 6. Maintain and review

After intake use Refresh wiki; optional semantic search has a separate index. Open Database health to inspect the latest saved audit when reports have been configured. Missing metadata, duplicate candidates, broken links, orphan notes and changed dependencies are repair requests—not automatic conclusions.

Ask the helper to prioritize broken provenance, identity ambiguity, affected conclusions and topic integration. Structural audits do not rewrite knowledge. Weekly, review a small number of important proposed changes. Periodically check scope/taxonomy and test a private backup restoration. Daily tasks/schedules need separate configuration; no phone alerts are implied.

A review should name reviewer/date, exact material, decision and limitations. Say “extraction accepted; causal interpretation deferred” when appropriate. Never approve to remove a warning.

## 7. Getting help

No dashboard: confirm vault/plugin. No results: try one word and refresh. No summary: request extraction of authorized sources. Old report: check scheduler/run failure. Semantic model failure: use basic keyword search. Wrong finding: preserve concern, inspect source, keep decision pending.

Report the button, query and error; remove confidential information from screenshots. Never share passwords/API keys in chat. The GitHub construction kit and search index are not backups of your working research.
