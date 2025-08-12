---
title: dbtS3Config
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtconfig/dbts3config
---

# DBT S3 Config

*DBT Catalog, Manifest and Run Results files in S3 bucket. We will search for catalog.json, manifest.json and run_results.json.*

## Properties

- **`dbtConfigType`** *(string)*: dbt Configuration type. Must be one of: `['s3']`. Default: `s3`.
- **`dbtSecurityConfig`**: Refer to *../../security/credentials/awsCredentials.json*.
- **`dbtPrefixConfig`** *(object)*: Details of the bucket where the dbt files are stored. Cannot contain additional properties.
  - **`dbtBucketName`** *(string)*: Name of the bucket where the dbt files are stored.
  - **`dbtObjectPrefix`** *(string)*: Path of the folder where the dbt files are stored.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
