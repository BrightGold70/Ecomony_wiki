# Connected economics notes: safe producer and audit

[한국어](ZETTEL_WORKFLOW_KO.md) · [Everyday guide](ECONOMIST_GUIDE.md) · [Maintenance](MAINTENANCE.md)

## Everyday use

Start with one bounded economic question and a few authorized records, not a batch conversion. Read the existing schema, index and recent log. Inspect the original passages and recorded versions. Draft five essentials, then one-proposition Ideas, then a Question map. A paper digest is not an Idea; an Idea explains a reusable argument with context and uncertainty.

In the dashboard click **Questions and ideas**. The workspace offers **Questions and ideas / Questions / Ideas** type selection, **All evidence coverage / Evidence declared — not yet checked / Evidence missing**, text search and **Clear workspace filters**. Coverage is declared bindings, not verification. Choose a question, follow its explained connections and open the evidence and original note. Main search exact metadata filters remain country, product, method, evidence_kind, subject and keyword; category roles span the nine compiled folders, and recorded publication roles (working paper, journal, commentary, theory, methods and other recorded values) are context, not a new authenticated-review filter. Do not assume a separate publication-role selector exists. Use essential summaries for a short reading route; expand stored summary/abstract independently for full recorded text. Missing essentials stay pending, never an automatically substituted abstract prefix. Exact UI availability depends on deploying the updated plugin; publishing these files does not install it.

Keep all nine compiled categories: Literature, Topics, Datasets, Policies, Methods, Theories, Analyses, Comparisons, Queries. Sources remain evidence records; Review/readability-pilot contains separate hash-bound summaries. Ideas and Questions are not independent studies or replacements for maintained Topics. Source summaries and original bytes are never rewritten by this workflow.

### Five essentials, with economics meanings

Use `## Essential study summary` and these exact five `###` headings, shared with the dashboard parser:

1. **Essential finding** — a supported paraphrase, distinct from the author's interpretation and your own.
2. **Population and comparison** — setting, sample, period, exposure/comparison, dataset vintage and units; for theory use assumptions and model comparison, not an invented empirical sample.
3. **Key result** — estimand, specification, estimate/unit/uncertainty or theoretical proposition; actual replication requires recorded code/data/environment/execution/output provenance.
4. **Main limitation** — identification assumptions/threats, measurement or model limits, unread sections and explicit unknowns. Do not invent causal identification.
5. **Relevance to question** — applicability to the linked question, not policy endorsement.

The same structure applies to every supported record role and all nine categories, with relevant meaning rather than forced empirical fields. `summary_status: insufficient-evidence` remains insufficient even with five filled sections. Keep a specific acquisition/appraisal gap; do not replace pending words just to obtain prepared status.

### Questions, ideas and connections

An Idea needs Proposition, Explanation, exact Evidence, Applicability and uncertainty, Connections and Open question. A Question map needs Current interpretation, Supporting evidence, Conflicting evidence, Applicability, Unresolved questions and Review status. Every new draft stays `economist-review-needed`; no software action authenticates review.

Canonical relation types: `supports`, `challenges`, `qualifies`, `mechanism`, `measurement`, `same-cohort`, `unresolved`, `developed-by`, `contextualized-by`, `qualified-by`, `continues`, `supported-by`. Every connection records target, explanation and `suggested` or `recorded` status. Recorded means recorded assertion, not expert approval. There is no link quota.

Input aliases normalize explicitly: conflicts-with→challenges; extends/supersedes→continues; applies-to→contextualized-by; same-cohort-as/same-dataset→same-cohort; independent-support-for/replication→supports; addresses→unresolved. The explanation must retain dataset overlap or replication meaning. Neither alias establishes independence or actual reproduction. `same-cohort` is the interoperable label for overlapping samples/datasets; use evidence `cohort_id` for a stable recorded sample/dataset identity, and `independence` = same-cohort/independent/unknown with a basis. Same dataset with a different specification is not automatically independent support. Working-paper/journal versions are not separate studies.

Copy to an authorized helper:

> For this question and these selected records only, inspect source versions and exact passages. Propose five essentials, one-proposition ideas and a question map using the blank templates. Preserve all existing bytes. Keep estimands, identification, data vintage, overlap, units and uncertainty explicit; unknowns stay unknown. Validate and show a create-only preview, then await authorization. Do not transmit evidence, install services, run batch tools or update schedules. Report unresolved Topic integration and pending economist review separately.

## Technical helper: explicit proposal contract

Node.js 22+; no dependencies, model or network required. Initialize a deliberately selected new filesystem fixture with `node scripts/init-wiki.cjs /absolute/new-fixture`. The initializer is additive and skips existing files, including customized templates; it does not migrate them or install a collector/runtime unless separately requested via the existing runtime option. Existing vault owners should selectively adopt reviewed template/schema additions.

```sh
node scripts/zettel-producer.cjs --vault /absolute/authorized-fixture --proposal /private/proposal.json --out /private/new-preview.json
node scripts/zettel-audit.cjs --vault /absolute/read-only-snapshot --out /private/new-audit.json
```

Preview is the default and writes no vault files. `--out` is optional, external, create-only JSON. The top-level proposal is `{ "schema_version": 1, "notes": [...], "references": [...] }`; unknown fields fail closed. References are existing full `economy_wiki/...md` paths plus current whole-file `sha256`. Planned links can point at other notes in the same proposal. Existing linked targets require hash pins. Hidden/raw/private paths, traversal, symlinks, aliases/fragments and non-Markdown evidence paths are denied. Authorized reads cover nine compiled folders, Sources, Ideas, Questions and Review.

Each evidence item supplies `source`, `source_sha256`, `source_version`, `locator: {start_line,end_line,label}`, `quote`, `evidence_scope`, `cohort_id`, `relationship` (supports/conflicts-with/qualifies/context), `independence`, `independence_basis`. Hash exact complete current source bytes. Lines are one-based inclusive in the whole source, including frontmatter; the literal quote must occur inside that range. Version must match the locally recorded version/version_key, or a validated `version_locator` with the same line-range structure. An optional supplied version locator is checked even if frontmatter matches. It is not inferred from a similar phrase.

Each note has `path`, `type`, `title`, `questions` (or legacy `question_links`, never both), `relations`, and `evidence`. Idea additionally requires `proposition`, `explanation`, `applicability_uncertainty`, `open_question`; Question requires `current_interpretation`, `supporting_evidence`, `conflicting_evidence`, `conflict_status`, `applicability`, `unresolved_questions`, `review_status_text`. A Question must link supporting or conflicting records; evidence objects are optional for a map, but its linked Ideas require them.

Summary type is `study-essential-summary`, output only under `economy_wiki/Review/readability-pilot/`. Supply `target_path`, `target_sha256`, `essential_finding`, `population_comparison`, `key_result`, `main_limitation`, `relevance_to_question`, evidence and a question. Targets may be in any nine compiled category or Sources; never Ideas, Questions or arbitrary Review files. Duplicate or competing sidecars require owner reconciliation, not automatic selection/re-pinning. The producer emits inline JSON `questions`, `relations`, `evidence_records`; deterministic evidence IDs bind source path/hash/version/range/label/quote, not array position.

Only an explicitly requested, isolated filesystem workspace may use the additional `--apply` switch. It preflights all targets, revalidates current evidence, creates new files exclusively and reads each back. It never updates index/log or existing notes. Multi-file apply/report output is not transactional: a disk error or race can leave partial creations. Preserve receipts, inspect exact paths, and reconcile deliberately; do not retry with overwrite. It is not a hostile-process sandbox.

### Native-only deployments

Do **not** use filesystem `--apply` against a native-only Obsidian vault. Obtain a bounded authorized snapshot through the official Obsidian API; validate proposals against that snapshot. Immediately before application, use `app.vault.read` to recheck every current target/reference/evidence hash, exact range/quote and recorded version. Check destination absence with `getAbstractFileByPath`; create permitted folders/notes using `app.vault.createFolder` / `app.vault.create`, never `modify` for these drafts. Independently `app.vault.read` every created note and compare exact intended bytes, then recheck supporting evidence. Stop on races, stale data or partial failures. This is an operator contract, not an installed native apply service. No live deployment is verified by filesystem tests.

## Maintenance and coverage

Run the read-only zettel audit on a bounded authorized snapshot; hash the snapshot before and after. It inspects Ideas, Questions and Review/readability-pilot, resolving only allowlisted research Markdown. Reports remain external and create-only. It checks links/types/draft state, evidence IDs/current whole-file hashes/quotes/ranges/versions, target hashes, explicit five-section completeness and duplicate/competing sidecars using the dashboard's `essentialSummary` helper.

Native descriptive locators permit whole-record hash/quote checks only: ranges and unavailable versions remain unverified, not invented or classified as malformed merely for being descriptive. Unrelated source YAML is ignored for version checking. Extensionless full research body links are permitted only after literal safety checks. Keep producer validation strict; maintenance compatibility is not permission to generate weaker evidence.

Read `evidence_records`, `hash_quote_verified`, `evidence_verified`, `ranges_unverified`, `versions_unverified`, `targets_checked` and `summaries_prepared` separately. They are occurrences/coverage, not unique studies or independent support. Zero checked hashes means zero evidence coverage. Matching local bytes is not external-source freshness, entailment, valid identification or expert approval. Repair stale evidence and conflicts only after owner appraisal; never auto-repin.

Focused acceptance:

```sh
node --test scripts/test-zettel-producer.cjs scripts/test-zettel-audit.cjs scripts/test-init.cjs
```

These exercise real CLI preview/apply in isolated synthetic fixtures, safety negatives, preservation and actual dashboard scanning. They do not establish native deployment, full-corpus acceptance, scheduled operation or human acceptance. Structural lint, registry reconciliation, optional semantic-index refresh and substantive Topic integration remain separate tasks.
