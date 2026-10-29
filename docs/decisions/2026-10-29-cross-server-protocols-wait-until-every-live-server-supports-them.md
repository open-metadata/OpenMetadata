# Cross-server protocols wait until every live server supports them

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Platform
- **Guard:** `ServerRegistryTest`, `ServerRegistryIT`, `RdfStorageMaintenanceServiceTest`
- **Related:** #36437, ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule

## Context

Some features only work when every server follows the same rule. RDF storage maintenance is the
first: it pauses writes to the serving dataset while Fuseki compacts it, and a server that does not
know the pause keeps writing, times out and dead-letters its writes. During a rolling upgrade, the
servers still on the previous version are exactly those.

OpenMetadata had no record of which servers are alive or what each one runs, so the first version
of maintenance waited an hour after startup and hoped the upgrade was over. A guess is not a
guarantee, and a registry alone cannot help with the first rollout: servers from before it never
register.

Every OpenMetadata server, of any version since 1.3.1, already writes one shared record: its app
scheduler (Quartz, clustered, `instanceId = AUTO`) checks in to `QRTZ_SCHEDULER_STATE` every few
seconds.

## Decision

- Liveness comes from the Quartz check-ins, so servers of every version are visible. Capabilities
  come from a new table, `server_registry`, that only servers with this decision write: each one
  registers its Quartz instance id, server id, version and the `ServerCapability` values its code
  has, and heartbeats every 30 seconds.
- `ServerRegistry.serversLacking(capability)` returns the live servers whose registration is
  missing, stale or without the capability. A server older than the registry shows up there by
  construction.
- A feature that needs every server to take part checks it before acting and waits while it is not
  empty. Storage maintenance does so for `RDF_LIVE_WRITE_PAUSE`, logs the servers it waits for,
  and runs its first check five minutes after startup.
- When the registry cannot answer (not registered yet, the database unavailable), callers wait:
  the safe direction for a protocol that needs everyone.
- Liveness margins are generous (two check-in intervals plus a minute), so clock skew between
  servers errs towards waiting. Rows unseen for seven days are pruned.

## Consequences

- A rolling upgrade can take as long as it needs; maintenance starts once the last old server has
  stopped checking in.
- A future cross-server protocol adds one `ServerCapability` value and checks it the same way.
- The registry reads a Quartz table. If the app scheduler ever stops using clustered Quartz, the
  liveness source has to move with it.
- A short-lived process that starts the app scheduler, such as an operations command, counts as a
  live server while it runs and can delay maintenance by one check.
