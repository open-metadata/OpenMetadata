---
title: databaseService
slug: /main-concepts/metadata-standard/schemas/entity/services/databaseservice
---

# Database Service

*This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used for database service.*

## Properties

- **`id`**: Unique identifier of this database service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this database service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this database service.
- **`serviceType`**: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Refer to *#/definitions/databaseServiceType*.
- **`description`**: Description of a database service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`connection`**: Refer to *#/definitions/databaseConnection*.
- **`pipelines`**: References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`owner`**: Owner of this database service. Refer to *../../type/entityReference.json*.
- **`href`**: Link to the resource corresponding to this database service. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`databaseServiceType`** *(string)*: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Must be one of: `['BigQuery', 'Mysql', 'Redshift', 'Snowflake', 'Postgres', 'Mssql', 'Hive', 'Impala', 'Oracle', 'Athena', 'Presto', 'Trino', 'Vertica', 'Glue', 'MariaDB', 'Druid', 'Db2', 'Clickhouse', 'Databricks', 'DynamoDB', 'AzureSQL', 'SingleStore', 'SQLite', 'DeltaLake', 'Salesforce', 'SampleData', 'PinotDB', 'Datalake']`.
- **`databaseConnection`** *(object)*: Database Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
