---
title: databaseServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataIngestion/databaseservicemetadatapipeline
---

# DatabaseServiceMetadataPipeline

*DatabaseService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/databaseMetadataConfigType*. Default: `DatabaseMetadata`.
- **`markDeletedTables`** *(boolean)*: Optional configuration to soft delete tables in OpenMetadata if the source tables are deleted. Default: `True`.
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
- **`dbtCloudConfig`** *(object)*: DBT Catalog and Manifest HTTP path configuration. Cannot contain additional properties.
  - **`dbtCloudAuthToken`** *(string)*: DBT cloud account authentication token.
  - **`dbtCloudAccountId`** *(string)*: DBT cloud account Id.
- **`dbtLocalConfig`** *(object)*: DBT Catalog and Manifest file path config. Cannot contain additional properties.
  - **`dbtCatalogFilePath`** *(string)*: DBT catalog file path to extract dbt models with their column schemas.
  - **`dbtManifestFilePath`** *(string)*: DBT manifest file path to extract dbt models and associate with tables.
- **`dbtHttpConfig`** *(object)*: DBT Catalog and Manifest HTTP path configuration. Cannot contain additional properties.
  - **`dbtCatalogHttpPath`** *(string)*: DBT catalog http file path to extract dbt models with their column schemas.
  - **`dbtManifestHttpPath`** *(string)*: DBT manifest http file path to extract dbt models and associate with tables.
- **`dbtS3Config`**: DBT Catalog and Manifest files in S3 bucket. We will search for catalog.json and manifest.json.
  - **`dbtSecurityConfig`**: Refer to *../security/credentials/awsCredentials.json*.
  - **`dbtPrefixConfig`**: Refer to *#/definitions/dbtBucketDetails*.
- **`dbtGCSConfig`**: DBT Catalog and Manifest files in GCS storage. We will search for catalog.json and manifest.json.
  - **`dbtSecurityConfig`**: Refer to *../security/credentials/gcsCredentials.json*.
  - **`dbtPrefixConfig`**: Refer to *#/definitions/dbtBucketDetails*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
