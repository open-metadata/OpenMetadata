---
title: appsPrivateConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/appsprivateconfiguration
---

# AppsPrivateConfiguration

*This schema defines a list of configurations for the Application Framework*

## Properties

- **`appsPrivateConfiguration`** *(array)*: List of configuration for apps.
  - **Items**: Refer to *[#/definitions/appPrivateConfig](#definitions/appPrivateConfig)*.
## Definitions

- **`appPrivateConfig`** *(object)*: Single Application Configuration Definition. Cannot contain additional properties.
  - **`name`** *(string, required)*: Application Name.
  - **`preview`** *(boolean)*: Flag to enable/disable preview for the application. If the app is in preview mode, it can't be installed. Default: `false`.
  - **`parameters`** *(object, required)*: Parameters to initialize the Applications. Can contain additional properties.
    - **Additional Properties**


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
