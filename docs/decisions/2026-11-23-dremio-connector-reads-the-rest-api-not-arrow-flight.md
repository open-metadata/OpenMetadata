# The Dremio connector reads Dremio through its REST API, not Arrow Flight

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Charly Clairmont, ulixius9
- **Guard:** `test_client.py` and `test_metadata.py` in `ingestion/tests/unit/source/database/dremio/`; the limits are `reviewer`
- **Related:** [#34366](https://github.com/open-metadata/OpenMetadata/issues/34366), [PR #36163](https://github.com/open-metadata/OpenMetadata/pull/36163)

## Context

A Dremio connector already existed outside this repository, on the same `Dremio` service type and
connection schema, reading the REST API (`/catalog`, `/sql`, `/job`) and ingesting wiki
descriptions, collaboration tags, usage and lineage. PR #36163 first proposed Arrow Flight through
`sqlalchemy-dremio`. Flight needs a second port that the connection schema does not describe (32010
on Dremio Software), and the driver needed a SQLAlchemy 2 dialect written against its private
attributes and a hand-built protobuf message to choose the Dremio Cloud project. Two transports
would mean two implementations of every workflow, and any difference in how they name schemas
would change the FQNs of a service that switches.

## Decision

The connector has one transport, the REST API on the URL of `hostPort` (Dremio Software) or of the
region (Dremio Cloud). The catalog is walked folder by folder from `/catalog/by-path`; columns,
wiki and tags come from `/catalog/{id}`; usage and lineage read the job history with `/sql`.
Nested types come from the `subSchema` of each catalog field. It needs no dependency beyond
`requests`.

Limits of the client (`client.py`, `connection.py`):

- a REST request times out after 60 s;
- a SQL job is polled every 2 s and abandoned after 300 s, or 30 s for the job-history step of the
  test connection. The job-history query of usage and lineage is the only long one: when it is
  abandoned, the run logs an error and ingests no usage or lineage, and the metadata is unaffected;
- job results are read 500 rows at a time, the largest page Dremio returns.

## Consequences

The connector needs only the port of the Dremio UI, works the same on Software and Cloud, and keeps
the FQNs of the services ingested by the earlier connector. The walk makes one request per folder
and two per dataset (fields, wiki) plus one per dataset for tags, which is slower than one
`INFORMATION_SCHEMA` query per schema on a catalog of many thousands of datasets. If that becomes
the bottleneck, `INFORMATION_SCHEMA` can be read through `/sql` without changing the transport.
