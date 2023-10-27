---
title: dbtGCSConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtconfig/dbtgcsconfig
---

# DBT GCS Config

*DBT Catalog, Manifest and Run Results files in GCS storage. We will search for catalog.json, manifest.json and run_results.json.*

## Properties

- **`dbtSecurityConfig`**: Refer to *[../../security/credentials/gcpCredentials.json](#/../security/credentials/gcpCredentials.json)*.
- **`dbtPrefixConfig`** *(object)*: Details of the bucket where the dbt files are stored. Cannot contain additional properties.
  - **`dbtBucketName`** *(string)*: Name of the bucket where the dbt files are stored.
  - **`dbtObjectPrefix`** *(string)*: Path of the folder where the dbt files are stored.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
