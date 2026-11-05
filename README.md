# Economics LLM Wiki

**Connected questions and ideas:** [safe producer, five-part essentials and read-only audit](docs/ZETTEL_WORKFLOW.md) · [한국어](docs/ZETTEL_WORKFLOW_KO.md). Additive blank templates and initialization preserve all nine economics categories; new interpretations remain `economist-review-needed`.

**Indexing navigation:** publication-keyword browsing, provenance, optional imported MeSH and read-only automatic refresh are available. JEL classifications remain separate; MeSH is not required for trade papers. [Guide / 한국어](docs/INDEXING_NAVIGATION.md). Fresh wikis include pending defaults and an inspected-packet template; `scripts/attach-indexing.cjs` previews/applies offline hash-bound Source/Literature appendices and navigation nodes without inference or network calls.

**Latest shared upgrades:** compact entity chooser, readable reference cards, recent-publication/labelled edition-year ordering and optional consent-gated Gemini Notebook export. [English / 한국어](docs/SHARED_UPGRADES.md). Existing economics features are preserved; no personal account or research collection is included.

**Start with your own research question, not somebody else's vault.**

[Start here — economist + AI helper](START_HERE.md) · [한국어 시작 안내](START_HERE_KO.md) · [Everyday use](docs/ECONOMIST_GUIDE.md) · [Technical setup](docs/FROM_SCRATCH.md)

A reusable construction kit for economists who do not code. An authorized tool-using AI helper handles setup and bounded drafting; the economist chooses sources and judges evidence. It supports labor, macroeconomics, development, public finance, industrial organization, trade and other fields. The repository starts empty: no real papers, confidential data, accounts or author-specific configuration.

## Build knowledge in three small steps

1. **First paper:** preserve its authorized original/version or external pointer; create a readable Source summary and a located Literature extraction.
2. **Second paper → first Topic:** compare both studies' mechanisms, data, estimands, identification assumptions, findings and limitations. Shared samples and working-paper/journal versions are not independent confirmation.
3. **Third paper → update that Topic:** show old/proposed wording and source support before editing. Preserve the earlier version and decision. Material changes stay `economist-review-needed` until a new bounded human expert review—not merely a new link or a copied approval.

Copy the [canonical AI-helper handoff](START_HERE.md#one-request-to-give-your-ai-helper). No need to learn terminal commands for everyday use; a chat-only assistant cannot perform the setup itself.

## Knowledge and evidence

Questions → mechanisms/theory → studies → data/identification → located findings → maintained Topics. Sources/raw preserve provenance; Literature, Theories, Methods, Datasets, Policies, Analyses, Comparisons and Queries connect it. Keep JEL, dataset vintages/units/licensing, policy announcement/effective dates and publication versions explicit.

Every Source summary explains question, mechanism, data/sample, identification (or absent/not applicable), estimand, findings, limits and relevance with actual quotes/locators and read scope. Descriptive association, causal interpretation, theoretical proposition, model counterfactual and independently reproduced output remain distinct. Never invent causal identification or computations. Diagnostics, lint, hashes and AI confidence do not certify econometrics or policy advice.

## Core versus optional

| Layer | Requirements / boundary |
|---|---|
| Core local wiki/dashboard | Node.js 22+, Git for checkout, Obsidian desktop; no npm package dependencies or AI key |
| Full tests / Python tools | Working Python 3.10+; check with doctor |
| PDF extraction | Optional Poppler `pdftotext`; scanned PDFs need separately authorized OCR |
| Semantic search | Optional QMD executable, local models and scoped index |
| Provider synthesis | Optional Python + authenticated Hermes, explicit provider/model, exact payload preview and per-preview transmission permission in the dashboard |

A separate AI helper is not automatically configured as a synthesis service. **Semantic** starts configured local QMD search only; **Semantic / LLM services** opens question/method controls and an opt-in synthesis preview. Generate requires explicit provider/model/Python configuration and fresh permission for the displayed payload. Basic search and Ask this collection remain local. [Optional service boundaries](docs/OPTIONAL_SERVICES.md) explain configuration, limits and what remains unverified.

## Technical helper quick start

From a checkout with the prerequisites above:

```sh
node scripts/doctor.cjs
npm test
npm run test:python
npm run build
node scripts/first-wiki-demo.cjs --output /absolute/path/to/new-synthetic-demo
node scripts/init-wiki.cjs /absolute/path/to/new-research-vault
node scripts/lint-wiki.cjs /absolute/path/to/new-research-vault
```

Use different, deliberately chosen new absolute folders for the synthetic demo and real vault. The demo's evidence is **synthetic only**. Follow [setup](docs/FROM_SCRATCH.md) to deploy the built plugin and add authorized real papers. Initialization and empty lint are not a validated collection; full desktop acceptance must be checked on your installation.

## More routes

- [Folder intake](docs/FOLDER_INTAKE.md) · [한국어](docs/FOLDER_INTAKE_KO.md): preview → verified copies → linked drafts → quoted additive AI proposals. Existing Topic revision remains a separate authorized task.
- [Personal research entities](docs/entity-personalization.md): choose ordered metadata field/value shortcuts with your own labels; empty by default. Remove hides buttons, never evidence.
- [Evidence completeness](docs/EVIDENCE_COMPLETENESS.md): missing-information filters, recorded economics dimensions, exact original locators and unverified version/sample/dataset overlap warnings.
- [Human-controlled Topic proposals](docs/TOPIC_PROPOSALS.md): read-only exact preview → individual accept/reject decisions → confirmation and deliberate apply, with immutable history and economist-review-needed reset.
- [Paper/source/original navigation](docs/PAPER_NAVIGATION.md): graph and related-document opening, including explicit linked-only view.
- [Agent contract](docs/AGENT_RUN_CONTRACT.md) · [maintenance](docs/MAINTENANCE.md) · [acceptance and limits](docs/ACCEPTANCE.md).

## Privacy and origin

Reusable code, blank templates, prompts and manuals belong here—not the real research vault, protected microdata, licensed PDFs/extracts, credentials or runtime reports. External services require separate permission and can entail cost/retention. Search indexes are not backups. No collectors, schedules, cloud uploads, EconoSuite integration or econometric execution are enabled by initialization.

Adapted from [Hematology Wiki](https://github.com/BrightGold70/Hematology_wiki), with economics evidence distinctions informed by [EconoSuite](https://github.com/BrightGold70/EconoSuite); see [provenance](docs/PROVENANCE.md). `Ecomony_wiki` preserves the supplied repository spelling; the initialized research subtree is `economy_wiki`. No change to licensing or repository visibility is implied.
