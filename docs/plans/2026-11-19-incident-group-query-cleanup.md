# Incident group query cleanup

Approved approach: remove redundant joins and related-entity scans without changing response fields, sorting, filters, or pagination.

1. Add IncidentGroupQueriesSqlTest under openmetadata-service/src/test/java/org/openmetadata/service/jdbi3. Exercise the real DAO on MySQL/PostgreSQL, checking counts, related previews, filtering, empty pages and a two-query budget for table/definition grouping. Run before implementation to demonstrate the budget failure.
2. Update TimeSeriesDAOs.java to reuse the definition grouping join, derive self-related keys from page keys, and omit definition joins in table-preview and count-only queries. No schema or lifecycle changes.
3. Run the SQL regressions on PostgreSQL and an isolated MySQL database, focused IncidentGroupsIT regressions, and mvn spotless:apply/check. Compare old/new DAO results and timings on the existing scale fixture without changing the deployed server.
4. Inspect the diff, record results, and push to the existing PR branch.
