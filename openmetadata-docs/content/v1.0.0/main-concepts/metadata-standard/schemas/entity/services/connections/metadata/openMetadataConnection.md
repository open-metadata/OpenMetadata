---
title: openMetadataConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/openmetadataconnection
---

# OpenMetadataConnection

*OpenMetadata Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/openmetadataType*. Default: `OpenMetadata`.
- **`hostPort`** *(string)*: OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api. Default: `http://localhost:8585/api`.
- **`authProvider`** *(string)*: OpenMetadata Server Authentication Provider. Make sure configure same auth providers as the one configured on OpenMetadata server. Must be one of: `['no-auth', 'azure', 'google', 'okta', 'auth0', 'custom-oidc', 'openmetadata']`. Default: `no-auth`.
- **`securityConfig`**: OpenMetadata Client security configuration.
- **`secretsManagerProvider`** *(string)*: OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager providers as the ones configured on the OpenMetadata server. Must be one of: `['local', 'aws']`. Default: `local`.
- **`apiVersion`** *(string)*: OpenMetadata server API version to use. Default: `v1`.
- **`includeTopics`** *(boolean)*: Include Topics for Indexing. Default: `True`.
- **`includeTables`** *(boolean)*: Include Tables for Indexing. Default: `True`.
- **`includeDashboards`** *(boolean)*: Include Dashboards for Indexing. Default: `True`.
- **`includePipelines`** *(boolean)*: Include Pipelines for Indexing. Default: `True`.
- **`includeMlModels`** *(boolean)*: Include MlModels for Indexing. Default: `True`.
- **`includeUsers`** *(boolean)*: Include Users for Indexing. Default: `True`.
- **`includeTeams`** *(boolean)*: Include Teams for Indexing. Default: `True`.
- **`includeGlossaryTerms`** *(boolean)*: Include Glossary Terms for Indexing. Default: `True`.
- **`includeTags`** *(boolean)*: Include Tags for Indexing. Default: `True`.
- **`includePolicy`** *(boolean)*: Include Tags for Policy. Default: `True`.
- **`includeMessagingServices`** *(boolean)*: Include Messaging Services for Indexing. Default: `True`.
- **`enableVersionValidation`** *(boolean)*: Validate Openmetadata Server & Client Version. Default: `True`.
- **`includeDatabaseServices`** *(boolean)*: Include Database Services for Indexing. Default: `True`.
- **`includePipelineServices`** *(boolean)*: Include Pipeline Services for Indexing. Default: `True`.
- **`forceEntityOverwriting`** *(boolean)*: 'Force the overwriting of any entity during the ingestion. Default: `False`.
- **`limitRecords`** *(integer)*: Limit the number of records for Indexing. Default: `1000`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`openmetadataType`** *(string)*: OpenMetadata service type. Must be one of: `['OpenMetadata']`. Default: `OpenMetadata`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
