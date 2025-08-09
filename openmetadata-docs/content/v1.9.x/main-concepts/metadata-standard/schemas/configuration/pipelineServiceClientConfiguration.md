---
title: pipelineServiceClientConfiguration | Official Documentation
description: Connect Pipelineserviceclientconfiguration to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integration.
slug: /main-concepts/metadata-standard/schemas/configuration/pipelineserviceclientconfiguration
---

# PipelineServiceClientConfiguration

*This schema defines the Pipeline Service Client Configuration*

## Properties

- **`enabled`** *(boolean)*: Flags if the ingestion from the OpenMetadata UI is enabled. If ingesting externally, we can set this value to false to not check the Pipeline Service Client component health. Default: `true`.
- **`className`** *(string)*: Class Name for the Pipeline Service Client.
- **`apiEndpoint`** *(string)*: External API root to interact with the Pipeline Service Client.
- **`hostIp`** *(string)*: Pipeline Service Client host IP that will be used to connect to the sources.
- **`healthCheckInterval`** *(integer)*: Interval in seconds that the server will use to check the /status of the pipelineServiceClient and flag any errors in a Prometheus metric `pipelineServiceClientStatus.counter`. Default: `300`.
- **`ingestionIpInfoEnabled`** *(boolean)*: Enable or disable the API that fetches the public IP running the ingestion process. Default: `false`.
- **`metadataApiEndpoint`** *(string)*: Metadata api endpoint, e.g., `http://localhost:8585/api`.
- **`verifySSL`**: Client SSL verification policy when connecting to the OpenMetadata server: no-ssl, ignore, validate. Refer to *[../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/security/ssl/verifySSLConfig.json#/definitions/verifySSL)*.
- **`sslConfig`**: OpenMetadata Client SSL configuration. This SSL information is about the OpenMetadata server. It will be picked up from the pipelineServiceClient to use/ignore SSL when connecting to the OpenMetadata server. Refer to *[../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`secretsManagerLoader`**: Refer to *[./../security/secrets/secretsManagerClientLoader.json](#../security/secrets/secretsManagerClientLoader.json)*. Default: `"noop"`.
- **`authProvider`**: Auth Provider with which OpenMetadata service configured with. Refer to *[../entity/services/connections/metadata/openMetadataConnection.json#/definitions/authProvider](#/entity/services/connections/metadata/openMetadataConnection.json#/definitions/authProvider)*.
- **`authConfig`**: Auth Provider Configuration. Refer to *[authConfig.json](#thConfig.json)*.
- **`parameters`** *(object)*: Additional parameters to initialize the PipelineServiceClient. Can contain additional properties.
  - **Additional Properties**


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
