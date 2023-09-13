---
title: Postgres Connector Troubleshooting
slug: /connectors/database/postgres/troubleshooting
---

# Troubleshooting

Learn how to resolve the most common problems people encounter in the Postgres connector.

## Column XYZ does not exist

If when running the metadata ingestion workflow you get a similar error to:

```
Traceback (most recent call last):
  File "/usr/local/lib/python3.9/site-packages/airflow/models/taskinstance.py", line 1165, in _run_raw_task
    self._prepare_and_execute_task_with_callbacks(context, task)
  File "/usr/local/lib/python3.9/site-packages/airflow/models/taskinstance.py", line 1283, in _prepare_and_execute_task_with_callbacks
    result = self._execute_task(context, task_copy)
  File "/usr/local/lib/python3.9/site-packages/airflow/models/taskinstance.py", line 1313, in _execute_task
    result = task_copy.execute(context=context)
  File "/usr/local/lib/python3.9/site-packages/airflow/operators/python.py", line 150, in execute
    return_value = self.execute_callable()
  File "/usr/local/lib/python3.9/site-packages/airflow/operators/python.py", line 161, in execute_callable
    return self.python_callable(*self.op_args, **self.op_kwargs)
  File "/usr/local/lib/python3.9/site-packages/openmetadata/workflows/ingestion/common.py", line 114, in metadata_ingestion_workflow
    workflow.execute()
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/api/workflow.py", line 161, in execute
    for record in self.source.next_record():
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/api/topology_runner.py", line 104, in next_record
    yield from self.process_nodes(get_topology_root(self.topology))
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/api/topology_runner.py", line 89, in process_nodes
    yield from self.process_nodes(child_nodes)
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/api/topology_runner.py", line 89, in process_nodes
    yield from self.process_nodes(child_nodes)
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/api/topology_runner.py", line 89, in process_nodes
    yield from self.process_nodes(child_nodes)
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/api/topology_runner.py", line 67, in process_nodes
    for element in node_producer() or []:
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/source/database/common_db_source.py", line 210, in get_tables_name_and_type
    if self.is_partition(
  File "/usr/local/lib/python3.9/site-packages/metadata/ingestion/source/database/postgres.py", line 87, in is_partition
    cur.execute(
psycopg2.errors.UndefinedColumn: column "relispartition" does not exist
LINE 2:                 SELECT relispartition as is_partition
```

Then you might be using an unsupported postgres version. If we double-check the requirements for the postgres connector:
Note that we only support officially supported Postgres versions. You can check the version list [here](https://www.postgresql.org/support/versioning/).
