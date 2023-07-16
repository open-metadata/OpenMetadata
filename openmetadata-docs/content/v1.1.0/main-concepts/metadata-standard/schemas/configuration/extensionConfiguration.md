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
  - **Items**: Refer to *[#/definitions/extension](#definitions/extension)*.
## Definitions

- <a id="definitions/extension"></a>**`extension`** *(object)*: Extension Class to Register in OM. Cannot contain additional properties.
  - **`className`** *(string, required)*: Class Name for the Extension Service.
  - **`parameters`** *(object)*: Additional parameters for extension initialization. Can contain additional properties.
    - **Additional Properties**


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
