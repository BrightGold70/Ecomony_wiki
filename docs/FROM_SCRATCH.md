# Build from scratch — technical helper route

Read [START_HERE](../START_HERE.md), the [economist guide](ECONOMIST_GUIDE.md) and [run contract](AGENT_RUN_CONTRACT.md). This kit starts empty; create the user's own research vault, not a copy of an author's deployment.

## 1. Prerequisites and read-only diagnosis

- **Core:** Git, Node.js 22+; Obsidian desktop for the dashboard. No npm package dependencies or AI key for local keyword search.
- **Full tests and Python-backed tools:** working Python 3.10+. Both `npm test` and `npm run test:python` can exercise Python; Node alone is not full-suite readiness.
- **Optional:** Poppler `pdftotext` for text-layer PDFs; QMD/models for semantic search; authenticated Hermes plus explicit approved provider/model/Python for opt-in dashboard synthesis. Basic search and Ask this collection stay local; Generate requires preview and per-preview permission. A separately used AI helper is not automatically a configured provider service. Configure the local plugin data only after authorization using [OPTIONAL_SERVICES](OPTIONAL_SERVICES.md#dashboard-configuration-and-use).

```sh
git clone https://github.com/BrightGold70/Ecomony_wiki.git
cd Ecomony_wiki
node scripts/doctor.cjs
```

The doctor is read-only. Core readiness and optional readiness are separate. Semantic/synthesis `ready: false` means not configured/verified, not necessarily a failed installation. Check the reported executable and actual runtime version; an installed but broken Python is not readiness. Ask before installs/authentication, and never commit tokens. If this repository requires account access, use an approved credential manager rather than changing visibility.

## 2. Exercise the code before real research

With a working Python 3.10+ and Node 22+:

```sh
npm test
npm run test:python
npm run build
node scripts/first-wiki-demo.cjs --output /absolute/path/to/new-synthetic-demo
```

Choose a new **absolute** demo folder, separate from the checkout and real vault. This exercise contains **synthetic evidence only**; it demonstrates a first-paper → second-paper/Topic → third-paper/update path, not citation verification, actual economic findings, causal validation or economist approval. Read its actual output; do not invent test counts or claim native Obsidian acceptance from a filesystem fixture.

## 3. Initialize a separate real vault

Preview the exact destination with the user, then:

```sh
node scripts/init-wiki.cjs /absolute/path/to/new-research-vault
node scripts/lint-wiki.cjs /absolute/path/to/new-research-vault
```

Pass the **parent vault root**, not its `economy_wiki` subfolder. Initialization is additive/non-overwriting. Existing vault schemas/templates are not automatically upgraded; propose a bounded migration if needed. Empty lint coverage is expected, not validated research. Keep this vault and its private state outside the source checkout.

To install required runtime libraries, deploy the dashboard plugin and configure local paths in one step:

```sh
npm run setup:runtime -- --vault /absolute/path/to/new-research-vault
```

Or manually copy built `dist/economy-keyword-search/` to the corresponding `.obsidian/plugins/economy-keyword-search/` folder of the new vault. Do not overwrite another plugin's settings. Open that vault in Obsidian, review/enable the local community plugin and use the command containing “economy” from the command palette. Confirm actual desktop behavior; build output does not prove the UI works on this installation.

## 4. First paper → second paper and Topic

Define `economy_wiki/Setup/Scope-policy.md`: question, field, setting, period, exclusions, publication types and source/data permissions. No trade-only default is required. Read target SCHEMA/index/log.

For paper one use the Source and Literature templates. Verify identity/version, evidence read and permission. Local mode stores immutable original bytes within `raw/`; compute SHA256 from the original file, not from an extraction:

```sh
node -e "const f=require('node:fs'),c=require('node:crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" /absolute/path/to/new-research-vault/economy_wiki/raw/selected-source-v1.txt
```

Set `raw_path` relative to `economy_wiki`, and `raw_sha256` to the actual output. External mode instead needs URL, version, access date and permission note; it has no checked local hash. Every Source body must visibly link to an actual original or publisher/repository destination. Never silently replace an earlier version.

Write the Source summary required by the [run contract](AGENT_RUN_CONTRACT.md#source-content-contract): question, mechanism, data/sample/period, actual identification (or absent/not applicable), estimand, findings/uncertainty, limits/relevance, actual read scope and exact quotes/locators. An abstract or deterministic excerpt is partial evidence, not a completed full-paper appraisal. Create the linked Literature draft with `economist-review-needed`; do not fill unknown causal metadata with plausible claims.

After the first Source/Literature pair, complete the [offline inspected indexing step](INDEXING_NAVIGATION.md#from-scratch-offline-attachment). Initialization supplies Templates/Indexing-metadata.md and pending defaults; intake does not infer keywords or retrieve metadata. Preview/apply an explicit inspected packet, then verify both appendices, literal vocabulary, navigation nodes and graph edges. MeSH remains optional and JEL separate. Uninspected metadata stays pending.

Repeat for paper two, then create one justified Topic comparing both. Link relevant Dataset/Policy/Method/Theory/Analysis notes only where warranted. Preserve JEL, dataset vintages/units/licensing, policy dates, version overlap and shared samples. Add real compiled paths to index, append log and lint.

## 5. Third paper → bounded substantive update

Process its Source/Literature drafts, locate the SAME Topic, and show old wording → proposed wording → source/version/locator → rationale. Explain an actual change in interpretation, qualification, disagreement or applicability, not just a new link. Stop for authorization. Default maximum existing research notes edited is one Topic, with index/log as bookkeeping. If no substantive revision is justified, document a reasoned no-change decision rather than pretend one occurred.

Before an approved edit preserve old bytes and bounded review decision/receipt in a private non-indexed version archive. Set materially changed current content to `economist-review-needed`, archive/remove its old current approval fields and retain a reference in ledger/log. Earlier review remains historical for the earlier version. Only a fresh, explicit human expert review can approve the new content. These are helper/human steps, not automatic intake or lint behavior.

## 6. Verify basic use and maintenance

Refresh the dashboard; search a term actually stored, open the correct note/source/original and inspect links and comparisons. Default graph includes isolated records; use linked-only view deliberately. Missing data stay unknown. No retrieval hit does not establish literature absence.

Run lint and inspect [maintenance](MAINTENANCE.md), using private external registry/report paths. Check coverage, not just exit status. After source changes inspect declared dependencies; matching hashes do not prove currency and audits do not rewrite Topics. Optional semantic indexing is a separate operation. Test a private backup restoration separately.

## Optional services and folder intake

Use [optional services](OPTIONAL_SERVICES.md) for runtime boundaries, explicit permissions and unconfigured states; do not install a model to solve basic keyword-search failure. [Folder intake](FOLDER_INTAKE.md) previews selected files, copies originals and creates drafts/additive proposals. It cannot overwrite an existing Topic; that revision needs the bounded authorized process above. Use the implemented economics flags, not a hematology content-evidence gate. No collector, scheduler, data connector, cloud upload or EconoSuite integration is enabled by initialization.
