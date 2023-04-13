---
title: pipelineServiceClientConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/pipelineserviceclientconfiguration
---

# PipelineServiceClientConfiguration

*This schema defines the Pipeline Service Client Configuration*

## Properties

- **`className`** *(string)*: Class Name for the Pipeline Service Client.
- **`apiEndpoint`** *(string)*: External API root to interact with the Pipeline Service Client.
- **`hostIp`** *(string)*: Pipeline Service Client host IP that will be used to connect to the sources.
- **`ingestionIpInfoEnabled`** *(boolean)*: Enable or disable the API that fetches the public IP running the ingestion process. Default: `False`.
- **`metadataApiEndpoint`** *(string)*: Metadata api endpoint, e.g., `http://localhost:8585/api`.
- **`verifySSL`** *(string)*: Client SSL verification policy: no-ssl, ignore, validate. Default: `no-ssl`.
- **`sslConfig`**: OpenMetadata Client SSL configuration. Refer to *sslConfig.json*.
- **`authProvider`** *(string)*: Auth Provider like no-auth, azure , google, okta, auth0, customOidc, openmetadata.
- **`authConfig`**: Auth Provider Configuration. Refer to *authConfig.json*.
- **`parameters`** *(object)*: Additional parameters to initialize the PipelineServiceClient. Can contain additional properties.
  - **Additional Properties**


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
