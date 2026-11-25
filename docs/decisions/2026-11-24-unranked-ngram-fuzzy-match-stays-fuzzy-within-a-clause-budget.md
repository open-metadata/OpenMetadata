# The unranked n-gram fuzzy match stays fuzzy within a clause budget

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `SearchSourceBuilderFactoryTest#testNgramFuzzinessIsDisabledOnlyPastTheClauseBudget`, `SearchScoringIT#unrankedSearchKeepsTypoToleranceAndAnswersLongTokens`
- **Related:** #38304, #38305, #27636, #29853

## Context

`addFuzzyMatchQueriesV2` runs a fuzzy `multi_match` over the `*.ngram` fields. The `om_ngram`
analyzer splits the query into 3–20 character grams, and each gram is fuzzy-expanded separately,
up to `max_expansions` terms per field. A 16-character id becomes 105 grams; across the two default
n-gram fields that is up to 2100 clauses, past OpenSearch's 1024 `max_clause_count`, so the search
fails with a 500. The builder runs on unranked searches and, with no ranking check, on the
aggregate, common and entity-specific search builders, so default installs hit it.

Turning fuzziness off for every n-gram match fixes the 500 but removes typo tolerance from every
search that relies on that clause (`custmer`, `ordrs` stop matching).

## Decision

Keep fuzziness 1 on the n-gram match and turn it off only when the estimated clause count passes
`SearchUtils.NGRAM_FUZZY_CLAUSE_BUDGET` (640). The estimate is the number of grams the query
analyzes into under `om_ngram` (words split on non letter/digit, grams of 3–20 chars), times
`max_expansions`, times the number of `*.ngram` fields in the match. It is an upper bound: real
expansion counts only terms present in the index.

640 leaves headroom under 1024 for the query's other clauses. With the default name and display-name
n-gram fields, single words of up to 9 characters and two-word queries such as `customer_orders`
(620) stay fuzzy; a 16-character id (2100) is matched exactly. N-gram fields keep their own
analyzer, so partial names and the jp/ko/zh n-gram mappings match as before.

## Consequences

- Single words of 10 or more characters, and long multi-word queries, lose typo tolerance on the
  n-gram match. Their exact and standard clauses are unchanged.
- The estimate mirrors the `n_gram_tokenizer` settings in the index mappings. A change to
  `min_gram`/`max_gram` there must update `NGRAM_MIN_GRAM`/`NGRAM_MAX_GRAM` in `SearchUtils`.
- The CJK mappings index 1–3 character grams, which the 3–20 estimate undercounts for short tokens;
  the budget's headroom under 1024 covers that difference.
