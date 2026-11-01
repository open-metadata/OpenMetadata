# The Dremio Software connector talks Arrow Flight on port 32010 of the host of `hostPort`

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial)
- **Deciders:** Charly Clairmont
- **Guard:** `TestSoftwareConnectionUrl` in `ingestion/tests/unit/source/database/dremio/test_connection.py` and the Dremio integration tests
- **Related:** [#34366](https://github.com/open-metadata/OpenMetadata/issues/34366), [PR #36163](https://github.com/open-metadata/OpenMetadata/pull/36163)

## Context

The connection schema of Dremio Software has one address field, `hostPort`, described as the URL of
the REST API (`http://dremio:9047`). The ingestion reads the catalog and the job history with SQL,
which goes through Arrow Flight, a different port of the same server. The schema has no field for
it. A connection that is correct for the REST API is not necessarily correct for Flight.

## Decision

For Dremio Software, `hostPort` is the REST URL. The connector connects to Arrow Flight on the
host of that URL, on port 32010, which is the default Flight port of Dremio. It uses TLS only when
the scheme of the REST URL is `https`. The port is not read from the URL and cannot be overridden
(`SOFTWARE_FLIGHT_PORT` in `connection.py`).

## Consequences

The common deployment, where Flight stays on its default port, needs one field and no more. A
deployment behind a proxy or load balancer, or with another `flight.port`, cannot connect until the
schema gets an optional Flight port; that field would be added with its default set to 32010, so
existing connections keep working. The user interface describes `hostPort` as the REST address,
which stays true.
