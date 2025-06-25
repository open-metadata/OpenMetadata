---
title: testCaseResolutionStatus
slug: /main-concepts/metadata-standard/schemas/tests/testcaseresolutionstatus
---

# TestCaseResolutionStatus

*Schema to capture test case resolution status.*

## Properties

- **`id`**: Unique identifier of this failure instance. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`stateId`**: Sequence ID for a failure status. Statuses belonging to the same sequence will have the same ID. Unique across a failure cycle, i.e. new -> ack -> ... -> resolved. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`timestamp`**: Timestamp on which the failure was created. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`testCaseResolutionStatusType`**: Status of Test Case Acknowledgement. Refer to *[#/definitions/testCaseResolutionStatusTypes](#definitions/testCaseResolutionStatusTypes)*.
- **`testCaseResolutionStatusDetails`**: Details of the test case failure status. Default: `null`.
  - **One of**
    - : Refer to *[./assigned.json](#assigned.json)*.
    - : Refer to *[./resolved.json](#resolved.json)*.
- **`updatedBy`**: User who updated the test case failure status. Refer to *[../type/entityReference.json](#/type/entityReference.json)*. Default: `null`.
- **`updatedAt`**: Time when test case resolution was updated. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`testCaseReference`**: Test case reference. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`severity`**: Severity failure for the test associated with the resolution. Refer to *[#/definitions/severities](#definitions/severities)*.
- **`metrics`** *(array)*: List of metrics associated with the test case resolution.
  - **Items**: Refer to *[#/definitions/metric](#definitions/metric)*.
## Definitions

- **`testCaseResolutionStatusTypes`** *(string)*: Test case resolution status type. Must be one of: `["New", "Ack", "Assigned", "Resolved"]`.
- **`severities`** *(string)*: Test case resolution status type. Must be one of: `["Severity1", "Severity2", "Severity3", "Severity4", "Severity5"]`.
- **`metric`**: Representation of a metric.
  - **`name`** *(string)*: Name of the metric.
  - **`value`** *(number)*: Value of the metric.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
