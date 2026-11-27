# Dremio tags are ingested in the classification `DremioTags`, and the internal sources of Dremio Cloud are skipped

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Charly Clairmont, ulixius9
- **Guard:** `test_a_view_with_its_wiki_and_tags` and `test_cloud_internal_sources_are_skipped` in `ingestion/tests/unit/source/database/dremio/test_metadata.py`
- **Related:** [PR #36163](https://github.com/open-metadata/OpenMetadata/pull/36163), ADR:2026-11-23-dremio-connector-reads-the-rest-api-not-arrow-flight

## Context

Dremio lets users put free-text collaboration tags on a dataset; OpenMetadata tags belong to a
classification. Services ingested by the earlier REST connector already hold these tags under
`DremioTags`, and policies, searches and glossary mappings may key on that name.

Dremio Cloud also creates sources whose type starts with `DCS_CORE`: they re-expose the catalog of
the project itself, so ingesting them would duplicate every real source and space as a second
database with the same tables. Only the detail of a source (`/catalog/{id}`) gives its type.

## Decision

- Every collaboration tag of a dataset is a tag of the classification `DremioTags`
  (`DREMIO_TAGS_CLASSIFICATION` in `metadata.py`), named as in Dremio, with duplicates removed and
  non-string values ignored. Tags are read only when `includeTags` is on.
- On Dremio Cloud, a source whose type starts with `DCS_CORE` is not a database. Dremio Software has
  no such source, so its sources are not read in detail. If the type cannot be read, the source is
  ingested.

## Consequences

The tags of existing services keep their FQNs (`DremioTags.<tag>`). Ingesting a Cloud project costs
one request per source to read its type. If Dremio adds another kind of internal source, it shows
up as a duplicate database until its type is added here.
