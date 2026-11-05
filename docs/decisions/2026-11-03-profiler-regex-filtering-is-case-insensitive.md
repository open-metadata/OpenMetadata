# Profiler regex filtering is case-insensitive on the server and client

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ListFilterTest.fqnRegexUsesCaseInsensitiveSearch`, `TableResourceIT.testRegexListTable_caseInsensitiveSubstring`, and `TestGetTableEntities.test_deferred_excludes_match_substrings_without_case_sensitivity`
- **Related:** [Issue #32633](https://github.com/open-metadata/OpenMetadata/issues/32633), [PR #32700](https://github.com/open-metadata/OpenMetadata/pull/32700)

## Context

The profiler forwards database, schema, and table patterns to the listing API. When schema and
table filter modes conflict, it applies excludes in Python. Python's legacy filters ignore
case and match from the start of the name; SQL regexes search anywhere, and PostgreSQL's former
`~` and `!~` operators were case-sensitive. The execution location changed which tables survived.

## Decision

Profiler database, schema, and table regex filters search anywhere in the name, or fully qualified
name when requested, and ignore case by default. Explicit anchors still restrict matches.
PostgreSQL uses `~*` and `!~*`; MySQL uses `REGEXP_LIKE` with the `i` match flag; deferred Python
filtering uses `re.search` with `re.IGNORECASE`. The server-compatible helper follows the server
filter builder's include precedence when both pattern lists are provided.

## Consequences

Changing another filter axis no longer changes substring or default case matching. Existing
client filters for other ingestion paths keep their established behavior. PostgreSQL filters
now match case variants, consistent with the existing client filters. This contract covers
anchoring and default case behavior, not complete regex syntax equivalence between Python,
PostgreSQL, and MySQL.
