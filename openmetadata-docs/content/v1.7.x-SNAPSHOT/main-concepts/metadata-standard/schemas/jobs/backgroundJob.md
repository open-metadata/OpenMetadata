---
title: backgroundJob
slug: /main-concepts/metadata-standard/schemas/jobs/backgroundjob
---

# BackgroundJob

*Defines a background job that is triggered on insertion of new record in background_jobs table.*

## Properties

- **`id`**: Unique identifier for the job. This field is auto-incremented.
- **`jobType`** *(string)*: Type of the job. Must be one of: `["CUSTOM_PROPERTY_ENUM_CLEANUP"]`.
- **`methodName`** *(string)*: JobHandler name of the method that will be executed for this job.
- **`jobArgs`**: Object containing job arguments.
  - **One of**
    - : Refer to *[./enumCleanupArgs.json](#enumCleanupArgs.json)*.
- **`status`** *(string)*: Current status of the job. Must be one of: `["COMPLETED", "FAILED", "RUNNING", "PENDING"]`.
- **`createdBy`** *(string)*: User or Bot who triggered the background job.
- **`createdAt`**: Timestamp when the job was created in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`updatedAt`**: Time when job was last updated in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
