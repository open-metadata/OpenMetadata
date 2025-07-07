---
title: PostgreSQL Connector Troubleshooting
slug: /connectors/database/postgres/troubleshooting
---

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

## Troubleshooting: `pg_stat_statements` Relation Does Not Exist

**Issue**  
When running a query through OpenMetadata, you may encounter the following error:


```sql
(psycopg2.errors.UndefinedTable) relation "pg_stat_statements" does not exist
LINE 9:         pg_stat_statements s
```

**Cause**  
This error occurs because the PostgreSQL extension `pg_stat_statements` is not enabled. This extension is required to access query execution statistics, which are used by OpenMetadata for usage and performance insights.

**Solution**  
Enable the `pg_stat_statements` extension in your PostgreSQL instance. You can do this by executing the following command as a superuser:

```sql
CREATE EXTENSION pg_stat_statements;
```

Additionally, ensure the extension is loaded at server startup by setting the following in your `postgresql.conf`:

```sql
shared_preload_libraries = 'pg_stat_statements'
```

After making this change, restart the PostgreSQL server.

For more details, refer to the official PostgreSQL documentation: [pg_stat_statements – PostgreSQL](https://www.postgresql.org/docs/current/pgstatstatements.html)

Learn how to resolve the most common problems people encounter in the PostgreSQL connector.

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
Note that we only support officially supported PostgreSQL versions. You can check the version list [here](https://www.postgresql.org/support/versioning/).

## Error: `no pg_hba.conf entry for host`

When trying to connect to a PostgreSQL server hosted on Azure/AWS using basic authentication, the connection may fail with the following error message:

```
(psycopg2.OperationalError) FATAL: no pg_hba.conf entry for host "x.xx.xxx.x", user "xxxxxx", database "xxxxx", no encryption
```


This error generally indicates that the host trying to access the PostgreSQL server is not permitted according to the server's `pg_hba.conf` configuration, which manages authentication.

1. **Whitelist the IP address**  
   Ensure that the IP address provided by the OpenMetadata Service wizard is whitelisted in the Azure network firewall rules. You should also verify that the correct IP is added in the firewall for the database to allow connections from OpenMetadata.

2. **Check pg_hba.conf File**  
   While Azure-managed PostgreSQL doesn't allow direct access to modify the `pg_hba.conf` file, you can control access using Azure Firewall rules. Ensure that the IP address attempting to connect is allowed.

3. **Verify Network Access**  
   Ensure that the PostgreSQL server is accessible from the internet for the allowed IP addresses. If the server is behind a VPN or private network, adjust the network settings accordingly.

4. **Adjust SSL Mode**  
   The error could also be related to SSL settings. Setting the SSL mode to `allow` can help resolve this issue. Modify the connection settings in the OpenMetadata Service configuration to:

```
SSL Mode: Allow
```

This will allow the connection even if SSL is not enforced by the server.

## Error: `PAM authentication failed for user "<user>"`

If you are facing this error, it means that the user you are using to connect to the database does not have the necessary IAM permissions.

In order to be able to connect via IAM, you need to have the following:

1. Database is configured to use IAM authentication
Ensure that the RDS has IAM DB authentication enabled. Otherwise, you can click on Modify to enable it.

2. The user has the necessary IAM permissions
Even if you use IAM to connect to postgres, you need to specify a user to prepare the connection. You need to create a user as follows:

```sql
CREATE USER iam_user WITH LOGIN;
GRANT rds_iam TO iam_user;
```
3. The AWS Role has the necessary permissions
The role that is going to be used to perform the ingestion, needs to have the following permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "rds-db:connect"
            ],
            "Resource": [
                "arn:aws:rds-db:eu-west-1:<aws_account_number>:dbuser:<rds_db_resource_id>/<postgres_user>"
            ]
        }
    ]
}
```