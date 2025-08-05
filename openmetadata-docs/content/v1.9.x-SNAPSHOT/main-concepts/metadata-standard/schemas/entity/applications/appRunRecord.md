---
title: App Run Record | OpenMetadata App Run Records
description: Connect Apprunrecord to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/entity/applications/apprunrecord
---

# AppRunRecord

*App Run Record.*

## Properties

- **`appId`**: Unique identifier of this application for which the job is ran. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`appName`**: Name of the application. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`timestamp`**: Update time of the job status. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`extension`** *(string)*: Extension type. Default: `"status"`.
- **`status`** *(string)*: Status for the Job. Must be one of: `["started", "running", "completed", "failed", "active", "activeError", "stopped", "success"]`.
- **`runType`** *(string)*: This schema defines the type of application Run.
- **`startTime`**: Start of the job status. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`endTime`**: End time of the job status. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`executionTime`**: Execution time of the job status. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`failureContext`** *(object)*: Failure Context for the Application.
- **`successContext`** *(object)*: Success Context for the Application.
- **`scheduleInfo`**: Refer to *[./app.json#/definitions/appSchedule](#app.json#/definitions/appSchedule)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
