---
title: appRunRecord
slug: /main-concepts/metadata-standard/schemas/entity/applications/apprunrecord
---

# AppRunRecord

*App Run Record.*

## Properties

- **`appId`**: Unique identifier of this application for which the job is ran. Refer to *../../type/basic.json#/definitions/uuid*.
- **`status`** *(string)*: Status for the Job. Must be one of: `['running', 'failed', 'success']`.
- **`runType`** *(string)*: This schema defines the type of application Run. Must be one of: `['Scheduled', 'OnDemand']`.
- **`startTime`**: Start of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`endTime`**: End time of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`executionTime`**: Execution time of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`timestamp`**: Update time of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`failureContext`** *(object)*: Failure Context for the Application.
- **`successContext`** *(object)*: Success Context for the Application.
- **`scheduleInfo`**: Refer to *./app.json#/definitions/appSchedule*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
