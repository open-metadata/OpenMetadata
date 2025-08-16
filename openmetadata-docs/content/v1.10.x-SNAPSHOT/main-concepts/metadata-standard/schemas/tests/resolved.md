---
title: resolved
slug: /main-concepts/metadata-standard/schemas/tests/resolved
---

# Resolved

*test case failure details for resolved failures*

## Properties

- **`testCaseFailureReason`**: Reason of Test Case resolution. Refer to *#/definitions/testCaseFailureReasonType*.
- **`testCaseFailureComment`** *(string)*: Test case failure resolution comment.
- **`resolvedBy`**: User who resolved the test case failure. Refer to *../type/entityReference.json*.
## Definitions

- **`testCaseFailureReasonType`** *(string)*: Reason of Test Case initial failure. Must be one of: `['FalsePositive', 'MissingData', 'Duplicates', 'OutOfBounds', 'Other']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
