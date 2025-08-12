---
title: lightdashConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/lightdashconnection
---

# LightdashConnection

*Lightdash Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/lightdashType*. Default: `Lightdash`.
- **`hostPort`** *(string)*: Address for your running Lightdash instance. Default: `http://localhost:5000`.
- **`apiKey`** *(string)*: The personal access token you can generate in the Lightdash app under the user settings.
- **`projectUUID`** *(string)*: The Project UUID for your Lightdash instance.
- **`spaceUUID`** *(string)*: The Space UUID for your Lightdash instance.
- **`proxyAuthentication`** *(string)*: Use if your Lightdash instance is behind a proxy like (Cloud IAP).
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`lightdashType`** *(string)*: Lightdash service type. Must be one of: `['Lightdash']`. Default: `Lightdash`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
