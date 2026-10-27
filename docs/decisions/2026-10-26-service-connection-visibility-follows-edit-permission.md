# A service connection is returned only to bots and to callers who can edit the service

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial) · v2 2026-10-27 (MCP follows the rule; clients that run
  without a connection)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `MetadataServiceResourceIT`, `ServiceConnectionAccessTest`,
  `McpResponseUtilsTest#hideConnectionFromNonEditors*`
- **Related:** [CVE reporting scope](2026-10-14-cve-reporting-covers-unauthenticated-access-only.md),
  [MCP responses mask stored credentials](2026-10-20-mcp-responses-mask-stored-credentials.md)

## Context

A service entity carries a `connection` holding credentials (passwords, tokens, keys). GET, list,
create, and patch responses pass through `ServiceEntityResource.decryptOrNullify`, which returned a
masked connection to every non-bot caller. The password-masking walker did not cover every secret —
for example the ingestion-bot JWT embedded in the built-in OpenMetadata service connection, and
free-form credential maps — so a caller holding only `VIEW_BASIC` could read secrets they are not
trusted with. Masking alone is not a sufficient boundary for who may see a connection at all.

## Decision

A service GET/list/create/patch returns the `connection`:

- **in full (decrypted)** to bots, which ingestion uses to run pipelines;
- **masked** to callers who can edit the service — those holding `EDIT_ALL` on it (admins, service
  owners via the organization owner rule, and custom roles granting `EditAll`) — so the UI and SDKs
  can still display and edit it. Roles that grant only field-scoped edits (for example the seeded
  Data Steward, which has `EditDescription`/`EditTags`/… but not `EditAll`) do not qualify and
  receive no connection;
- **not at all** (`connection: null`) to everyone else, including `VIEW_BASIC` readers.

The masked-vs-null choice is gated on the caller's edit permission on the entity, not on `isAdmin()`,
so explicitly delegated operators keep managing connection details — as the
[reporting-scope record](2026-10-14-cve-reporting-covers-unauthenticated-access-only.md) states they
are trusted to — while view-only users never receive connection secrets.

Separately, the built-in OpenMetadata service stores only non-sensitive server-connection metadata
(host/port/auth provider): it holds no `elasticsSearch` sink and no `securityConfig` JWT, because
ingestion builds its own `securityConfig` on the fly and reindexing reads the search config from the
application config.

## Consequences

- The UI/SDK must treat a null `connection` as "not visible to me", never as "cleared", and must not
  send `connection: null` on save for a caller who cannot edit the connection.
- Masking remains the second layer for editors: `@PasswordField` values, including the
  server-connection JWT, are masked rather than exempt from masking.
- A migration drops `elasticsSearch` and `securityConfig` from existing metadata service rows.

## Amendment — 2026-10-27: MCP, and clients that run without a connection

- **MCP follows the same rule.** `get_entity` and `patch_entity` drop a service's `connection` for a
  caller without `EDIT_ALL` on the service, through the `ServiceConnectionAccess` check the REST
  resource uses. A caller with it gets the connection masked, bots included, as
  ADR:2026-10-20-mcp-responses-mask-stored-credentials decides for every MCP response.
- **Ingestion without a connection.** A workflow that reads its connection from the server fails
  with an error naming the token as the cause when none comes back. dbt is the exception: it never
  connects to the source, so it runs without the connection and takes the SQL dialect for query
  lineage from the service's `serviceType`, which every viewer can read.
- **Menus built from the connection offer less.** The add-agent menu, and Collate's Add Policy Agent
  and add-job actions, read the connection to decide what to offer; a role that can create
  ingestion pipelines but lacks `EditAll` on the service sees fewer options. They degrade; they do
  not fail.
- **The legacy Data Insights pipeline is retired.** Collate's `dataInsight` ingestion pipeline type
  took its search sink from the built-in service's connection, which no longer stores it. Deploying
  one fails with an error pointing to the Data Insights application; the sink is not re-read from
  anywhere else.
