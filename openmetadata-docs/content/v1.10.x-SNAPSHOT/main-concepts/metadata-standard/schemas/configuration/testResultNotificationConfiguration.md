---
title: testResultNotificationConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/testresultnotificationconfiguration
---

# TestResultNotificationConfiguration

*This schema defines the SSL Config.*

## Properties

- **`enabled`** *(boolean)*: Is Test Notification Enabled? Default: `False`.
- **`onResult`** *(array)*: Send notification on Success, Failed or Aborted?
  - **Items**: Refer to *../tests/basic.json#/definitions/testCaseStatus*.
- **`receivers`** *(array)*: Send notification on the mail.
  - **Items**: Refer to *../type/basic.json#/definitions/email*.
- **`sendToOwners`** *(boolean)*: Send notification on the mail. Default: `False`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
