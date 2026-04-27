# Migration Context

During the `MigrationWorkflow` execution we are executing validations on the data after each `MigrationProcess`. For
example, count the number of tables, users, or services.

1. At the `MigrationWorkflow::runMigrationWorkflows` we compute the `initial` context.
2. After each `MigrationProcess`, run the same queries and store the results.
3. In future iterations, we will compare the runs after each `MigrationProcess` to flag any unexpected diff.

## Common Operations

We have a set of queries that will always be executed. Those are defined in `CommonMigrationOps`.

## Migration Operations

Each `Migration` class can optionally override the `getMigrationOps` method, e.g.:

```java
@Override
  public List<MigrationOps> getMigrationOps() {
    return List.of(new MigrationOps("queryCount", "SELECT COUNT(*) FROM query_entity"));
  }
```

Then, the `MigrationProcess` implemented for that `Migration` version will execute this query on top of the common ones.

## Database Backup and Restore

The `OpenMetadataOperations` CLI provides commands to backup, restore, and test migrations against real data.

### Backup

Creates a `.tar.gz` archive of all OpenMetadata tables (excluding framework-managed tables like Flowable's `act_*`,
`flw_*`, and Quartz's `qrtz_*`). The file is auto-named as `openmetadata_<version>_<timestamp>.tar.gz`.

```bash
./openmetadata-ops.sh backup -c conf/openmetadata.yaml --backup-path /path/to/dir/
```

The archive contains:
- `metadata.json` — version, timestamp, database type, applied migration versions, and per-table column/type info
- `tables/<table_name>.json` — one JSON array of rows per table

### Restore

Drops all existing tables, runs migrations up to the backup's schema version, then inserts the backup data
in FK-safe topological order.

```bash
./openmetadata-ops.sh restore -c conf/openmetadata.yaml --backup-path /path/to/backup.tar.gz
```

### Batch size

Both `backup` and `restore` accept `--batch-size` (default: 1000) to control how many rows are read/written per batch.

## Testing Migrations

The `test-migration` command validates that migrations run correctly against real production-like data. It:

1. Drops all tables
2. Runs migrations up to the backup's schema version (recreates the schema as it was when the backup was taken)
3. Restores the backup data
4. Runs each pending migration one-by-one, executing before/after test assertions

```bash
./openmetadata-ops.sh test-migration -c conf/openmetadata.yaml --backup-path /path/to/backup.tar.gz
```

### Writing migration tests

Create a `MigrationTest` class under `migration/utils/` following the package naming convention
`v<major><minor><patch>` (e.g., `v1130` for version `1.13.0`):

```
migration/utils/v1130/MigrationTest.java   → runs for migration version 1.13.0
migration/utils/v1140/MigrationTest.java   → runs for migration version 1.14.0
```

Each test class implements `MigrationTestCase`:

```java
package org.openmetadata.service.migration.utils.v1130;

public class MigrationTest implements MigrationTestCase {

  @Override
  public List<TestResult> validateBefore(Handle handle) {
    // Query the database BEFORE this migration runs.
    // Verify preconditions — e.g., a column exists, data is in the expected format.
    return List.of(TestResult.pass("precondition check"));
  }

  @Override
  public List<TestResult> validateAfter(Handle handle) {
    // Query the database AFTER this migration runs.
    // Verify the migration transformed data correctly.
    return List.of(TestResult.pass("post-migration check"));
  }
}
```

`TestResult.pass(name)` and `TestResult.fail(name, detail)` are the two factory methods.

State can be shared between `validateBefore` and `validateAfter` via instance fields — the runner uses
the same instance for both calls. See `migration/utils/v1130/MigrationTest.java` for an example that
captures `preview` field values before migration and verifies the derived `enabled` field after.

### Workflow for validating a new migration

1. Take a backup of a database running the **current** released version:
   ```bash
   ./openmetadata-ops.sh backup -c conf/openmetadata.yaml --backup-path ./backups/
   ```
2. Write your migration code under `migration/` as usual.
3. Write a `MigrationTest` class for your version under `migration/utils/v<version>/`.
4. Run `test-migration` against the backup:
   ```bash
   ./openmetadata-ops.sh test-migration -c conf/openmetadata.yaml --backup-path ./backups/openmetadata_1_13_0_20260321T120000.tar.gz
   ```
5. Review the summary table — all tests should show `PASS`. If a migration fails, the runner stops
   and reports the partially-migrated state so you can fix and re-run.
