---
title: openMetadataConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/openmetadataconnection
---

# OpenMetadataConnection

*OpenMetadata Connection Config*

## Properties

- **`clusterName`** *(string)*: Cluster name to differentiate OpenMetadata Server instance. Default: `"openmetadata"`.
- **`type`**: Service Type. Refer to *[#/definitions/openmetadataType](#definitions/openmetadataType)*. Default: `"OpenMetadata"`.
- **`hostPort`** *(string)*: OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api. Default: `"http://localhost:8585/api"`.
- **`authProvider`**: Refer to *[#/definitions/authProvider](#definitions/authProvider)*.
- **`verifySSL`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL)*. Default: `"no-ssl"`.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`securityConfig`**: OpenMetadata Client security configuration.
  - **One of**
    - : Refer to *[../../../../security/client/googleSSOClientConfig.json](#/../../../security/client/googleSSOClientConfig.json)*.
    - : Refer to *[../../../../security/client/oktaSSOClientConfig.json](#/../../../security/client/oktaSSOClientConfig.json)*.
    - : Refer to *[../../../../security/client/auth0SSOClientConfig.json](#/../../../security/client/auth0SSOClientConfig.json)*.
    - : Refer to *[../../../../security/client/azureSSOClientConfig.json](#/../../../security/client/azureSSOClientConfig.json)*.
    - : Refer to *[../../../../security/client/customOidcSSOClientConfig.json](#/../../../security/client/customOidcSSOClientConfig.json)*.
    - : Refer to *[../../../../security/client/openMetadataJWTClientConfig.json](#/../../../security/client/openMetadataJWTClientConfig.json)*.
- **`secretsManagerProvider`**: Refer to *[./../../../../security/secrets/secretsManagerProvider.json](#../../../../security/secrets/secretsManagerProvider.json)*. Default: `"noop"`.
- **`secretsManagerLoader`**: Refer to *[./../../../../security/secrets/secretsManagerClientLoader.json](#../../../../security/secrets/secretsManagerClientLoader.json)*. Default: `"noop"`.
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
- **`limitRecords`** *(integer)*: Limit the number of records for Indexing. Default: `"1000"`.
- **`forceEntityOverwriting`** *(boolean)*: Force the overwriting of any entity during the ingestion. Default: `false`.
- **`storeServiceConnection`** *(boolean)*: If set to true, when creating a service during the ingestion we will store its Service Connection. Otherwise, the ingestion will create a bare service without connection details. Default: `true`.
- **`elasticsSearch`** *(object)*: Configuration for Sink Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string, required)*: Type of sink component ex: metadata.
  - **`config`**: Refer to *[../../../../type/basic.json#/definitions/componentConfig](#/../../../type/basic.json#/definitions/componentConfig)*.
- **`supportsDataInsightExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataInsightExtraction](#/connectionBasicType.json#/definitions/supportsDataInsightExtraction)*.
- **`supportsElasticSearchReindexingExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsElasticSearchReindexingExtraction](#/connectionBasicType.json#/definitions/supportsElasticSearchReindexingExtraction)*.
- **`extraHeaders`**: Refer to *[#/definitions/extraHeaders](#definitions/extraHeaders)*.
## Definitions

- <a id="definitions/openmetadataType"></a>**`openmetadataType`** *(string)*: OpenMetadata service type. Must be one of: `["OpenMetadata"]`. Default: `"OpenMetadata"`.
- <a id="definitions/extraHeaders"></a>**`extraHeaders`** *(object)*: Additional headers to be sent to the API endpoint. Can contain additional properties.
  - **Additional Properties** *(string)*
- <a id="definitions/authProvider"></a>**`authProvider`** *(string)*: OpenMetadata Server Authentication Provider. Make sure configure same auth providers as the one configured on OpenMetadata server. Must be one of: `["no-auth", "basic", "azure", "google", "okta", "auth0", "aws-cognito", "custom-oidc", "ldap", "saml", "openmetadata"]`. Default: `"basic"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
