# The release bump's `regex_sub` tolerates no match by default; OpenMetadata's own patterns opt into failing

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `scripts/test_update_version.py::test_regex_sub_tolerates_no_match_by_default`
- **Related:** #36405, ADR:openmetadata-collate/2026-10-28-release-refs-track-the-major-minor-branch

## Context
`make update_all` finds each version with `regex_sub` in `scripts/update_version.py`. It wrote the
file back whether or not the pattern matched, so a pattern that drifted from its file left the old
version in place without an error: 2.1 was cut with the MySQL quickstart on `1.12.0-SNAPSHOT`
images. Collate's release bump (`openmetadata-collate/scripts/collate_update_version.py`) imports
`regex_sub` from this file, calls it by keyword (`file_path`, `pattern`, `substitution`), and runs
some patterns that match nothing on purpose: its `Dockerfile-dev` updaters rewrite
`ARG OPENMETADATA_REF=main`, which a release branch no longer carries.

## Decision
- `regex_sub(file_path, pattern, substitution, required=False)` returns the number of
  replacements. With `required=True`, a pattern that matches nothing exits non-zero.
- Every OpenMetadata release pattern passes `required=True`. The default stays `False`, so
  Collate's calls keep working unchanged.
- The keyword names and the lenient default are a contract with Collate. Changing either needs a
  Collate change first.

## Consequences
OpenMetadata's bump fails loudly when a file changes shape. Collate's patterns are not checked by
this file; Collate opts in by passing `required=True` where a match is always expected. Revisit if
Collate stops importing `regex_sub`.
