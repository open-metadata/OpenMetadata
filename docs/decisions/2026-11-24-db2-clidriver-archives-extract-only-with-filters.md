# DB2 CLI driver archives are extracted only through a path filter, or not at all

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `ingestion/tests/unit/source/database/db2/test_clidriver.py`
  (`test_zip_archive_with_escaping_entry_keeps_bundled_driver`,
  `test_tar_archive_with_escaping_member_keeps_bundled_driver`,
  `test_tar_archive_is_refused_without_extraction_filters`)
- **Related:** #38552, #38553

## Context
With `clidriverVersion` set, ingestion downloads IBM's CLI driver archive and unpacks it into a
staging directory beside the installed driver (`_extract_clidriver` in `db2/utils.py`). tarfile's
`data` filter (PEP 706) refuses members that would land outside the destination, but Python has it
only from 3.10.12 and 3.11.4, while `requires-python` is `>=3.10`. The code used to fall back to an
unfiltered `extractall` on Pythons without the filter. `ZipFile.extractall` rewrites `..` and
absolute entry names to land inside the destination rather than refusing them.

## Decision
- A tar.gz archive is extracted only with `filter="data"`. On a Python without
  `tarfile.data_filter`, the install raises `RuntimeError` instead of extracting.
- Every zip entry is checked before extraction. An entry that resolves outside the staging
  directory fails the install with `RuntimeError`.
- A refused archive leaves the bundled driver in place, and the run fails, as it does when the
  download fails.

## Consequences
On Python 3.10.0–3.10.11 and 3.11.0–3.11.3, a DB2 service with `clidriverVersion` set fails at
connection setup until Python is upgraded. Services without `clidriverVersion`, and the shipped
ingestion images (Python 3.12), are unaffected. Checking member names before an unfiltered
extraction is no substitute for the filter: the check runs before any link exists on disk, so it
cannot see where a chain of links resolves during extraction. The guard can go once every supported
Python has the filter.
