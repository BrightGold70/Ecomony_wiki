# Inspected indexing packet (offline)

Use the repository's `scripts/attach-indexing.cjs` after creating a linked Source/Literature pair. This is a packet guide, not automatically verified metadata. See repository `docs/INDEXING_NAVIGATION.md` for commands and limits. Replace every placeholder with actually inspected values; do not apply this example unchanged.

```json
{
  "schema": "economy-inspected-indexing-v1",
  "source": "Sources/EXISTING.md",
  "literature": "Literature/EXISTING.md",
  "identity": "doi:10.1234/REPLACE_WITH_VERIFIED_IDENTITY",
  "version_key": "REPLACE_WITH_ACTUAL_VERSION",
  "inspected_date": "YYYY-MM-DD",
  "evidence": {"path": "raw/inspected-record.txt", "sha256": "ACTUAL_SHA256_OF_INSPECTED_RECORD_BYTES"},
  "keywords": [],
  "mesh": []
}
```

Empty arrays are honest pending/not supplied, never evidence that indexing does not exist. Preserve the inspected metadata record immutably under raw/ and compute its actual hash. Local original and inspected metadata may be different bytes with different hashes. Pair identity/version is operator-declared and must match the inspected record; the helper cannot authenticate a publisher or determine whether a passage is a keyword field.

A literal keyword item is `{"text":"EXACT FIELD VALUE","kind":"publisher_author_keywords","source_url":"https://www.aeaweb.org/ACTUAL_RECORD","locator":"EXACT FIELD LOCATION"}`. Allowed kinds: `publisher_author_keywords` (author-supplied publisher field), `publisher_keywords` (publisher field, not automatically author attribution), `jats_keywords`, `pdf_explicit_keywords`, `pubmed_keyword_list` (not MeSH and not automatically author attribution). Do not copy guessed title/abstract words. URLs must pass the dashboard's existing public-source allowlist; unsupported sources require a separately tested adapter, not a fake URL.

MeSH is optional. For an actually inspected PubMed record use `identity: pmid:ACTUAL_PMID`, its exact `https://pubmed.ncbi.nlm.nih.gov/ACTUAL_PMID/` URL, and items shaped as:

```json
{"descriptor":"EXACT DESCRIPTOR","descriptorUI":"ACTUAL_D_UI","majorTopic":false,"qualifiers":[{"qualifier":"EXACT QUALIFIER","qualifierUI":"ACTUAL_Q_UI","majorTopic":true}],"source_url":"https://pubmed.ncbi.nlm.nih.gov/ACTUAL_PMID/","locator":"MedlineCitation/MeshHeadingList/MeshHeading"}
```

Descriptor and each qualifier have separate boolean Major Topic flags. Retain supplied flags exactly; do not infer or conflate them. JEL stays in its existing economics field and is never generated or rewritten by this helper. No medical eligibility, economic synthesis, collector, network access or scientific approval is configured here.
