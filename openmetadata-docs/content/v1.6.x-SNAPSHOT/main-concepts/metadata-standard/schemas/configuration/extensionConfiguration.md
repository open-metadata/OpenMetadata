---
title: extensionConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/extensionconfiguration
---

# ExtensionConfiguration

*This schema defines the OpenMetadata Extensions Configuration.*

## Properties

- **`resourcePackage`** *(array)*: Resources Package name for Extension.
  - **Items** *(string)*
- **`extensions`** *(array)*: Extension Class to Register in OM.
  - **Items**: Refer to *#/definitions/extension*.
## Definitions

- **`extension`** *(object)*: Extension Class to Register in OM. Cannot contain additional properties.
  - **`className`** *(string)*: Class Name for the Extension Service.
  - **`parameters`** *(object)*: Additional parameters for extension initialization. Can contain additional properties.
    - **Additional Properties**


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
