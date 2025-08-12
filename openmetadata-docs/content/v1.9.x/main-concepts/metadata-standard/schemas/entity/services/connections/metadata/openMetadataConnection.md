---
title: OpenMetadataConnection | Official Documentation
description: Define metadata platform connection using this schema to support full ingestion, lineage, and governance functions.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/openmetadataconnection
---

# OpenMetadataConnection

*OpenMetadata Connection Config*

## Properties

- **`clusterName`** *(string)*: Cluster name to differentiate OpenMetadata Server instance. Default: `"openmetadata"`.
- **`type`**: Service Type. Refer to *[#/definitions/openmetadataType](#definitions/openmetadataType)*. Default: `"OpenMetadata"`.
- **`hostPort`** *(string)*: OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api. Default: `"http://localhost:8585/api"`.
- **`authProvider`**: OpenMetadata Server Authentication Provider. Refer to *[#/definitions/authProvider](#definitions/authProvider)*.
- **`verifySSL`**: Flag to verify SSL Certificate for OpenMetadata Server. Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL)*. Default: `"no-ssl"`.
- **`sslConfig`**: SSL Configuration for OpenMetadata Server. Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`securityConfig`**: OpenMetadata Client security configuration. Refer to *[../../../../security/client/openMetadataJWTClientConfig.json](#/../../../security/client/openMetadataJWTClientConfig.json)*.
- **`secretsManagerProvider`**: Secrets Manager Provider for OpenMetadata Server. Refer to *[./../../../../security/secrets/secretsManagerProvider.json](#../../../../security/secrets/secretsManagerProvider.json)*. Default: `"db"`.
- **`secretsManagerLoader`**: Secrets Manager Loader for the Pipeline Service Client. Refer to *[./../../../../security/secrets/secretsManagerClientLoader.json](#../../../../security/secrets/secretsManagerClientLoader.json)*. Default: `"noop"`.
- **`apiVersion`** *(string)*: OpenMetadata server API version to use. Default: `"v1"`.
- **`includeTopics`** *(boolean)*: Include Topics for Indexing. Default: `true`.
- **`includeTables`** *(boolean)*: Include Tables for Indexing. Default: `true`.
- **`includeDashboards`** *(boolean)*: Include Dashboards for Indexing. Default: `true`.
- **`includePipelines`** *(boolean)*: Include Pipelines for Indexing. Default: `true`.
- **`includeMlModels`** *(boolean)*: Include MlModels for Indexing. Default: `true`.
- **`includeUsers`** *(boolean)*: Include Users for Indexing. Default: `true`.
- **`includeTeams`** *(boolean)*: Include Teams for Indexing. Default: `true`.
- **`includeGlossaryTerms`** *(boolean)*: Include Glossary Terms for Indexing. Default: `true`.
- **`includeTags`** *(boolean)*: Include Tags for Indexing. Default: `true`.
- **`includePolicy`** *(boolean)*: Include Tags for Policy. Default: `true`.
- **`includeMessagingServices`** *(boolean)*: Include Messaging Services for Indexing. Default: `true`.
- **`enableVersionValidation`** *(boolean)*: Validate Openmetadata Server & Client Version. Default: `true`.
- **`includeDatabaseServices`** *(boolean)*: Include Database Services for Indexing. Default: `true`.
- **`includePipelineServices`** *(boolean)*: Include Pipeline Services for Indexing. Default: `true`.
- **`limitRecords`** *(integer)*: Limit the number of records for Indexing. Default: `1000`.
- **`forceEntityOverwriting`** *(boolean)*: Force the overwriting of any entity during the ingestion. Default: `false`.
- **`storeServiceConnection`** *(boolean)*: If set to true, when creating a service during the ingestion we will store its Service Connection. Otherwise, the ingestion will create a bare service without connection details. Default: `true`.
- **`elasticsSearch`** *(object)*: Configuration for Sink Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string, required)*: Type of sink component ex: metadata.
  - **`config`**: Refer to *[../../../../type/basic.json#/definitions/componentConfig](#/../../../type/basic.json#/definitions/componentConfig)*.
- **`supportsDataInsightExtraction`**: Flag to enable Data Insight Extraction. Refer to *[../connectionBasicType.json#/definitions/supportsDataInsightExtraction](#/connectionBasicType.json#/definitions/supportsDataInsightExtraction)*.
- **`supportsElasticSearchReindexingExtraction`**: Flag to enable ElasticSearch Reindexing Extraction. Refer to *[../connectionBasicType.json#/definitions/supportsElasticSearchReindexingExtraction](#/connectionBasicType.json#/definitions/supportsElasticSearchReindexingExtraction)*.
- **`extraHeaders`**: Refer to *[#/definitions/extraHeaders](#definitions/extraHeaders)*.
## Definitions

- **`openmetadataType`** *(string)*: OpenMetadata service type. Must be one of: `["OpenMetadata"]`. Default: `"OpenMetadata"`.
- **`extraHeaders`** *(object)*: Additional headers to be sent to the API endpoint. Can contain additional properties.
  - **Additional Properties** *(string)*
- **`authProvider`** *(string)*: OpenMetadata Server Authentication Provider. Make sure configure same auth providers as the one configured on OpenMetadata server. Must be one of: `["basic", "azure", "google", "okta", "auth0", "aws-cognito", "custom-oidc", "ldap", "saml", "openmetadata"]`. Default: `"basic"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
