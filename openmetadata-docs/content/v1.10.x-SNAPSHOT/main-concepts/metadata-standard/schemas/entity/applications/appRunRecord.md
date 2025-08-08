---
title: appRunRecord
slug: /main-concepts/metadata-standard/schemas/entity/applications/apprunrecord
---

# AppRunRecord

*App Run Record.*

## Properties

- **`appId`**: Unique identifier of this application for which the job is ran. Refer to *../../type/basic.json#/definitions/uuid*.
- **`appName`**: Name of the application. Refer to *../../type/basic.json#/definitions/entityName*.
- **`timestamp`**: Update time of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`extension`** *(string)*: Extension type. Default: `status`.
- **`status`** *(string)*: Status for the Job. Must be one of: `['started', 'running', 'completed', 'failed', 'active', 'activeError', 'stopped', 'stopInProgress', 'success', 'pending']`.
- **`runType`** *(string)*: This schema defines the type of application Run.
- **`startTime`**: Start of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`endTime`**: End time of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`executionTime`**: Execution time of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`failureContext`** *(object)*: Container for messages regarding the failure of the application. Use the 'failure' field to get the error message. Additional properties are there for backward compatibility. Can contain additional properties.
  - **`failure`**: Refer to *../../system/indexingError.json*.
- **`successContext`** *(object)*: Success Context for the Application.
  - **`stats`**: Stats for the application. Refer to *../../system/eventPublisherJob.json#/definitions/stats*.
- **`scheduleInfo`**: Refer to *./app.json#/definitions/appSchedule*.
- **`config`**: The configuration used for this application run. It's type will be based on the application type. Old runs might not be compatible with schema of app configuration. Refer to *../../type/basic.json#/definitions/map*.
- **`services`** *(array)*: Services configured in the application run. This information is generated based on the given configuration.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`properties`**: Arbitrary metadata that will be attached to the report. Refer to *../../type/basic.json#/definitions/map*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
