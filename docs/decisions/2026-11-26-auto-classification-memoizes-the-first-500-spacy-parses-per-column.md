# Auto Classification memoizes the first 500 spaCy parses of a column and evicts none

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** ingestion maintainers
- **Guard:** `TestTagScorer::test_sample_values_are_parsed_once_across_tags`, `TestTagScorer::test_values_beyond_the_memo_cap_are_parsed_per_tag` in `ingestion/tests/unit/metadata/pii/test_tag_scoring.py`
- **Related:** #38791, #38795

## Context
Each candidate tag re-ran the full spaCy pipeline on every sample value. With the 22 default tags, a
50-value column made 1,109 parses for 50 distinct texts, and those parses took 94% of the column's CPU.
The parse doesn't depend on the tag, so the tag analyzers of one column now share an `NlpArtifacts`
memo. Holding the parses costs memory: measured at +0.7 MB for 50 short values, up to +26 MB for 50
values of about 2,000 words each. Every cache in this repository must have a size limit.

## Decision
`ScoreTagsForColumnService` creates one memo per column, keyed on `(language, value)`, and drops it
once the column is done. The memo holds at most `NLP_ARTIFACTS_MEMO_MAX_SIZE = 500` entries
(`ingestion/src/metadata/pii/tag_analyzer.py`). It keeps the first 500 parses and never evicts.
Values that arrive after it is full are parsed once per tag, which is the behavior before the memo.
LRU eviction was rejected: every tag walks the values in the same order, so an LRU smaller than the
value count evicts each entry before the next tag reuses it and never hits.

## Consequences
At the default `sampleDataCount` of 50, a column fits well under the cap, so each distinct value is
parsed once (about 15× less CPU). Peak memory per column is bounded by 500 parses. A column with
more than 500 distinct values (including flattened array elements, title-cased copies of all-caps
values and per-language keys in `any` mode) gets the saving only for its first 500; the rest cost
O(tags × values) as before. Revisit if sample sizes are raised well above 500. The alternative then
is to parse each value once and run every tag's recognizers on it, which needs no memo at all.
