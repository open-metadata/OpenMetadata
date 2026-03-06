# PR Description

## Short blurb

**What changes did you make?**
- Added index `idx_entity_timestamp_desc` on `data_quality_data_time_series (entityFQNHash, timestamp DESC)` in the **1.12.2** MySQL and Postgres migrations.
- Replaced the single `@SqlQuery` for `listLastTestCaseResultsForTestSuite` in `CollectionDAO` with two `@ConnectionAwareSqlQuery` variants: MySQL uses `FORCE INDEX (idx_entity_timestamp_desc)` on the anti-join; Postgres keeps the same SQL without a hint.

**Why did you make them?**
- The "latest row per entity" query used by `listLastTestCaseResultsForTestSuite` was very slow (~20–42s) on MySQL because the optimizer did not pick an efficient plan for the anti-join. That query runs on every test suite pipeline completion and caused slow responses and Hikari connection warnings. Adding the index and using `FORCE INDEX` on MySQL brought the query down to ~0.5s. The index is in 1.12.2 (not 1.12.0) since 1.12.0 is already released.

**How did you test your changes?**
- Ran the 1.12.2 migration on a dev MySQL instance, then exercised the flow that calls this query (e.g. test suite pipeline completion or calling the DAO method). Confirmed query time dropped from tens of seconds to under a second with the new index and FORCE INDEX. Postgres was verified to still use the same SQL (no hint). Existing tests pass.

---

## Full template (copy below)

I worked on **adding an index and MySQL FORCE INDEX for `listLastTestCaseResultsForTestSuite`** because the query was very slow (~20–42s) on MySQL and caused slow test suite pipeline completion and Hikari connection warnings. With the index and hint, the query runs in ~0.5s.

<!-- For frontend related change, please add screenshots and/or videos of your changes preview! -->

#
### Type of change:
<!-- You should choose 1 option and delete options that aren't relevant -->
- [ ] Bug fix
- [x] Improvement
- [ ] New feature
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation

#
### Checklist:
<!-- add an x in [] if done, don't mark items that you didn't do !-->
- [x] I have read the [**CONTRIBUTING**](https://docs.open-metadata.org/developers/contribute) document.
- [ ] My PR title is `Fixes <issue-number>: <short explanation>`
- [ ] I have commented on my code, particularly in hard-to-understand areas.
- [x] For JSON Schema changes: I updated the migration scripts or explained why it is not needed.

<!-- Improvement -->
- [ ] I have added tests around the new logic.
- [ ] For connector/ingestion changes: I updated the documentation.

---

**Suggested PR title (if no issue number):**  
`Improvement: Add index and FORCE INDEX for listLastTestCaseResultsForTestSuite (MySQL) to fix slow test suite query`

**If you have an issue number:**  
`Fixes #XXXX: Add index and FORCE INDEX for listLastTestCaseResultsForTestSuite (MySQL)`
