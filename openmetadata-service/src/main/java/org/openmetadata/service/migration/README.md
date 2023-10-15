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
