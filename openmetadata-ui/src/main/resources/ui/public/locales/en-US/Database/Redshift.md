# Redshift
In this section, we provide guides and references to use the Redshift connector. You can view the full documentation for Redshift <a href="https://docs.open-metadata.org/connectors/database/redshift" target="_blank">here</a>.

## Requirements

Redshift user must grant `SELECT` privilege on `SVV_TABLE_INFO` to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details <a href="https://docs.aws.amazon.com/redshift/latest/dg/r_CREATE_USER.html" target="_blank">https://docs.aws.amazon.com/redshift/latest/dg/r_CREATE_USER.html</a>
CREATE USER test_user with PASSWORD 'password';

-- Grant SELECT on table
GRANT SELECT ON TABLE svv_table_info to test_user;
```

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `SVV_TABLE_INFO` for all objects in the database. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

Information on **System Metrics** profiling can be found <a href="https://docs.open-metadata.org/latest/how-to-guides/data-quality-observability/profiler/metrics#redshift" target="_blank">here</a>.

### Usage & Lineage

For the usage and lineage workflow, the user will need `SELECT` privilege on:
- `SVV_TABLE_INFO`, `STL_QUERY`, `STL_QUERYTEXT`, `STL_SCAN` and `SVL_STORED_PROC_CALL` views for Provisioned cluster
- `SYS_QUERY_HISTORY`, `SYS_QUERY_TEXT`, `SYS_QUERY_DETAIL` and `SYS_PROCEDURE_CALL` for Serverless instance.
You can find more information on the usage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage" target="_blank">here</a> and the lineage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/lineage" target="_blank">here</a>.

You can find further information on the Redshift connector in the <a href="https://docs.open-metadata.org/connectors/database/redshift" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Username $(id="username")
Username to connect to Redshift. This user should have access to `SVV_TABLE_INFO` to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.
$$

$$section
### Password $(id="password")
Password to connect to Redshift.
$$

$$section
### Host Port $(id="hostPort")
This parameter specifies the host and port of the Redshift instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:5439`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:5439` as the value.
$$

$$section
### Cluster Identifier $(id="clusterIdentifier")
Redshift cluster identifier. Only used with IAM authentication on provisioned clusters.

For standard Redshift hostnames (`cluster-id.xxxxx.region.redshift.amazonaws.com`) the identifier is derived from the first DNS label of the host, so this field can stay empty. For PrivateLink/VPC endpoint hostnames (`vpce-xxx.vpce-svc-yyy.region.vpce.amazonaws.com`) and custom DNS names the first label is not the cluster identifier. IAM authentication then calls `GetClusterCredentials` with a wrong identifier and fails with `AccessDenied` or `ClusterNotFound`, depending on how the IAM policy is scoped. Set this field to the real cluster identifier to bypass host derivation entirely.

The value is shown in the AWS Console under **Amazon Redshift > Clusters** as "Cluster identifier" (e.g. `analytics-prod`), or via `aws redshift describe-clusters --query 'Clusters[].ClusterIdentifier'`. The IAM principal must be allowed `redshift:GetClusterCredentials` on the `dbuser` and `dbname` ARNs of this cluster.

Mutually exclusive with Workgroup Name: use Cluster Identifier for provisioned clusters, Workgroup Name for Redshift Serverless.
$$

$$section
### Workgroup Name $(id="workgroupName")
Redshift Serverless workgroup name. Only used with IAM authentication on Redshift Serverless.

For standard Serverless hostnames (`workgroup.account-id.region.redshift-serverless.amazonaws.com`) the workgroup is derived from the first DNS label of the host, so this field can stay empty. For PrivateLink/VPC endpoint hostnames (`vpce-...`) and custom DNS names, derivation fails and the connection is additionally misdetected as a provisioned cluster, because Serverless is recognized by the hostname pattern. Setting this field both fixes the workgroup and forces the Serverless credential API (`GetCredentials`).

The value is shown in the AWS Console under **Amazon Redshift > Redshift Serverless > Workgroups** (e.g. `default-workgroup`), or via `aws redshift-serverless list-workgroups --query 'workgroups[].workgroupName'`. The IAM principal must be allowed `redshift-serverless:GetCredentials` on the workgroup.

Mutually exclusive with Cluster Identifier: use Workgroup Name for Redshift Serverless, Cluster Identifier for provisioned clusters.
$$

$$section
### Database $(id="database")

Initial Redshift database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true. This should be specified as a string in the format `hostname:port`. E.g., `localhost:5439`, `host.docker.internal:5439`
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")
If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$

$$section
### SSL Mode $(id="sslMode")
SSL Mode to connect to redshift database. E.g, `prefer`, `verify-ca` etc.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation (`sslrootcert`).
$$
$$note
Redshift only needs CA Certificate
$$
$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Default Database Filter Pattern $(id="databaseFilterPattern")

Regex to only include/exclude databases that matches the pattern.
$$

$$section
### Default Schema Filter Pattern $(id="schemaFilterPattern")

Regex to only include/exclude schemas that matches the pattern.
$$

$$section
### Default Table Filter Pattern $(id="tableFilterPattern")

Regex to only include/exclude tables that matches the pattern.
$$


$$section
### Default Stored Procedure Filter Pattern $(id="storedProcedureFilterPattern")
Regex to only include/exclude stored procedures that matches the pattern.
$$