# Economics LLM Wiki schema

## Scope and ownership

Define research question, geography, products/sectors, dates and publication types in Setup/Scope-policy.md before intake. Default orientation is international trade, not a blanket authorization to collect everything. Restrict agents to economy_wiki; no personal folders, confidential microdata or unauthorized full text. Collector-owned content and economist decisions are preserved.

## Knowledge layers

- Sources/raw: authorized source identity and immutable bytes or external pointer.
- Literature: publication extraction; Theories: assumptions/mechanisms/propositions; Methods: identification/estimation/inference.
- Datasets: definitions, coverage, vintage and permitted snapshots; Policies: official documents and event dates; Analyses: actual execution provenance, not invented results.
- Topics: maintained knowledge; Comparisons/Queries: reusable synthesis.
- SCHEMA.md, index.md, log.md, Setup and Review: governance/navigation/history/decisions.

## Syntax and fields

Use scalar frontmatter and single-line bracket lists (restricted parser, not general YAML). Compiled pages require title, created/updated ISO dates, type, tags, sources and review_status. Types: summary, concept, comparison, query, dataset, policy, method, theory, analysis. Fill real values; unknown domain information stays explicit. Never fabricate dates or identifiers to pass lint.

Every compiled page should declare evidence_kind and research_question; causal/counterfactual records additionally require estimand and identification_strategy. Publication fields: doi or verified working_paper_id, jel_codes, research_question, estimand, identification_strategy, countries, products, evidence_kind. Evidence kinds: descriptive, causal, theoretical, counterfactual, reproduced. A causal label describes the kind of claim, not certification of identification. Use sources and structured findings to support it.

Starter tags: trade, tariffs, non-tariff-measures, gravity, firms, gvc, services, trade-policy, data, methods, theory, replication, synthesis. Extend taxonomy deliberately. JEL classification is additional to readable topics. Do not infer verified JEL codes or silently translate terms.

## Source integrity

Source requires title, type: source, source_mode: local or external. Local mode requires raw_path within raw/ and raw_sha256 computed from exact original bytes. External mode requires source_url, version, accessed and permission_note; it has no checked local hash. No silent overwrite or raw in-place update. Preserve old versions separately.

Full-path wikilinks use the form `economy_wiki/Literature/your-existing-note` enclosed in double square brackets; the target must actually exist. Sources lists contain existing full wiki paths. Claims preserve source version, SHA256 where local, locator, setting, outcome, estimate/unit/uncertainty. Original paper versus derived extraction hashes have different meanings.

## Economics integrity

Separate descriptive association, causal interpretation, theoretical proposition, model-based counterfactual, author interpretation and independently reproduced output. Each estimate retains sample, period, specification, units, uncertainty and exact locator. No significance or proof from plausible language.

Record dataset provider/query, vintage, classification edition/concordance, units/currency/price basis, zero/missing/suppressed values and licensing. Policy records distinguish announcement/adoption/effective/amendment/expiry, legal source and product/partner coverage. Shared datasets/samples, working-paper/journal versions and follow-ups must not be double-counted as independent evidence.

Newly computed numbers need real dataset/code/environment/execution/output provenance. LLM or NotebookLM text is not computation provenance. Synthetic fixtures are labelled and cannot establish empirical replication.

## Review and maintenance

Allowed review_status: economist-review-needed, economist-reviewed. Reviewed status requires named reviewer, reviewed_date, review_scope, review_decision and explicit human authorization; software does not authenticate identity. Confidence and structural checks do not validate econometrics or authorize policy advice.

Read schema/index/recent log first. Reuse justified existing topics; propose old text/new text/source rationale before changing reviewed interpretations. Append activity entries and update index; preserve unresolved conflicts. New publications require topic consideration, not just new files. Registry audits track hashes/links/metadata and explicit impact; separate QMD index refresh from knowledge revision. Review/actual reports and runtime state remain private, not in GitHub.
