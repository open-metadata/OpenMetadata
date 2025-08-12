---
title: Test Connection Result | OpenMetadata Test Connection
description: Capture test connection results including success status, error messages, and diagnostic logs.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/testconnectionresult
---

# TestConnectionResult

*TestConnectionResult is the definition that will encapsulate result of running the test connection steps.*

## Properties

- **`lastUpdatedAt`**: Last time that the test connection was executed. Refer to *[../../../type/basic.json#/definitions/timestamp](#/../../type/basic.json#/definitions/timestamp)*.
- **`status`**: Test Connection Result computation status. Refer to *[#/definitions/statusType](#definitions/statusType)*.
- **`steps`** *(array)*: Steps to test the connection. Order matters.
  - **Items**: Refer to *[#/definitions/testConnectionStepResult](#definitions/testConnectionStepResult)*.
## Definitions

- **`testConnectionStepResult`** *(object)*: Function that tests one specific element of the service. E.g., listing schemas, lineage, or tags. Cannot contain additional properties.
  - **`name`** *(string, required)*: Name of the step being tested.
  - **`mandatory`** *(boolean, required)*: Is this step mandatory to be passed? Default: `true`.
  - **`passed`** *(boolean, required)*: Did the step pass successfully?
  - **`message`** *(string)*: Results or exceptions to be shared after running the test. This message comes from the test connection definition. Default: `null`.
  - **`errorLog`** *(string)*: In case of failed step, this field would contain the actual error faced during the step. Default: `null`.
- **`statusType`** *(string)*: Enum defining possible Test Connection Result status. Must be one of: `["Successful", "Failed", "Running"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
