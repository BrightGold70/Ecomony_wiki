# Build from scratch — technical helper route

Read the [economist guide](ECONOMIST_GUIDE.md) and [agent contract](AGENT_RUN_CONTRACT.md) first. The kit is empty and does not install data collectors or schedulers.

## Prerequisites and clean setup

Git, Node.js 22+ and Obsidian desktop. Optional services need additional software; do not install them to solve a basic keyword-search problem. GitHub account access is needed if the repository is private; use a credential manager, never committed tokens.

```sh
git clone https://github.com/BrightGold70/Ecomony_wiki.git
cd Ecomony_wiki
npm test
npm run build
node scripts/init-wiki.cjs /absolute/path/to/new-research-vault
node scripts/lint-wiki.cjs /absolute/path/to/new-research-vault
```

Pass the parent vault root, not its economy_wiki subfolder. Initialization is additive/non-overwriting. Empty lint coverage is expected, not validated economic evidence. Use a separate vault from this source repository to keep research out of Git.

Copy built `dist/economy-keyword-search/` into the new vault's corresponding `.obsidian/plugins/` folder. Open that vault in Obsidian. Review the code and enable the local community plugin in Settings; use the economy search command from the command palette. Do not overwrite another plugin's configuration. This does not install models/provider accounts.

## First authorized evidence

Define Setup/Scope-policy.md and taxonomy; read SCHEMA/index/log. Copy the Source template into Sources, record verified title and identifiers, source access/version and permission. Choose local or external mode. Local raw evidence must be immutable versioned bytes within raw/, hashed with SHA256:

```sh
node -e "const f=require('node:fs'),c=require('node:crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" /absolute/path/to/new-research-vault/economy_wiki/raw/selected-source-v1.txt
```

Set raw_path relative to economy_wiki and raw_sha256 to actual output. External pointers instead require URL/version/accessed/permission; do not pretend they have a checked local hash.

Copy Literature template, populate real metadata and source links such as `[[economy_wiki/Sources/selected-source]]`. Record exact evidence read and locators. Retain economist-review-needed. Add an index entry, append log, run lint.

Repeat for justified related evidence, then create a Topic with source links, agreement/disagreement and applicability. Use Dataset/Policy/Method/Theory/Analysis templates when applicable; connect only real relationships. Comparisons and saved Queries retain citations/review boundaries even if not in a study-results screen.

## Verify basic use

Refresh dashboard, search a term actually stored, open correct note/source, compare studies and inspect graph edges. Confirm missing data stay unknown. Verify new domain records can be found where supported. Test reset and review indicators. No keyword hit does not establish literature absence.

## Maintenance

See [maintenance](MAINTENANCE.md). Keep registry outside the vault. First baseline is inventory, not universal stale evidence. After a source change inspect declared dependent claims/topics. Update index/log and review decisions deliberately. Do not treat hash/lint checks as econometric validation.

## Optional services

QMD needs its own executable/models and research-scoped index. Provider synthesis needs an explicitly configured executable/provider/model and previewed transmission permission. Inspect each CLI's `--help` before setup and verify on a small authorized corpus. The migrated adapters are not a claim that these services were installed or live-tested here. Publication monitoring does not guarantee complete retraction coverage. No external data connector or EconoSuite integration is enabled by initialization.

## Agent handoff

Provide vault root, question/scope, exact sources, allowed writes and external-provider boundary. Follow prompts/INGEST.md. Require a change preview, source preservation, actual check results and pending human decisions. Test first with labelled synthetic fixtures; then a bounded real-source pilot. A successful clean-room build is not observed completion by a nontechnical newcomer.
