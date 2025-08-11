---
title: Troubleshooting Common Connector Issues 
slug: /connectors/troubleshooting
---

# Connector Troubleshooting Guide

This guide provides instructions to help resolve common issues encountered during connector setup and metadata ingestion in OpenMetadata. Below are some of the most frequently observed troubleshooting scenarios.

- [ADLS Datalake](#adls-datalake)
- [AzureSQL](#azuresql)
- [Databricks](#databricks)
- [Domo Database](#domo-database)
- [Hive](#hive)
- [Impala](#impala)
- [MSSQL](#mssql)
- [PostgreSQL](#postgresql)
- [Redshift](#redshift)
- [S3 Datalake](#s3-datalake)
- [Vertica](#vertica)
- [Kafka](#kafka)
- [Nifi](#nifi)

## How to Enable Debug Logging for Any Ingestion

To enable debug logging for any ingestion workflow in OpenMetadata:

1. **Navigate to Services**
   Go to **Settings > Services > Service Type** (e.g., Database) in the OpenMetadata UI.

2. **Select a Service**
   Choose the specific service for which you want to enable debug logging.

{% image
  src="/images/v1.7/connectors/debug/debug1.png"
  alt="Select a Service"
  caption="Select a Service"
/%}

3. **Access Ingestion Tab**
Go to the **Ingestion tab** and click the three-dot menu on the right-hand side of the ingestion type, and select Edit.

{% image
  src="/images/v1.7/connectors/debug/debug2.png"
  alt="Access Agents Tab"
  caption="Access Agents Tab"
/%}

4. **Enable Debug Logging**
   In the configuration dialog, enable the **Debug Log** option and click **Next**.

{% image
  src="/images/v1.7/connectors/debug/debug3.png"
  alt="Enable Debug Logging"
  caption="Enable Debug Logging"
/%}

5. **Schedule and Submit**
   Configure the schedule if needed and click **Submit** to apply the changes.

{% image
  src="/images/v1.7/connectors/debug/debug4.png"
  alt="Schedule and Submit"
  caption="Schedule and Submit"
/%}

## Permission Issues

If you encounter permission-related errors during connector setup or metadata ingestion, ensure that all the prerequisites and access configurations specified for each connector are properly implemented. Refer to the connector-specific documentation to verify the required permissions.

## ADLS Datalake

Learn how to resolve the most common problems people encounter in the ADLS Datalake connector.

#### **'Azure Datalake'** credentials details

##### Where can I find 'Client Secret' from.

- Login to `Azure Portal`
- Find and click on your application 
- Select `Certificates & Secret` under `Manage` Section

{% image
src="/images/v1.7/connectors/datalake/troubleshoot-clientId.png"
alt="Configure service connection"
caption="Find Client ID" /%}

## AzureSQL

Learn how to resolve the most common problems people encounter in the AzureSQL connector.

* **Unknown error connecting with Engine [...]; An attempt to complete a transaction has failed. No corresponding transaction found. (111214) (SQLEndTran)**

This is an exception you can get when trying to connect to AzureSQL using SQLAlchemy (the internal OpenMetadata Ingestion
library for reaching databases).

To solve this issue, you can edit your Service Connection by adding the following **Connection Argument**:
- Key: `autocommit`
- Value: `true`

{% image
src="/images/v1.7/connectors/azuresql/autocommit.png"
alt="autocommit" /%}
 
* **Cannot open server '[server name]' requested by the login. Client with IP address '[your IP]' is not allowed to access the server**

This is an exception you can get when trying to connect to AzureSQL using SQLAlchemy (the internal OpenMetadata Ingestion library for reaching databases).


To solve this issue, you need to add your IP address in firewall rules for your Azure SQL instance.

{% image
src="/images/v1.7/connectors/azuresql/azure-firewall.png"
alt="azure sql firewall rules"
caption="azure sql firewall rules" /%}

## Databricks

### Databricks connection details

```
source:
  type: databricks
  serviceName: local_databricks
  serviceConnection:
    config:
      catalog: hive_metastore
      databaseSchema: default
      token: <databricks token>
      hostPort: localhost:443
      connectionArguments:
        http_path: <http path of databricks cluster>
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

Here are the steps to get `hostPort`, `token` and `http_path`.

First login to Azure Databricks and from side bar select SQL Warehouse (In SQL section)


{% image
src="/images/v1.7/connectors/databricks/select-sql-warehouse.png"
alt="Select Sql Warehouse"
caption="Select Sql Warehouse" /%}


Now click on sql Warehouse from the SQL Warehouses list.


{% image
src="/images/v1.7/connectors/databricks/Open-sql-warehouse.png"
alt="Open Sql Warehouse"
caption="Open Sql Warehouse" /%}


Now inside that page go to Connection details section.
In this page Server hostname and Port is your `hostPort`, HTTP path is your `http_path`.



{% image
src="/images/v1.7/connectors/databricks/Connection-details.png"
alt="Connection details"
caption="Connection details" /%}


In Connection details section page click on Create a personal access token.

{% image
src="/images/v1.7/connectors/databricks/Open-create-tocken-page.png"
alt="Open create tocken"
caption="Open create tocken" /%}



Now In this page you can create new `token`.


{% image
src="/images/v1.7/connectors/databricks/Generate-token.png"
alt="Generate tocken"
caption="Generate tocken" /%}

## Domo Database

Learn how to resolve the most common problems people encounter in the Domo Database connector.

### How to find clientId?
* You can find your `clientId` by [logging](https://developer.domo.com/) into your domo instance.
* After that click on `My Account`> `Manage Clients`(if created).

{% image
src="/images/v1.7/connectors/domodatabase/client-id.png"
alt="Client-id"
caption="Find Services under the Settings menu" /%}

### Where to find accessToken?
* You need to generate accessToken.
* [Login](https://www.domo.com/login) into your sandbox domain ex. `<your-domain>.domo.com`.
* Click on the `MORE` button on navbar, after that click on `Admin`.
* Under `Authentication` you will find `Access tokens`.

{% image
src="/images/v1.7/connectors/domodatabase/access-token.png"
alt="Access Token"
caption="access-token" /%}


### Where can I find my scopes?
* Scopes can be find Under `Manage Clients` section in `My Account` (If client not found, click [here](#how-to-find-clientid))

{% image
src="/images/v1.7/connectors/domodatabase/scopes.jpeg"
alt="Scopes"
caption="Scopes" /%}

## Hive

Learn how to resolve the most common problems people encounter in the Hive connector.

### Connection Timeout

You might be getting `thrift.transport.TTransport.TTransportException: TSocket read 0 bytes`.

Make sure that if there is a Load Balancer in between OpenMetadata and Hive, the LB timeout
is not impacting the ingestion. For example, when extracting data with a lot of partitions the `DESCRIBE`
command might take more than 60 seconds, so a Load Balancer with `Idle Timeout` at 60 seconds would
kill the connection.

## Impala

Learn how to resolve the most common problems people encounter in the Impala connector.

### Connection Timeout

You might be getting `thrift.transport.TTransport.TTransportException: TSocket read 0 bytes`.

Make sure that if there is a Load Balancer in between OpenMetadata and Impala, the LB timeout
is not impacting the ingestion. For example, when extracting data with a lot of partitions the `DESCRIBE`
command might take more than 60 seconds, so a Load Balancer with `Idle Timeout` at 60 seconds would
kill the connection.

## MSSQL

### Resolving SQL Server Authentication Issue for Windows User  

This guide addresses a common issue when connecting to a SQL Server instance using Windows OS. If you encounter the error below, follow the steps outlined to resolve it effectively.  

### Error Description  
When attempting to connect to SQL Server using a Windows user, the following error appears:  

```
(pyodbc.InterfaceError) ('28000', "[28000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Login failed for user 'domain\\user'. (18456)")
```

Additionally, the SQL Server logs display:

```
Login failed for user 'domain\user'. Reason: Attempting to use an NT account name with SQL Server Authentication.
```
### Root Cause  
The error occurs because the connection is configured to use SQL Server Authentication instead of Windows Authentication. Windows Authentication requires a connection scheme that supports integrated security.  

### Resolution  

### Step 1: Verify Connection Configuration  
1. Ensure that you are connecting to SQL Server using **Windows Authentication**.  
2. Update the connection scheme to use `mssql+pymssql` instead of `mssql.pyodbc`.  

### Step 2: Update the Connection Details in Collate  
1. Navigate to **MSSQL Service Configuration** in the Collate UI.  
2. Update the **Connection Scheme** to `mssql+pymssql`.  
3. Retain the following connection details:  
   - **Host and Port**: e.g., `10.121.89.148:62452`.  
   - **Database**: Specify the target database (e.g., `OneSumx_Stoging`).  
   - **Username**: Use the Windows account username, e.g., `domain\user`.  
4. Save the updated configuration.  

### Step 3: Test the Connection  
1. After saving the changes, click **Test Connection** in the Collate UI.  
2. Confirm that the following steps pass successfully:  
   - **CheckAccess**  
   - **GetDatabases**  
   - **GetSchemas**  
   - **GetTables**  
   - **GetViews**  
   - **GetQueries**  

### Expected Outcome  
After updating the connection scheme, the connection should succeed. The status will display:

```
Connection Status: Success
```

## PostgreSQL

Learn how to resolve the most common problems people encounter in the PostgreSQL connector.

### Column XYZ does not exist

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

### Error: `no pg_hba.conf entry for host`

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

## Redshift

Learn how to resolve the most common problems people encounter in the Redshift connector.

### Connection Error

```
connection to server at \"<host>:<port>\" (@IP),
<port> failed: server certificate for \"\*<host>:<port>\"
does not match host name \"<host>:<port>\"
```

If you get this error that time please pass `{'sslmode': 'verify-ca'}` in the connection arguments.

{% image
src="/images/v1.7/connectors/redshift/service-connection-arguments.png"
alt="Configure service connection"
caption="Configure the service connection by filling the form" /%}

### Metdata Ingestion Failure

If your metadata ingesiton fails and you have errors like:

```text
RuntimeError: Table entity not found: [<default>.pg_class]
RuntimeError: Table entity not found: [<default>.pg_constraint]
```

This is because the schema `information_schema` is being ingested and the ingestion bot does not have the permissions
to access it. It is recommended to exclude the schema `information_schema` unless you explicitly need to ingest it
like in [the example config](https://github.com/open-metadata/OpenMetadata/blob/2477bbc9ca398c33703c85627cdd26bc2c27aad3/ingestion/src/metadata/examples/workflows/redshift.yaml#L16).

```yaml
# ...
source:
  # ...
  type: redshift
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        excludes:
        - information_schema.*
# ...
```

## S3 Datalake

Learn how to resolve the most common problems people encounter in the S3 Datalake connector.

* **'Access Denied' error when reading from S3 bucket**

Please, ensure you have a Bucket Policy with the permissions explained in the requirement section [here](/connectors/database/s3-datalake).

## Unity Catalog

### Unity Catalog connection details

```
source:
  type: unitycatalog
  serviceName: local_unity_catalog
  serviceConnection:
    config:
      catalog: hive_metastore
      databaseSchema: default
      token: <databricks token>
      hostPort: localhost:443
      connectionArguments:
        http_path: <http path of databricks cluster>
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

Here are the steps to get `hostPort`, `token` and `http_path`.

First login to Azure Databricks and from side bar select SQL Warehouse (In SQL section)


{% image
src="/images/v1.7/connectors/unitycatalog/select-sql-warehouse.png"
alt="Select Sql Warehouse"
caption="Select Sql Warehouse" /%}


Now click on sql Warehouse from the SQL Warehouses list.


{% image
src="/images/v1.7/connectors/unitycatalog/Open-sql-warehouse.png"
alt="Open Sql Warehouse"
caption="Open Sql Warehouse" /%}


Now inside that page go to Connection details section.
In this page Server hostname and Port is your `hostPort`, HTTP path is your `http_path`.



{% image
src="/images/v1.7/connectors/unitycatalog/Connection-details.png"
alt="Connection details"
caption="Connection details" /%}


In Connection details section page click on Create a personal access token.

{% image
src="/images/v1.7/connectors/unitycatalog/Open-create-token-page.png"
alt="Open create token"
caption="Open create token" /%}



Now In this page you can create new `token`.


{% image
src="/images/v1.7/connectors/unitycatalog/Generate-token.png"
alt="Generate token"
caption="Generate token" /%}

## Vertica

Learn how to resolve the most common problems people encounter in the Vertica connector.

### Profiler: New session rejected

If you see the following error when computing the profiler `New session rejected due to limit, already XYZ sessions active`,
it means that the number of threads configured in the profiler workflow is exceeding the connection limits of your
Vertica instance.

Note that by default the profiler runs with 5 threads. In case you see this error, you might need to reduce this number.

## Kafka

### Consumer and schema registry config

When configuring the Kafka connector, we could need to pass extra parameters to the consumer or the schema registry to
be able to connect. The accepted values for the consumer can be found in the following
[link](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md), while the ones optional for
the schema registry are [here](https://docs.confluent.io/platform/current/clients/confluent-kafka-python/html/index.html#schemaregistryclient).

If you encounter issues connecting to the Schema Registry, ensure that the protocol is explicitly specified in the Schema Registry URL. For example:
- Use `http://localhost:8081` instead of `localhost:8081`.
The Schema Registry requires a properly formatted URL, including the protocol (`http://` or `https://`). While this differentiation is expected in the Schema Registry configuration, it may not be immediately apparent.

In case you are performing the ingestion through the CLI with a YAML file, the service connection config should look
like this:

```yaml
  serviceConnection:
    config:
      type: Kafka
      bootstrapServers: localhost:9092
      schemaRegistryURL: http://localhost:8081
      consumerConfig:
        "ssl.truststore.password": "password"
      schemaRegistryConfig:
        "basic.auth.user.info": "username:password"
```

### Connecting to Confluent Cloud Kafka

If you are using Confluent kafka and SSL encryption is enabled you need to add `security.protocol` as key and `SASL_SSL` as value under Consumer Config

## Nifi

Learn how to resolve the most common problems people encounter in the Nifi connector.

### No applicable policies could be found

If you see the error `No applicable policies could be found. Contact the system administrator` during the Test
Connection or when running the ingestion, you will need to add the missing policies in the Nifi instance.

You can find more information in this [link](https://community.cloudera.com/t5/Support-Questions/API-call-to-nifi-api-resources-results-in-quot-No-applicable/td-p/363534).

The accepted answer is to add a policy to `authorizations.xml` as follows:

```xml
<policy identifier="0c6d205e-9153-4bcd-9534-aeb029c65e10" resource="/resources" action="R">
    <group identifier="2c7ce5db-0186-1000-ffff-ffffdbb1315d"/>
</policy>
```
