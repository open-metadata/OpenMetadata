---
title: testConnectionResult
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/testconnectionresult
---

# TestConnectionResult

*TestConnectionResult is the definition that will encapsulate result of running the test connection steps.*

## Properties

- **`lastUpdatedAt`**: Last time that the test connection was executed. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`status`**: Test Connection Result computation status. Refer to *#/definitions/statusType*.
- **`steps`** *(array)*: Steps to test the connection. Order matters.
  - **Items**: Refer to *#/definitions/testConnectionStepResult*.
## Definitions

- **`testConnectionStepResult`** *(object)*: Function that tests one specific element of the service. E.g., listing schemas, lineage, or tags. Cannot contain additional properties.
  - **`name`** *(string)*: Name of the step being tested.
  - **`mandatory`** *(boolean)*: Is this step mandatory to be passed? Default: `True`.
  - **`passed`** *(boolean)*: Did the step pass successfully?
  - **`message`** *(string)*: Results or exceptions to be shared after running the test. This message comes from the test connection definition. Default: `None`.
  - **`errorLog`** *(string)*: In case of failed step, this field would contain the actual error faced during the step. Default: `None`.
- **`statusType`** *(string)*: Enum defining possible Test Connection Result status. Must be one of: `['Successful', 'Failed', 'Running']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
