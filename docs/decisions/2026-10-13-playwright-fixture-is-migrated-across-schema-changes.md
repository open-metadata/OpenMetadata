# Merge groups migrate the last main Playwright fixture across schema and migration changes instead of rebuilding it

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial) · v2 2026-10-20 (ancestor-only reuse; trial migration falls back to a rebuild)
- **Deciders:** Chirag Madlani
- **Guard:** `test_fixture_validator_reuses_a_fixture_across_schema_and_migration_changes`,
  `test_fixture_fingerprint_tracks_compatibility_inputs_without_source_sha`,
  `test_workflow_restores_assets_in_parallel_and_uses_scoped_fallback`
  (`.github/scripts/tests/test_playwright_cache_assets.py`)
- **Related:** `.github/playwright/README.md` (Golden fixture)

## Context
The seeded Playwright fixture (PostgreSQL + OpenSearch data, auth and entity state) costs ~17 min
to rebuild and sits on the critical path of every merge group. Its cache key changed on 23% of
`main` commits, mostly JSON Schema and SQL-migration edits, and a merge group carries up to five
queued PRs, so 26 of 30 sampled merge groups (2026-10-13) rebuilt it and the queue's wall-clock
median was 55 min. Only `main` can save the cache, so every group behind a schema-touching PR
missed until that PR landed. The Airflow ingestion image was built in the same job, so its own
misses (21% of commits) also forced the re-seed.

## Decision
- The cache key is `<fixture-base>-<fixture>`. `fixture-base` is the fixture input set minus
  `bootstrap/sql/`, `openmetadata-spec/.../json/schema/`, and `service/migration/`.
- On an exact miss, `merge_group` and pull-request runs restore the newest cache with the same
  `fixture-base`; each shard runs `openmetadata-ops.sh migrate` on it before the server starts.
- `push` and `schedule` never accept a migrated fixture: they rebuild and save the exact one.
- Dependency pins (`pom.xml`, `package.json`, `yarn.lock`) are not fixture inputs; the
  manifest's `seedVersion` still invalidates on a release version change.
- The ingestion image is built by its own job in parallel with `build`.

## Consequences
- Seed data, search mappings and index classes, auth/session code, fixture scripts, and the
  Playwright setup helpers still force a full rebuild (10% of `main` commits).
- A merge group that restores across schema changes tests the upgrade path a production
  database takes, not a fresh install; a fresh install is still exercised by every `main` rebuild.
- The shard environment timeout is 7 min (was 5) to fit `migrate`.

## Amendment
Reuse is an optimisation, so it must never be why a run fails:

- A fixture is upgraded only when its `sourceSha` is an ancestor of the commit under test
  (`restore-keys` returns the newest match, and `migrate` cannot move a database backwards).
  The restore job deepens its shallow checkout up to 300 commits to decide; anything it cannot
  prove is treated as a miss.
- Before shards start, the prepare job brings the upgraded fixture up exactly as a shard does
  (`migrate`, then server health). If that fails it posts a warning and rebuilds the fixture from
  scratch, which replaces the restored artifact for every shard.
