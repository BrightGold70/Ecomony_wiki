# Economics LLM Wiki — international-trade foundation

**Already using a paper-collection AI agent?** Follow the [collector collaboration contract / 수집 에이전트 협업 안내](docs/COLLECTOR_COLLABORATION.md) to preserve single-writer ownership and maintain Source → original-paper links after daily intake.

**Paper relationship navigation:** [Open wiki records, provenance and original PDFs](docs/PAPER_NAVIGATION.md) directly from graph nodes and related-document links. Includes Korean instructions and an explicit linked-only network option.

**New: collected-folder intake → stored originals → linked drafts → grounded AI entity/topic proposals.** [English](docs/FOLDER_INTAKE.md) · [한국어](docs/FOLDER_INTAKE_KO.md). Preview first; explicit apply/move and pending human review.

A reusable construction and management kit for economists. Adapted from [Hematology Wiki](https://github.com/BrightGold70/Hematology_wiki), with economics-specific evidence rules informed by [EconoSuite](https://github.com/BrightGold70/EconoSuite). Repository spelling `Ecomony_wiki` is intentional preservation of the supplied destination; the working research folder is `economy_wiki`.

**Start here:** [Economist workflow](docs/ECONOMIST_GUIDE.md) · [한국어 안내](docs/ECONOMIST_GUIDE_KO.md) · [Technical setup](docs/FROM_SCRATCH.md)

## Aim

Turn selected authorized sources into traceable study notes and connected, maintained economic explanations. Humans curate questions/evidence and judge identification/interpretation; authorized agents extract, connect, propose updates and audit structure. This is not an automatic research-validity certificate or policy-advice engine.

## Knowledge model

Questions → theory/mechanisms → studies → data → identification → findings → topic synthesis, linked to trade-policy records and review history.

- **Literature:** publication/version, JEL, question, sample, estimand, method, findings, limitations.
- **Theories/Methods:** assumptions, mechanisms, propositions, identification threats and diagnostics.
- **Datasets:** provider/query, coverage, units, classification edition, vintage and permissions.
- **Policies:** official instrument, geography/products, announcement versus implementation/amendment.
- **Analyses:** actual data/code/environment/output provenance and replication status.
- **Claims/Topics/Comparisons/Queries:** source-located findings and reusable reviewed-or-pending synthesis.
- **Sources/raw/Review/Setup:** immutable provenance, bounded decisions and organizing rules.

Descriptive association, causal claim, theoretical proposition, counterfactual and reproduced output must remain distinguishable. Shared data/working-paper versions are not independent corroboration. Diagnostics do not prove identification.

## Foundation versus extensions

The foundation adapts the local Obsidian dashboard, keyword findings/related links/comparison tools, lifecycle integrity, safe initializer and incremental structural audit. Optional local QMD, provider synthesis and publication-check components require separate setup/testing; downloading the repository does not configure services, credentials, collectors or schedules.

Dataset, policy and analysis templates organize provenance; they do not fetch all data, validate trade classifications, execute estimators or independently verify proofs. Detailed delivered/tested boundaries are recorded in [acceptance](docs/ACCEPTANCE.md).

Deferred: automatic journal intake, dataset/policy revision connectors, econometric execution, EconoSuite export/MCP integration and automated topic revision. No NotebookLM upload by default. Manuscript formatting belongs in EconoSuite, not the wiki core.

## Technical helper quick start

Node.js 22+ and Git required; Obsidian desktop for the dashboard. Full desktop acceptance must be checked on your installation.

```sh
git clone https://github.com/BrightGold70/Ecomony_wiki.git
cd Ecomony_wiki
npm test
npm run build
node scripts/init-wiki.cjs /absolute/path/to/new-research-vault
node scripts/lint-wiki.cjs /absolute/path/to/new-research-vault
```

Follow [FROM_SCRATCH](docs/FROM_SCRATCH.md) to copy the built plugin, open the vault and add real evidence. Empty initialization is not a validated economic collection.

## New-article workflow

Verify identity/scope/version → preserve authorized source → extract located results → compare existing topics/data/policies → propose old/new wording → obtain bounded review → update navigation/log → audit and refresh search. New files alone are not knowledge integration.

Use [agent contract](docs/AGENT_RUN_CONTRACT.md), [INGEST](prompts/INGEST.md), [QUERY](prompts/QUERY.md), [MAINTAIN](prompts/MAINTAIN.md), and [maintenance guide](docs/MAINTENANCE.md).

## Privacy and repository ownership

This repository contains reusable code, blank templates, prompts, manuals and tests—not a real paper collection, confidential microdata, PDFs, model weights, credentials or operational reports. Runtime research stays in a separate vault/private state. External providers require deliberate permission for selected excerpts and may incur costs/retention. Search indexes are not backups.

The upstream history was not imported. EconoSuite was reviewed as a design reference; its files/skills were not bulk copied. See [provenance](docs/PROVENANCE.md).
