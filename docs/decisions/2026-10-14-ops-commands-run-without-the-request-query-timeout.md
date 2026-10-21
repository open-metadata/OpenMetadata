# Ops commands run statements without the request query timeout

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `JdbiUtilsTest.opsJdbiRunsStatementsWithoutTheRequestTimeout`
- **Related:** #35417; #31583 (added `queryTimeoutSeconds`); `JdbiUtils.createAndSetupJDBI`

## Context

`queryTimeoutSeconds` (300 seconds by default) exists so a slow API request cannot hold a pool
connection. It was applied in `JdbiUtils`, which builds both the server's JDBI and the
`openmetadata-ops` JDBI, so `migrate` inherited it.

Migrations are not requests. On a large database one statement can need longer: the 2.0.3
migration changes the character set of `entity_extension.extension`, so MySQL copies the whole
table, and that table holds the version history of every entity. When the timeout fires, the
driver cancels the statement, the database rolls it back, and every retry fails at the same
statement. Raising the limit is no way out: it is capped at 3600 seconds, and not every
configuration file exposes it.

## Decision

- `queryTimeoutSeconds` bounds the statements of the API server only
  (`createAndSetupJDBI(Environment, DataSourceFactory)`).
- The `openmetadata-ops` JDBI (`createAndSetupJDBI(DataSourceFactory)`) sets no query timeout.
  Every ops command, including `migrate`, runs each statement until the database finishes it.
- The JDBC socket timeout (`mysqlSocketTimeout`, `postgresqlSocketTimeout`) is a separate setting
  and still applies to both.

## Consequences

- No ops command cancels its own statements. A long migration statement is never rolled back by
  the client.
- The socket timeout is 5 minutes in the default OpenMetadata configuration. A statement that runs
  longer still fails the first `migrate` run, with a communications error. The database is not
  told to stop, though: a MySQL `ALTER TABLE`, for example, runs to the end and commits, so a
  rerun passes. Collate's configuration sets the socket timeout to about 8 hours.
- A hung statement in an ops command is bounded only by the socket timeout, as it was before
  2.0.0.
- Revisit only if an ops command needs a bound on its statements that no migration can reach.
