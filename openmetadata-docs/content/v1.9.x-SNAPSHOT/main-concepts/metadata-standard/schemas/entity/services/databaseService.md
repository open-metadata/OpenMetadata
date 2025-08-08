---
title: Database Service | `brandName` Database Service
description: Capture metadata for database services including type, connectivity, and schema support.
slug: /main-concepts/metadata-standard/schemas/entity/services/databaseservice
---

# Database Service

*This schema defines the `Database Service` is a service such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used for database service.*

## Properties

- **`id`**: Unique identifier of this database service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this database service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this database service.
- **`serviceType`**: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Refer to *[#/definitions/databaseServiceType](#definitions/databaseServiceType)*.
- **`description`**: Description of a database service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`connection`**: Refer to *[#/definitions/databaseConnection](#definitions/databaseConnection)*.
- **`pipelines`**: References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this Database Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`owners`**: Owners of this database service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`href`**: Link to the resource corresponding to this database service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domain`**: Domain the Database service belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`databaseServiceType`** *(string)*: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Must be one of: `["BigQuery", "BigTable", "Mysql", "Redshift", "Snowflake", "Postgres", "Mssql", "Oracle", "Athena", "Hive", "Impala", "Presto", "Trino", "Vertica", "Glue", "MariaDB", "Druid", "Db2", "Clickhouse", "Databricks", "AzureSQL", "DynamoDB", "SingleStore", "SQLite", "DeltaLake", "Salesforce", "PinotDB", "Datalake", "DomoDatabase", "QueryLog", "CustomDatabase", "Dbt", "SapHana", "MongoDB", "Cassandra", "Couchbase", "Greenplum", "Doris", "UnityCatalog", "SAS", "Iceberg", "Teradata", "SapErp", "Synapse", "Exasol", "Cockroach"]`.
- **`databaseConnection`** *(object)*: Database Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[./connections/database/bigQueryConnection.json](#connections/database/bigQueryConnection.json)*.
      - : Refer to *[./connections/database/bigTableConnection.json](#connections/database/bigTableConnection.json)*.
      - : Refer to *[./connections/database/athenaConnection.json](#connections/database/athenaConnection.json)*.
      - : Refer to *[./connections/database/azureSQLConnection.json](#connections/database/azureSQLConnection.json)*.
      - : Refer to *[./connections/database/clickhouseConnection.json](#connections/database/clickhouseConnection.json)*.
      - : Refer to *[./connections/database/databricksConnection.json](#connections/database/databricksConnection.json)*.
      - : Refer to *[./connections/database/db2Connection.json](#connections/database/db2Connection.json)*.
      - : Refer to *[./connections/database/deltaLakeConnection.json](#connections/database/deltaLakeConnection.json)*.
      - : Refer to *[./connections/database/druidConnection.json](#connections/database/druidConnection.json)*.
      - : Refer to *[./connections/database/dynamoDBConnection.json](#connections/database/dynamoDBConnection.json)*.
      - : Refer to *[./connections/database/glueConnection.json](#connections/database/glueConnection.json)*.
      - : Refer to *[./connections/database/hiveConnection.json](#connections/database/hiveConnection.json)*.
      - : Refer to *[./connections/database/impalaConnection.json](#connections/database/impalaConnection.json)*.
      - : Refer to *[./connections/database/mariaDBConnection.json](#connections/database/mariaDBConnection.json)*.
      - : Refer to *[./connections/database/mssqlConnection.json](#connections/database/mssqlConnection.json)*.
      - : Refer to *[./connections/database/mysqlConnection.json](#connections/database/mysqlConnection.json)*.
      - : Refer to *[./connections/database/sqliteConnection.json](#connections/database/sqliteConnection.json)*.
      - : Refer to *[./connections/database/oracleConnection.json](#connections/database/oracleConnection.json)*.
      - : Refer to *[./connections/database/postgresConnection.json](#connections/database/postgresConnection.json)*.
      - : Refer to *[./connections/database/prestoConnection.json](#connections/database/prestoConnection.json)*.
      - : Refer to *[./connections/database/redshiftConnection.json](#connections/database/redshiftConnection.json)*.
      - : Refer to *[./connections/database/salesforceConnection.json](#connections/database/salesforceConnection.json)*.
      - : Refer to *[./connections/database/singleStoreConnection.json](#connections/database/singleStoreConnection.json)*.
      - : Refer to *[./connections/database/snowflakeConnection.json](#connections/database/snowflakeConnection.json)*.
      - : Refer to *[./connections/database/trinoConnection.json](#connections/database/trinoConnection.json)*.
      - : Refer to *[./connections/database/verticaConnection.json](#connections/database/verticaConnection.json)*.
      - : Refer to *[./connections/database/pinotDBConnection.json](#connections/database/pinotDBConnection.json)*.
      - : Refer to *[./connections/database/datalakeConnection.json](#connections/database/datalakeConnection.json)*.
      - : Refer to *[./connections/database/domoDatabaseConnection.json](#connections/database/domoDatabaseConnection.json)*.
      - : Refer to *[./connections/database/customDatabaseConnection.json](#connections/database/customDatabaseConnection.json)*.
      - : Refer to *[./connections/database/sapHanaConnection.json](#connections/database/sapHanaConnection.json)*.
      - : Refer to *[./connections/database/mongoDBConnection.json](#connections/database/mongoDBConnection.json)*.
      - : Refer to *[./connections/database/cassandraConnection.json](#connections/database/cassandraConnection.json)*.
      - : Refer to *[./connections/database/couchbaseConnection.json](#connections/database/couchbaseConnection.json)*.
      - : Refer to *[./connections/database/greenplumConnection.json](#connections/database/greenplumConnection.json)*.
      - : Refer to *[./connections/database/dorisConnection.json](#connections/database/dorisConnection.json)*.
      - : Refer to *[./connections/database/unityCatalogConnection.json](#connections/database/unityCatalogConnection.json)*.
      - : Refer to *[./connections/database/sasConnection.json](#connections/database/sasConnection.json)*.
      - : Refer to *[./connections/database/icebergConnection.json](#connections/database/icebergConnection.json)*.
      - : Refer to *[./connections/database/teradataConnection.json](#connections/database/teradataConnection.json)*.
      - : Refer to *[./connections/database/sapErpConnection.json](#connections/database/sapErpConnection.json)*.
      - : Refer to *[./connections/database/synapseConnection.json](#connections/database/synapseConnection.json)*.
      - : Refer to *[./connections/database/exasolConnection.json](#connections/database/exasolConnection.json)*.
      - : Refer to *[./connections/database/cockroachConnection.json](#connections/database/cockroachConnection.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
