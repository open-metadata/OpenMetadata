# Incident group open-count history

The implementation contract is recorded in
[the open-count decision](../decisions/2026-11-17-incident-group-trends-count-open-incidents.md)
and [the generated-key decision](../decisions/2026-11-19-incident-grouping-uses-a-generated-key-index.md).

Verification covers migration backfill and replay, concurrent status ordering, filtered open counts,
full-name grouping, explicit record deletion, asynchronous hard-delete cleanup and accessible UI
counts and dates. SQL scenarios use isolated fixtures on MySQL and PostgreSQL; API tests use the
shared application framework. The scale workload below is separate from ordinary correctness tests.

## Current scale regression workload

`IncidentGroupTrendScaleIT`, tagged `@Tag("scale")`, runs the production trend query on MySQL and PostgreSQL with
10,000 incidents across 200 table groups and 40,000 history rows. It checks all nine counts
for a 25-table page and a single large group, with 30 measured requests at concurrency 1 and 5.
The workload runs only in the `scale-it` profile; regular SQL tests retain the smaller correctness
fixtures. The default five-second p95 budget is a coarse regression alarm, not a production SLO; override
`-Dincident.trend.scale.p95Millis=...` for a calibrated runner. End-to-end HTTP concurrency
measurements are recorded separately in PR #38164. The scale runner writes JSON measurements under
`openmetadata-integration-tests/target/benchmark/`.

The test reuses the scale framework's running application, migrated database and `TestNamespace`
cleanup. Tables and test cases are created through the API; historical records are batch-seeded
in that database, including parent relationships, and their intervals are rebuilt through the
production DAO. Planner statistics are refreshed after bulk seeding so reads and cleanup do not
depend on the timing of background statistics collection. An API assertion verifies that the
incident endpoint reads the fixture before measuring SQL. No separate container, credentials,
reduced schema or migration replay is used.
Run with `-Pscale-it -Dit.test=IncidentGroupTrendScaleIT`; the framework selects the database/search
engines using its existing properties. The report is `target/benchmark/incident-group-trend.json`
and includes both the measured p95 and its budget. These timings measure SQL, not HTTP latency.
