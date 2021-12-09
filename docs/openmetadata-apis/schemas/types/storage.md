Definitions related to Storage Service.

**$id:**[**https://open-metadata.org/schema/entity/type/storage.json**](https://open-metadata.org/schema/type/storage.json)


## Type definitions in this schema

### storageServiceType

- Type of storage service such as S3, GCS, HDFS...
- Type: `string`
- The value is restricted to the following: 
  1. _"S3"_
  2. _"GCS"_
  3. _"HDFS"_
  4. _"ABFS"_


### storageClassType

- Type of storage class for the storage service.
- Type: `string`


### s3StorageClass

- Type of storage class offered by S3.
- Type: `string`
- The value is restricted to the following: 
  1. _"DEEP_ARCHIVE"_
  2. _"GLACIER"_
  3. _"INTELLIGENT_TIERING"_
  4. _"ONEZONE_IA"_
  5. _"OUTPOSTS"_
  6. _"REDUCED_REDUNDANCY"_
  7. _"STANDARD"_
  8. _"STANDARD_IA"_


### gcsStorageClass

- Type of storage class offered by GCS.
- Type: `string`
- The value is restricted to the following: 
  1. _"ARCHIVE"_
  2. _"COLDLINE"_
  3. _"DURABLE_REDUCED_AVAILABILITY"_
  4. _"MULTI_REGIONAL"_
  5. _"NEARLINE"_
  6. _"REGIONAL"_
  7. _"STANDARD"_


### abfsStorageClass

- Type of storage class offered by ABFS.
- Type: `string`
- The value is restricted to the following: 
  1. _"ARCHIVE"_
  2. _"HOT"_
  3. _"COOL"_

_This document was updated on: Thursday, December 9, 2021_