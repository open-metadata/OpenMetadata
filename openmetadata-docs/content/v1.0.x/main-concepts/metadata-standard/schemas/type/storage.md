---
title: storage
slug: /main-concepts/metadata-standard/schemas/type/storage
---

# JSON Schema

*Definitions related to Storage Service.*

## Definitions

- **`storageServiceType`** *(string)*: Type of storage service such as S3, GCS, HDFS... Must be one of: `['S3', 'GCS', 'HDFS', 'ABFS']`.
- **`storageClassType`** *(string)*: Type of storage class for the storage service.
- **`s3StorageClass`** *(string)*: Type of storage class offered by S3. Must be one of: `['DEEP_ARCHIVE', 'GLACIER', 'INTELLIGENT_TIERING', 'ONEZONE_IA', 'OUTPOSTS', 'REDUCED_REDUNDANCY', 'STANDARD', 'STANDARD_IA']`.
- **`gcsStorageClass`** *(string)*: Type of storage class offered by GCS. Must be one of: `['ARCHIVE', 'COLDLINE', 'DURABLE_REDUCED_AVAILABILITY', 'MULTI_REGIONAL', 'NEARLINE', 'REGIONAL', 'STANDARD']`.
- **`abfsStorageClass`** *(string)*: Type of storage class offered by ABFS. Must be one of: `['ARCHIVE', 'HOT', 'COOL']`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
