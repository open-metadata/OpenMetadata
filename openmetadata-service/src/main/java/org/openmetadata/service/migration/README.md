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

## Legacy feed tasks: 2.1.0 removal

The public feed task API is retired in 2.1.0. Clients must use `POST /v1/tasks`,
`GET /v1/tasks/{id}`, and `PUT /v1/tasks/{id}/resolve` or `/close`. The numeric IDs
previously used by `/v1/feed/tasks/{id}` are replaced by Task entity UUIDs. The migration
preserves each old thread's UUID as the new task's UUID.

Python clients must replace `resolve_feed_task` / `close_feed_task` with `resolve_task` /
`close_task`. Generated feed models no longer include task creation, resolution, or closure
payloads, and `Thread.type` no longer accepts `Task`.

The 2.1 migration sweeps `thread_entity`, `thread_entity_legacy`, and
`thread_entity_archived` for tasks created after the 2.0 migration. It preserves existing Task
entities on reruns and stops before archival if a legacy task cannot be migrated. A private
migration reader retains the historical task shape so older supported upgrades still work.

The deprecated `CreateApprovalTaskImpl` and `CreateRecognizerFeedbackApprovalTaskImpl`
listener names remain aliases to `CreateTask`. Removing those aliases is a separate compatibility
gate: no supported upgrade path may leave a Flowable process definition referring to either name.

Task lifecycle notifications use `entityCreated` / `entityUpdated` with `entityType=task`.
The retired `taskCreated`, `taskUpdated`, `taskResolved`, and `taskClosed` event values are
not available; tolerant event readers skip historical rows carrying those values.
