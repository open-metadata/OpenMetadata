---
title: testResultNotificationConfiguration | Official Documentation
description: Connect Testresultnotificationconfiguration to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integration.
slug: /main-concepts/metadata-standard/schemas/configuration/testresultnotificationconfiguration
---

# TestResultNotificationConfiguration

*This schema defines the SSL Config.*

## Properties

- **`enabled`** *(boolean)*: Is Test Notification Enabled? Default: `false`.
- **`onResult`** *(array)*: Send notification on Success, Failed or Aborted?
  - **Items**: Refer to *[../tests/basic.json#/definitions/testCaseStatus](#/tests/basic.json#/definitions/testCaseStatus)*.
- **`receivers`** *(array)*: Send notification on the mail.
  - **Items**: Refer to *[../type/basic.json#/definitions/email](#/type/basic.json#/definitions/email)*.
- **`sendToOwners`** *(boolean)*: Send notification on the mail. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
