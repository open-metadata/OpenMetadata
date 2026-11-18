# Incident group open-count history

Base: upstream/main (b7998df1fec). Scope: implementation in an isolated worktree.

Use retained status history to reconstruct open counts for the current page of groups.
A snapshot table would need migrations and ongoing maintenance; computing history in the
browser would require unbounded downloads. Use one bounded-result database aggregation instead.

1. Add regression coverage in `IncidentGroupsIT.java` and `IncidentTrendSparkline.test.tsx`.
2. Extend `testCaseIncidentGroup.json` with the trend window and describe open-count samples;
   regenerate Java and TypeScript models.
3. Add a batched status-interval aggregation to `TimeSeriesDAOs.java`, scoped to visible group
   keys and current domain, test, assignee and severity membership. Status/date filters select
   rows; they must not remove resolved incidents or the opening baseline from history.
4. Replace creation buckets in `TestCaseResolutionStatusRepository.java` with nine open-count
   samples across the last seven days, including both endpoints. Compare last with first.
5. Update the existing sparkline and header copy to say open incidents and rising groups,
   with accessible window/count text. Record these semantics in an ADR.
6. Run focused Java unit/SQL tests, IncidentGroupsIT, UI Jest, generation and formatting checks.
   Reuse this evidence; do not run unrelated suites or publish/deploy.

## Verification results

Completed on 2026-11-17 in `/private/tmp/om-incident-open-count-trend`, branch
`fix/incident-open-count-trend`. Changes are uncommitted and have not been deployed.

- `IncidentGroupTrendTest` and `IncidentGroupTrendSqlTest`: 6 passing tests, including
  real MySQL 8.3 and PostgreSQL 15 queries. Covers baseline incidents, openings,
  resolutions, repeated statuses, timestamp ties and deleted/unrelated tests.
- `TestCaseResolutionStatusRepositoryTest`: 19 passing tests.
- `IncidentGroupsIT`: 62 passing API tests on the MySQL/Elasticsearch lane. The new
  regression checks an incident already open before the window, its later resolution,
  and a subsequent incident on the same test.
- Four incident-group Jest suites: 155 passing tests, including the accessible
  sparkline regression (confirmed failing before implementation).
- Java Spotless, changed-file UI organize-imports/ESLint/Prettier, Playwright lint,
  locale generation, schema/model generation, decision-record validation and
  `git diff --check` passed. All 21 locale entries retain the required placeholders.
- Full UI type checking reports `TS18048` in untouched
  `src/utils/queryBuilderWidgets/OMSelectWidget.tsx:59` (`item.label` may be undefined).
  It does not pass; no unrelated fix is included.
- Added and linted the Playwright regression, but did not execute it against a full
  running stack. Production-scale query performance and merge-readiness coverage
  were not measured.

Backend commands:

```bash
mvn -B package -pl openmetadata-service -am \
  -Dtest=IncidentGroupTrendTest,IncidentGroupTrendSqlTest \
  -Dsurefire.failIfNoSpecifiedTests=false -DskipRepackage=true
mvn -B verify -pl :openmetadata-integration-tests -am \
  -Dspring-boot.repackage.skip=true -Pmysql-elasticsearch \
  -DintegrationTests.lane=parallel -Dit.test=IncidentGroupsIT \
  -Dfailsafe.failIfNoSpecifiedTests=false \
  -Dtest=TestCaseResolutionStatusRepositoryTest \
  -Dsurefire.failIfNoSpecifiedTests=false
```

Local execution logs: `/tmp/om-incident-unit.log`, `/tmp/om-incident-integration.log`,
`/tmp/om-incident-ui-final.log`, `/tmp/om-incident-tsc.log`.

See [the design decision](../decisions/2026-11-17-incident-group-trends-count-open-incidents.md)
for the sampling, filtering and retained-history limitations.
