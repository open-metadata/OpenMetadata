---
title: testCaseResolutionStatus
slug: /main-concepts/metadata-standard/schemas/tests/testcaseresolutionstatus
---

# TestCaseResolutionStatus

*Schema to capture test case resolution status.*

## Properties

- **`id`**: Unique identifier of this failure instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`stateId`**: Sequence ID for a failure status. Statuses belonging to the same sequence will have the same ID. Unique across a failure cycle, i.e. new -> ack -> ... -> resolved. Refer to *../type/basic.json#/definitions/uuid*.
- **`timestamp`**: Timestamp on which the failure was created. Refer to *../type/basic.json#/definitions/timestamp*.
- **`testCaseResolutionStatusType`**: Status of Test Case Acknowledgement. Refer to *#/definitions/testCaseResolutionStatusTypes*.
- **`testCaseResolutionStatusDetails`**: Details of the test case failure status. Default: `None`.
- **`updatedBy`**: User who updated the test case failure status. Refer to *../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Time when test case resolution was updated. Refer to *../type/basic.json#/definitions/timestamp*.
- **`testCaseReference`**: Test case reference. Refer to *../type/entityReference.json*.
- **`severity`**: Severity failure for the test associated with the resolution. Refer to *#/definitions/severities*.
- **`metrics`** *(array)*: List of metrics associated with the test case resolution.
  - **Items**: Refer to *#/definitions/metric*.
## Definitions

- **`testCaseResolutionStatusTypes`** *(string)*: Test case resolution status type. Must be one of: `['New', 'Ack', 'Assigned', 'Resolved']`.
- **`severities`** *(string)*: Test case resolution status type. Must be one of: `['Severity1', 'Severity2', 'Severity3', 'Severity4', 'Severity5']`.
- **`metric`**: Representation of a metric.
  - **`name`** *(string)*: Name of the metric.
  - **`value`** *(number)*: Value of the metric.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
