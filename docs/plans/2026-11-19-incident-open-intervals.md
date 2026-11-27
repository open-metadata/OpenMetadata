# Persist incident open intervals

Approved approach: store when each incident becomes open and when it closes, so graph reads do not reconstruct status history. Keep the audit history unchanged.

1. Add `IncidentOpenIntervalSqlTest` / extend `IncidentGroupTrendSqlTest` with real MySQL and PostgreSQL checks for migration, repeated open statuses, closure, legacy reopening, timestamp ties, deletion and rollback. Verify using focused Maven service tests.
2. Add native `2.1.1/{mysql,postgres}/schemaChanges.sql`, migration entry points and a bounded, indexed backfill in `migration/utils/v211/IncidentOpenIntervalMigration.java`. Store `(stateId, openedAt, closedAt)` with cascade deletion from the incident summary. Backfill canonical timestamp/id history into separate open periods; reruns replace batches atomically.
3. Add `IncidentOpenIntervalDAO.java`; maintain intervals in the incident write transaction, rebuild the affected incident after explicit history deletion, and preserve intervals during routine audit retention until their incident is removed. Replace `TimeSeriesDAOs.listIncidentGroupTrendCounts` with interval overlap counting. Preserve grouping and membership filters.
4. Update direct SQL integration fixtures in `IncidentGroupsIT.java`, the design decision and the Java impact map. Run focused unit/SQL tests and `IncidentGroupsIT` plus repository tests; format Java with Spotless.
5. Backfill intervals in the local scale fixture and compare identical samples and query timing against the existing query. Record the result and limitations. Review, commit, push to PR #38164 and update its description.

## Scale verification (2026-11-19)

Local MySQL 8.4.13, existing 128 MB buffer pool. The fixture contains 100,000 synthetic
incidents across 100,000 tables, plus the earlier history-heavy fixture and sample data:
110,038 incidents / 400,094 status records in total. Native SQL timings exclude HTTP,
permissions, pagination and response hydration. Each comparison uses the same fixed sample
instants and group keys, one warm-up followed by three timed runs; every result row was compared.

| Scope | Pushed bounded-history query | Stored intervals |
| --- | ---: | ---: |
| 25 tables, one incident each | 230.95 ms | 229.40 ms |
| 25 tables with older resolved histories | 428.73 ms | 285.19 ms |
| One test definition across the large catalog | 17922.00 ms | 2846.72 ms |

The large definition improved 6.3× (84% less query time). Its final interval runs were
3,090 / 2,374 / 2,847 ms. This is a local query benchmark, not an end-to-end latency guarantee.
Scoping the group still dominates: EXPLAIN ANALYZE spent about 2.5 seconds producing the
scoped incidents, out of about 3.05 seconds total. Small sparse pages remain dominated by
scoping and therefore benefit little from removing history reconstruction.

The one-time backfill processed 110,038 incidents into 110,038 periods in 12.814 seconds
(100,569 periods remain open), using batches of 1,000. Only the new projection table was
added to localhost; the running server was not rebuilt or restarted.

Raw local evidence: `/tmp/om-incident-scale/interval-results.json`, `interval-backfill.json`,
and `*_interval.plan.txt`; the SQL is extracted from the production DAO.
