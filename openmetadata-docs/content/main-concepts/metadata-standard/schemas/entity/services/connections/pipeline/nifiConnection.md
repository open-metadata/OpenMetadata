---
title: nifiConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/nificonnection
---

# NifiConnection

*Nifi Metadata Pipeline Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/NifiType*. Default: `Nifi`.
- **`hostPort`** *(string)*: Pipeline Service Management/UI URI.
- **`username`** *(string)*: Nifi user to authenticate to the API.
- **`password`** *(string)*: Nifi password to authenticate to the API.
- **`verifySSL`** *(boolean)*: Boolean marking if we need to verify the SSL certs for Nifi. False by default. Default: `False`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`NifiType`** *(string)*: Service type. Must be one of: `['Nifi']`. Default: `Nifi`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
