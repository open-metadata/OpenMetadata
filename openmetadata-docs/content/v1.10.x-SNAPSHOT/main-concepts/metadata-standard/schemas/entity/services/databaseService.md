---
title: databaseService
slug: /main-concepts/metadata-standard/schemas/entity/services/databaseservice
---

# Database Service

*This schema defines the `Database Service` is a service such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used for database service.*

## Properties

- **`id`**: Unique identifier of this database service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this database service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this database service.
- **`serviceType`**: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Refer to *#/definitions/databaseServiceType*.
- **`description`**: Description of a database service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`connection`**: Refer to *#/definitions/databaseConnection*.
- **`pipelines`**: References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReferenceList.json*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this Database Service. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`owners`**: Owners of this database service. Refer to *../../type/entityReferenceList.json*.
- **`href`**: Link to the resource corresponding to this database service. Refer to *../../type/basic.json#/definitions/href*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`domains`**: Domains the Database service belongs to. Refer to *../../type/entityReferenceList.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.
## Definitions

- **`databaseServiceType`** *(string)*: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Must be one of: `['BigQuery', 'BigTable', 'Mysql', 'Redshift', 'Snowflake', 'Postgres', 'Mssql', 'Oracle', 'Athena', 'Hive', 'Impala', 'Presto', 'Trino', 'Vertica', 'Glue', 'MariaDB', 'Druid', 'Db2', 'Clickhouse', 'Databricks', 'AzureSQL', 'DynamoDB', 'SingleStore', 'SQLite', 'DeltaLake', 'Salesforce', 'PinotDB', 'Datalake', 'DomoDatabase', 'QueryLog', 'CustomDatabase', 'Dbt', 'SapHana', 'MongoDB', 'Cassandra', 'Couchbase', 'Greenplum', 'Doris', 'UnityCatalog', 'SAS', 'Iceberg', 'Teradata', 'SapErp', 'Synapse', 'Exasol', 'Cockroach', 'SSAS', 'Epic']`.
- **`databaseConnection`** *(object)*: Database Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
