# Economics indexing lifecycle verification

## Gap and repair

Dashboard parsers/graphs already consumed explicit keyword and optional MeSH collector provenance. Blank Source/Literature templates, init workflow, ingestion handoff and deterministic intake did not produce a supported indexing appendix or navigation nodes. Thus a new user could follow onboarding correctly and still never populate publication vocabulary.

`scripts/attach-indexing.cjs` closes this gap with an offline explicit inspected-packet step, installed packet guidance and honest initial pending defaults. It checks the linked pair, existing local original hash and separately retained metadata-record hash before adding matching appendices. Literal author/publisher/KeywordList kinds remain separate; MeSH descriptor and every qualifier retain independent Major Topic flags. JEL and all economics fields remain unchanged. No paper-prose keyword inference, provider, network request, collector or personal collection is required.

Keyword appendices now support a hash-covered `Indexing binding` line, validated against declared note identity/version and evidence hashes. Older collector grammar still works. MeSH uses the existing typed-publication-indexing-v2 parser, not a competing format. Deterministic metadata-only Topics produce the actual dashboard graph edges without becoming ordinary study relationships; Source records retain provenance without duplicate paper nodes.

Reviewed notes, existing collector sections, identity conflicts, changed receipts, symlinks, unsafe paths and conflicting/curated nodes fail closed. Exact repeat preserves all bytes. A second paper can reuse helper-created nodes without overwriting their initial provenance. New metadata versions need an authorized manual preserved-version migration. Single-writer coordination is required; no multi-file power-loss transaction or hostile-directory concurrency guarantee is claimed.

## Reproduction

From the repository root with working Node 22+, Python 3.10+ and optional Poppler for PDF tests:

```sh
export PATH=/opt/homebrew/bin:$PATH
export TMPDIR=/Users/kimhawk/.hermes/cache/scratch
node --test --test-concurrency=1 dashboard/test-*.cjs scripts/test-*.cjs
npm run test:python
npm run build
git diff --check
```

`test-attach-indexing.cjs` uses only labelled synthetic bytes and identities. It exercises fresh init → first intake → explicit inspected attachment → dashboard buildIndex, keyword/MeSH parsers and graph edges → exact repeat byte preservation → lint with zero issues. It also checks initial pending template/intake defaults, empty optional metadata, safe failures, collector/review preservation, node reuse and actual CLI preview/apply/repeat under a network-denying preload. These mechanics are not authentic publisher/PubMed metadata validation or native Obsidian desktop acceptance.

A clean scratch export was built using **only `git ls-files -z` plus an explicit new-file allowlist** (the helper, its test, packet template and this report), not ignored local dependencies or runtime artifacts. Full tests run serially, then Python tests, then build. Optional real QMD/model integration remains deliberately skipped. No live vault, external provider, personal collection, commit or push is involved.

See [indexing operator guide](INDEXING_NAVIGATION.md#from-scratch-offline-attachment) for packet schema, commands, supported identity/source limits and Korean instructions. The helper verifies local consistency, not semantic field truth, external authenticity or economist approval. Unidentified/RePEc-only and unsupported source-host adapters remain pending rather than receiving fabricated supported identifiers or URLs.
