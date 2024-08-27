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


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
