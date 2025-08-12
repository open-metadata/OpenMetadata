---
title: sageMakerConnection | Official Documentation
description: Configure SageMaker integration using this schema to extract model metadata and lifecycle insights from AWS ML workflows.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/mlmodel/sagemakerconnection
---

# SageMakerConnection

*SageMaker Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/sageMakerType](#definitions/sageMakerType)*. Default: `"SageMaker"`.
- **`awsConfig`**: Refer to *[../../../../security/credentials/awsCredentials.json](#/../../../security/credentials/awsCredentials.json)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`sageMakerType`** *(string)*: Service type. Must be one of: `["SageMaker"]`. Default: `"SageMaker"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
