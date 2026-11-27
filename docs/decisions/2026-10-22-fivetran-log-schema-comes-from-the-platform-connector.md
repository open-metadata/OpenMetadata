# The Fivetran connector reads its log table from the schema the Platform Connector reports, not a fixed name

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** @akashverma0786, reviewers of #35933
- **Guard:** `ingestion/tests/unit/source/pipeline/fivetran/test_fivetran_log.py::TestResolveLogSchema`
  and `test_pipeline_list_prefers_the_configured_log_schema`
- **Related:** #32253, #35933

## Context

Per-phase (Extract/Process/Load) run status comes from Fivetran's `log` table in the destination
warehouse. The connector reflected that table out of a hardcoded `fivetran_metadata` schema.

Fivetran only uses that name for the Platform Connector it creates itself; a manually created one
uses whatever schema the account chose, and the docs' own example default is `fivetran_log`. One
account can also hold several destinations with different names, so no single configured value is
right for all of them.

## Decision

The schema is resolved per destination, in this order:

1. `logSchema` on the Fivetran service connection, when set. Optional, no default.
2. The `schema` of the group's Platform Connector — the connection whose `service` is
   `fivetran_log`, the only platform service id Fivetran exposes. It arrives with the connector
   list `get_pipelines_list` already fetches, so this costs no extra API call.
3. `fivetran_metadata`, as the fallback when no Platform Connector is present.

The table name stays `log`: Fivetran's API reports it as a `SYSTEM_TABLE` that cannot be renamed or
disabled. Its columns are declared rather than reflected, because `MetaData.reflect` goes through
the SQLAlchemy dialect and OpenMetadata replaces `get_table_names` on Snowflake with a version
returning a pydantic model, which reflection cannot consume (`unhashable type: 'list'`, #32253).

## Consequences

Accounts whose schema is not `fivetran_metadata` work with no configuration, including after an
upgrade, and each destination is resolved independently. `logSchema` stays available for the cases
detection cannot see — a restricted API key, or a Platform Connector outside the group — but it is
a single value, so setting it applies to every destination of that service.

Declaring the columns means a renamed or disabled column now fails at query time rather than during
reflection; the failure is caught, named in the warning, and falls back to the Fivetran REST API.

Revisit if Fivetran exposes more than one platform service id, or starts allowing the `log` table
to be renamed — the first connection matching `fivetran_log` would no longer be the right answer.
