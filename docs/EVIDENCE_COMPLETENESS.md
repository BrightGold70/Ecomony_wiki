# Evidence completeness and original reading

Open **Evidence completeness** in the dashboard toolbar. Its missing-information selector applies to active country/product/method/evidence-kind filters **before** 25-record pagination. This is a read-only presence inventory, not a score, causal appraisal, independent replication, evidence eligibility or economist approval. Semantic exact-payload/transmission controls and personal entities remain separate and unchanged.

## Presence contract

- Access: exact recorded `evidence_scope`, `evidence_read`, or `evidence_level`; neither an abstract nor a filename proves full-text inspection. `evidence_kind` is not access.
- Data/design, findings and limitations: substantive sections, excluding empty headings, comments, checklist lines, placeholders and table headers/separators. Presence is not entailment or adequate appraisal.
- Economics scalar declarations: `estimand`, `identification_strategy`, `sample_period`, `dataset_vintage`. Explicit not-applicable explanations may be appropriate for theoretical/descriptive work; their presence never validates a causal claim.
- Optional scalar numerical declarations: `outcome_endpoint` (include units), `outcome_estimate`, `outcome_uncertainty`, `outcome_denominator`, `outcome_timepoint`. Displayed as recorded, not extracted from prose, dates or abstracts. This inventories one outcome set, not all specifications/results. Existing numerical prose may still show a structured-field gap.
- Source means a recorded Sources pointer, not a verified original. Stored PDF requires the existing safe resolver's canonical raw path, file existence and symlink checks.
- Review is the recorded status, including economist-review-needed, not authenticated identity or content-pinned receipt. Evidence lifecycle remains separate.

## Exact locators

Optional compiled-note frontmatter (equivalent JSON inline array also supported):

```yaml
evidence_locators:
  - source_path: economy_wiki/Sources/stable-id.md
    locator: "Printed p. S8; Table 2; column (4); Proposition 1"
    pdf_page: 9
    pdf_page_verified: true
```

Locator text is displayed literally. Printed page labels, table/column/figure/proposition references are never converted to PDF indices. A page control requires a positive safe integer (not quoted), boolean true, an exact linked Source and its verified stored PDF. The recorder declares the PDF index was checked; the software does not validate contents or page count. Clicking re-resolves the current note/Source/PDF/mapping before requesting `#page=9` in a split. Missing originals/mappings remain unavailable; ordinary verified source/wiki/URL actions remain possible. No acquisition or network lookup occurs.

## Versions, samples and datasets

`related_versions` accepts recorded path lists. `reference_role` mentioning working-paper, journal, commentary/editorial, follow-up or secondary analysis prompts a recorded-role caution. Exact optional scalar `version_family`, `sample_id`, `dataset_id` matches generate **unverified-suggestion** warnings, never automatic relationships or independence/causal assertions. A shared dataset identifier does not establish matching samples or vintage. Search cards, completeness and comparisons show warnings. Absence of warnings is not independence evidence. Human readers must check actual originals, sample overlap, specifications and vintage.

## Verification boundary

Pure tests, filesystem safety fixtures, and source/generated-plugin VM DOM tests exercise filters, pagination, exact literal locators, page actions/revalidation and warnings. Synthetic PDF-navigation bytes test navigation only, not PDF rendering. Full existing semantic-payload and entity regressions remain exercised. These checks are not native Obsidian/PDF-reader acceptance, causal validation or live-vault deployment. No research notes are written by completeness/navigation.
