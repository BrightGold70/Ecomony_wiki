# Economics LLM Wiki schema

## Scope and ownership

Define economic research question, field, setting/population, geography, sectors, dates, exclusions and publication types in Setup/Scope-policy.md before intake. Labor, macroeconomics, development, public finance, industrial organization, trade and other fields are supported; no trade-only default or blanket collection authorization is required. Restrict agents to economy_wiki; no personal folders, confidential microdata or unauthorized full text. Collector-owned content and economist decisions are preserved.

## Knowledge layers

- Sources/raw: authorized source identity and immutable bytes or external pointer.
- Literature: publication extraction; Theories: assumptions/mechanisms/propositions; Methods: identification/estimation/inference.
- Datasets: definitions, coverage, vintage and permitted snapshots; Policies: official documents and event dates; Analyses: actual execution provenance, not invented results.
- Topics: maintained knowledge; Comparisons/Queries: reusable synthesis.
- SCHEMA.md, index.md, log.md, Setup and Review: governance/navigation/history/decisions.

## Syntax and fields

Use scalar frontmatter and single-line bracket lists (restricted parser, not general YAML). Compiled pages require title, created/updated ISO dates, type, tags, sources and review_status. Types accepted by lint: summary, concept, comparison, query, literature, topic, dataset, policy, method, theory, analysis. Fill real values; unknown domain information stays explicit. Never fabricate dates or identifiers to pass lint.

Every compiled page requires evidence_kind and research_question; causal/counterfactual records additionally require estimand and identification_strategy. Publication fields: doi or verified working_paper_id, jel_codes, research_question, estimand, identification_strategy, countries, products, evidence_kind. Entity metadata fields include country, product, method, evidence_kind, subject, and keyword. Evidence kinds: descriptive, causal, theoretical, counterfactual, reproduced. A causal label describes the kind of claim, not certification of identification. Use sources and structured findings to support it.

Example tags: labor, macroeconomics, development, public-finance, industrial-organization, trade, data, methods, theory, replication, synthesis. Trade-specific tags such as tariffs, gravity and gvc are optional, not a required taxonomy. Extend taxonomy deliberately. JEL classification is additional to readable topics. Do not infer verified JEL codes or silently translate terms.

## Publication indexing lifecycle

First Source/Literature pairs start with keyword_metadata_status: pending_source_inspection and mesh_metadata_status: pending_optional. These are initial defaults, not current provenance assertions; the latest hash-bound appendix is authoritative after attachment. Use Templates/Indexing-metadata.md and repository scripts/attach-indexing.cjs with an explicitly inspected local record, actual SHA256, declared identity/version and linked pair. No title/abstract keyword inference, automatic network acquisition or JEL/MeSH assignment. Keep author keywords, publisher keywords, PubMed KeywordList, MeSH descriptors/individual qualifier Major Topic flags, JEL and user tags distinct. Empty metadata stays pending, not absent.

The offline helper previews by default, adds matching appendices to Source and Literature, creates deterministic navigation-only Topics and appends index/log entries. Nodes are bibliographic navigation, not substantive syntheses. Nine compiled categories and economics domain fields are unchanged. Original bytes and preexisting prose/frontmatter remain unchanged; reviewed notes and existing collector appendices require manual versioned migration. Exact repeat is a no-op; edited/colliding nodes or receipts fail closed. Hash agreement is local consistency, not authentication or expert approval.

## Source integrity

Source requires title, type: source, source_mode: local or external. Local mode requires raw_path within raw/ and raw_sha256 computed from exact original bytes. External mode requires source_url, version, accessed and permission_note; it has no checked local hash. No silent overwrite or raw in-place update. Preserve old versions separately.

Full-path wikilinks use the form `economy_wiki/Literature/your-existing-note` enclosed in double square brackets; the target must actually exist. Sources lists contain existing full wiki paths. Claims preserve source version, SHA256 where local, locator, setting, outcome, estimate/unit/uncertainty. Original paper versus derived extraction hashes have different meanings.

## Required Source summary (content contract)

Every enrolled Source body must include a readable research question; mechanism/theory; data/sample/period; actual identification strategy, assumptions and threats (or explicitly absent/not applicable); estimand (or explained not applicable/unknown); findings with units/specification/uncertainty where available; limits and relevance; actual evidence-read scope and exact supporting quotes/locators. Include a visible working original/publisher/repository link. Abstract-only or deterministic excerpts remain partial, not full-paper appraisal. Do not invent causal identification, JEL codes, identifiers, estimates, access or hashes. Theory-only work must not be forced into an empirical causal design.

These are helper/human completion requirements, not new frontmatter fields or an economics `--content-evidence` CLI gate. Lint checks declared structural metadata and raw hashes, not narrative completeness, entailment or validity of identification. External pointers are not fetched/hashed. Intake proposals add new notes; they do not revise existing Topics.

## Economics integrity

Separate descriptive association, causal interpretation, theoretical proposition, model-based counterfactual, author interpretation and independently reproduced output. Each estimate retains sample, period, specification, units, uncertainty and exact locator. No significance or proof from plausible language.

Record dataset provider/query, vintage, classification edition/concordance, units/currency/price basis, zero/missing/suppressed values and licensing. Policy records distinguish announcement/adoption/effective/amendment/expiry, legal source and product/partner coverage. Shared datasets/samples, working-paper/journal versions and follow-ups must not be double-counted as independent evidence.

Newly computed numbers need real dataset/code/environment/execution/output provenance. LLM or NotebookLM text is not computation provenance. Synthetic fixtures are labelled and cannot establish empirical replication.

## Review and maintenance

Allowed review_status: economist-review-needed, economist-reviewed. Reviewed status requires named reviewer, reviewed_date, review_scope, review_decision and explicit human authorization; software does not authenticate identity. Confidence and structural checks do not validate econometrics or authorize policy advice.

Material content changes reset current `review_status` to `economist-review-needed`. Before editing, preserve old bytes and the bounded human decision/receipt in a private non-indexed version archive or approved versioned backup, outside compiled research folders. Reference the old version/hash and decision in review ledger/log. Archive/remove old current approval fields (`reviewer`, `reviewed_date`, `review_scope`, `review_decision`) from materially changed current content; never erase history, re-date old approval or bind it to changed text. Human-confirmed `review-content.cjs` produces a byte-bound receipt, not automatic frontmatter promotion or identity authentication. Fresh approval requires explicit human expert authorization for the new version.

First paper → Source/Literature; second paper → one justified Topic comparing both; third paper → proposed substantive update to that SAME Topic with old/proposed wording, located support and rationale, then authorization. Default maximum existing research notes changed is one Topic; index/log are additional bookkeeping. A new citation alone is not a substantive revision. If no change is warranted, preserve a reasoned no-change decision without manufacturing evidence.

Read schema/index/recent log first. Reuse justified existing topics; propose old text/new text/source rationale before changing reviewed interpretations. Append activity entries and update index; preserve unresolved conflicts. New publications require topic consideration, not just new files. Registry audits track hashes/links/metadata and explicit impact; separate QMD index refresh from knowledge revision. Review/actual reports and runtime state remain private, not in GitHub.
