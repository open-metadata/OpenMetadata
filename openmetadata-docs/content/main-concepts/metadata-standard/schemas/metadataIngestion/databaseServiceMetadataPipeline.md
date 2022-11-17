---
title: databaseServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicemetadatapipeline
---

# DatabaseServiceMetadataPipeline

*DatabaseService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/databaseMetadataConfigType*. Default: `DatabaseMetadata`.
- **`markDeletedTables`** *(boolean)*: Optional configuration to soft delete tables in OpenMetadata if the source tables are deleted. Default: `True`.
- **`markDeletedTablesFromFilterOnly`** *(boolean)*: Optional configuration to mark deleted tables only to the filtered schema. Default: `False`.
- **`includeTables`** *(boolean)*: Optional configuration to turn off fetching metadata for tables. Default: `True`.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `True`.
- **`includeTags`** *(boolean)*: Optional configuration to turn off fetching metadata for tags. Default: `True`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`dbtConfigSource`**: Available sources to fetch DBT catalog and manifest files.
## Definitions

- **`databaseMetadataConfigType`** *(string)*: Database Source Config Metadata Pipeline type. Must be one of: `['DatabaseMetadata']`. Default: `DatabaseMetadata`.
- **`dbtBucketDetails`** *(object)*: Details of the bucket where the dbt files are stored. Cannot contain additional properties.
  - **`dbtBucketName`** *(string)*: Name of the bucket where the dbt files are stored.
  - **`dbtObjectPrefix`** *(string)*: Path of the folder where the dbt files are stored.
- **`dbtCloudConfig`** *(object)*: DBT Cloud configuration. Cannot contain additional properties.
  - **`dbtCloudAuthToken`** *(string)*: DBT cloud account authentication token.
  - **`dbtCloudAccountId`** *(string)*: DBT cloud account Id.
- **`dbtLocalConfig`** *(object)*: DBT Catalog, Manifest and Run Results file path config. Cannot contain additional properties.
  - **`dbtCatalogFilePath`** *(string)*: DBT catalog file path to extract dbt models with their column schemas.
  - **`dbtManifestFilePath`** *(string)*: DBT manifest file path to extract dbt models and associate with tables.
  - **`dbtRunResultsFilePath`** *(string)*: DBT run results file path to extract the test results information.
- **`dbtHttpConfig`** *(object)*: DBT Catalog, Manifest and Run Results HTTP path configuration. Cannot contain additional properties.
  - **`dbtCatalogHttpPath`** *(string)*: DBT catalog http file path to extract dbt models with their column schemas.
  - **`dbtManifestHttpPath`** *(string)*: DBT manifest http file path to extract dbt models and associate with tables.
  - **`dbtRunResultsHttpPath`** *(string)*: DBT run results http file path to extract the test results information.
- **`dbtS3Config`**: DBT Catalog, Manifest and Run Results files in S3 bucket. We will search for catalog.json, manifest.json and run_results.json.
  - **`dbtSecurityConfig`**: Refer to *../security/credentials/awsCredentials.json*.
  - **`dbtPrefixConfig`**: Refer to *#/definitions/dbtBucketDetails*.
- **`dbtGCSConfig`**: DBT Catalog, Manifest and Run Results files in GCS storage. We will search for catalog.json, manifest.json and run_results.json.
  - **`dbtSecurityConfig`**: Refer to *../security/credentials/gcsCredentials.json*.
  - **`dbtPrefixConfig`**: Refer to *#/definitions/dbtBucketDetails*.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
