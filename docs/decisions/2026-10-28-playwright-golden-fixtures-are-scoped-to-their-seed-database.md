# A Playwright golden fixture is restored only onto the database it was seeded on

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `.github/scripts/tests/test_playwright_cache_assets.py` —
  `test_fixture_profile_matches_the_seeded_and_fast_compose_stacks`,
  `test_fixture_validator_rejects_a_fixture_seeded_on_another_database`,
  `test_golden_fixture_cache_is_scoped_by_database`
- **Related:** open-metadata/OpenMetadata#36404, open-metadata/OpenMetadata#36509,
  `.github/scripts/playwright_fixture_profile.sh`

## Context

`playwright-e2e-reusable.yml` takes a `database` input, but the golden-fixture pipeline only knew
PostgreSQL + OpenSearch. `mysql-nightly-e2e.yml` runs it with `database: mysql`, so every release
branch nightly failed in `prepare-playwright-fixture` with `No such object:
openmetadata_postgresql`. The cache key did not carry the database either, so a MySQL run could
restore a PostgreSQL fixture and test the wrong stack without failing.

## Decision

- `playwright_fixture_profile.sh` is the one place that maps a database to its stack:
  `postgresql` pairs with OpenSearch, `mysql` with Elasticsearch, matching their
  `docker/development` compose files. The builder, validator and fast launcher all source it.
- The fixture manifest is `version: 3` and records `database`, `databaseImage` and `searchImage`.
- The golden-fixture cache key is
  `playwright-golden-fixture-v2-<database>-<os>-<arch>-<fingerprint>`, with `<database>` taken from
  `inputs.database`, in both the restore and the save step.
- When `PLAYWRIGHT_DATABASE` is set, the validator and fast launcher reject a fixture whose
  manifest `database` differs.
- The fixture fingerprint is shared across databases. A MySQL-only compose change also rebuilds the
  PostgreSQL fixture; such changes are rare, and one fingerprint keeps the key logic in one place.

## Consequences

- A MySQL run builds and restores its own fixture; a mismatched fixture fails at validation instead
  of seeding a run on the wrong engine.
- Each database costs a separate fixture build and cache entry.
- Adding a database, or changing a pairing, means a new `case` in `playwright_fixture_profile.sh`,
  a fast compose file for it, and this record amended. Changing the manifest fields or the key
  format means bumping the manifest version or the `v2` key prefix together.
- If database-specific compose edits become frequent, split the fingerprint per database; that is
  a new decision.
