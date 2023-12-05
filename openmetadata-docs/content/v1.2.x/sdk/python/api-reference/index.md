---
title: Overview
slug: /sdk/python/api-reference
---



# API Overview

## Modules

- [`auth_provider`](/sdk/python/api-reference/auth-provider#module-auth_provider): Interface definition for an Auth provider
- [`client`](/sdk/python/api-reference/client#module-client): Python API REST wrapper and helpers
- [`client_utils`](/sdk/python/api-reference/client-utils#module-client_utils): OMeta client create helpers
- [`credentials`](/sdk/python/api-reference/credentials#module-credentials): Helper methods to handle creds retrieval
- [`models`](/sdk/python/api-reference/models#module-models): Pydantic models for ometa client API
- [`ometa_api`](/sdk/python/api-reference/ometa-api#module-ometa_api): OpenMetadata is the high level Python API that serves as a wrapper
- [`provider_registry`](/sdk/python/api-reference/provider-registry#module-provider_registry): Register auth provider init functions here
- [`routes`](/sdk/python/api-reference/routes#module-routes): OMeta API endpoints
- [`utils`](/sdk/python/api-reference/utils#module-utils): Helper functions to handle OpenMetadata Entities' properties
- [`dashboard_mixin`](/sdk/python/api-reference/dashboard-mixin#module-dashboard_mixin): Mixin class containing Table specific methods
- [`data_insight_mixin`](/sdk/python/api-reference/data-insight-mixin#module-data_insight_mixin): Mixin class containing data specific methods
- [`es_mixin`](/sdk/python/api-reference/es-mixin#module-es_mixin): Mixin class containing Lineage specific methods
- [`ingestion_pipeline_mixin`](/sdk/python/api-reference/ingestion-pipeline-mixin#module-ingestion_pipeline_mixin): Mixin class containing ingestion pipeline specific methods
- [`lineage_mixin`](/sdk/python/api-reference/lineage-mixin#module-lineage_mixin): Mixin class containing Lineage specific methods
- [`mlmodel_mixin`](/sdk/python/api-reference/mlmodel-mixin#module-mlmodel_mixin): Mixin class containing Lineage specific methods
- [`patch_mixin`](/sdk/python/api-reference/patch-mixin#module-patch_mixin): Mixin class containing PATCH specific methods
- [`patch_mixin_utils`](/sdk/python/api-reference/patch-mixin_utils#module-patch_mixin_utils): Utilities and a super class containing common utility methods for mixins performing JSON PATCHes
- [`pipeline_mixin`](/sdk/python/api-reference/pipeline-mixin#module-pipeline_mixin): Mixin class containing Pipeline specific methods
- [`query_mixin`](/sdk/python/api-reference/query-mixin#module-query_mixin): Mixin class containing Query specific methods
- [`role_policy_mixin`](/sdk/python/api-reference/role-policy-mixin#module-role_policy_mixin): Mixin class containing Role and Policy specific methods
- [`search_index_mixin`](/sdk/python/api-reference/search-index-mixin#module-search_index_mixin): Mixin class containing Search Index specific methods
- [`server_mixin`](/sdk/python/api-reference/server-mixin#module-server_mixin): Mixin class containing Server and client specific methods
- [`service_mixin`](/sdk/python/api-reference/service-mixin#module-service_mixin): Helper mixin to handle services
- [`table_mixin`](/sdk/python/api-reference/table-mixin#module-table_mixin): Mixin class containing Table specific methods
- [`tests_mixin`](/sdk/python/api-reference/tests-mixin#module-tests_mixin): Mixin class containing Tests specific methods
- [`topic_mixin`](/sdk/python/api-reference/topic0mixin#module-topic_mixin): Mixin class containing Topic specific methods
- [`user_mixin`](/sdk/python/api-reference/user-mixin#module-user_mixin): Mixin class containing User specific methods
- [`version_mixin`](/sdk/python/api-reference/version-mixin#module-version_mixin): Mixin class containing entity versioning specific methods

## Classes

- [`auth_provider.Auth0AuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-auth0authenticationprovider): OAuth authentication implementation
- [`auth_provider.AuthenticationException`](/sdk/python/api-reference/auth-provider#class-authenticationexception): Error trying to get the token from the provider
- [`auth_provider.AuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-authenticationprovider): Interface definition for an Authentication provider
- [`auth_provider.AzureAuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-azureauthenticationprovider): Prepare the Json Web Token for Azure auth
- [`auth_provider.CustomOIDCAuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-customoidcauthenticationprovider): Custom OIDC authentication implementation
- [`auth_provider.GoogleAuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-googleauthenticationprovider): Google authentication implementation
- [`auth_provider.NoOpAuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-noopauthenticationprovider): Extends AuthenticationProvider class
- [`auth_provider.OktaAuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-oktaauthenticationprovider): Prepare the Json Web Token for Okta auth
- [`auth_provider.OpenMetadataAuthenticationProvider`](/sdk/python/api-reference/auth-provider#class-openmetadataauthenticationprovider): OpenMetadata authentication implementation
- [`client.APIError`](/sdk/python/api-reference/client#class-apierror): Represent API related error.
- [`client.ClientConfig`](/sdk/python/api-reference/client#class-clientconfig): :param raw_data: should we return api response raw or wrap it with
- [`client.REST`](/sdk/python/api-reference/client#class-rest): REST client wrapper to manage requests with
- [`client.RetryException`](/sdk/python/api-reference/client#class-retryexception): API Client retry exception
- [`credentials.DATE`](/sdk/python/api-reference/credentials#class-date): date string in the format YYYY-MM-DD
- [`credentials.FLOAT`](/sdk/python/api-reference/credentials#class-float): api allows passing floats or float as strings.
- [`credentials.URL`](/sdk/python/api-reference/credentials#class-url): Handle URL for creds retrieval
- [`models.EntityList`](/sdk/python/api-reference/models#class-entitylist): Pydantic Entity list model
- [`ometa_api.EmptyPayloadException`](/sdk/python/api-reference/ometa-api#class-emptypayloadexception): Raise when receiving no data, even if no exception
- [`ometa_api.InvalidEntityException`](/sdk/python/api-reference/ometa-api#class-invalidentityexception): We receive an entity not supported in an operation
- [`ometa_api.MissingEntityTypeException`](/sdk/python/api-reference/ometa-api#class-missingentitytypeexception): We are receiving an Entity Type[T] not covered
- [`ometa_api.OpenMetadata`](/sdk/python/api-reference/ometa-api#class-openmetadata): Generic interface to the OpenMetadata API
- [`provider_registry.InvalidAuthProviderException`](/sdk/python/api-reference/provider-registry#class-invalidauthproviderexception): Raised when we cannot find a valid auth provider
- [`dashboard_mixin.OMetaDashboardMixin`](/sdk/python/api-reference/dashboard-mixin#class-ometadashboardmixin): OpenMetadata API methods related to Dashboards and Charts.
- [`data_insight_mixin.DataInsightMixin`](/sdk/python/api-reference/data-insight-mixin#class-datainsightmixin): data insight mixin used to write results
- [`es_mixin.ESMixin`](/sdk/python/api-reference/es-mixin#class-esmixin): OpenMetadata API methods related to Elasticsearch.
- [`ingestion_pipeline_mixin.OMetaIngestionPipelineMixin`](/sdk/python/api-reference/ingestion-pipeline-mixin#class-ometaingestionpipelinemixin): OpenMetadata API methods related to ingestion pipeline.
- [`lineage_mixin.OMetaLineageMixin`](/sdk/python/api-reference/lineage-mixin#class-ometalineagemixin): OpenMetadata API methods related to Lineage.
- [`mlmodel_mixin.OMetaMlModelMixin`](/sdk/python/api-reference/mlmodel-mixin#class-ometamlmodelmixin): OpenMetadata API methods related to MlModel.
- [`patch_mixin.OMetaPatchMixin`](/sdk/python/api-reference/patch-mixin#class-ometapatchmixin): OpenMetadata API methods related to Tables.
- [`patch_mixin_utils.OMetaPatchMixinBase`](/sdk/python/api-reference/patch-mixin-utils#class-ometapatchmixinbase): OpenMetadata API methods related to Glossaries.
- [`patch_mixin_utils.PatchField`](/sdk/python/api-reference/patch-mixin-utils#class-patchfield): JSON PATCH field names
- [`patch_mixin_utils.PatchOperation`](/sdk/python/api-reference/patch-mixin-utils#class-patchoperation): JSON PATCH operation strings
- [`patch_mixin_utils.PatchPath`](/sdk/python/api-reference/patch-mixin-utils#class-patchpath): JSON PATCH path strings
- [`patch_mixin_utils.PatchValue`](/sdk/python/api-reference/patch-mixin-utils#class-patchvalue): JSON PATCH value field names
- [`pipeline_mixin.OMetaPipelineMixin`](/sdk/python/api-reference/pipeline-mixin#class-ometapipelinemixin): OpenMetadata API methods related to the Pipeline Entity
- [`query_mixin.OMetaQueryMixin`](/sdk/python/api-reference/query-mixin#class-ometaquerymixin): OpenMetadata API methods related to Queries.
- [`role_policy_mixin.OMetaRolePolicyMixin`](/sdk/python/api-reference/role-policy-mixin#class-ometarolepolicymixin): OpenMetadata API methods related to Roles and Policies.
- [`search_index_mixin.OMetaSearchIndexMixin`](/sdk/python/api-reference/search-index-mixin#class-ometasearchindexmixin): OpenMetadata API methods related to search index.
- [`server_mixin.OMetaServerMixin`](/sdk/python/api-reference/server-mixin#class-ometaservermixin): OpenMetadata API methods related to the Pipeline Entity
- [`server_mixin.VersionMismatchException`](/sdk/python/api-reference/server-mixin#class-versionmismatchexception): Used when server and client versions do not match
- [`server_mixin.VersionNotFoundException`](/sdk/python/api-reference/server-mixin#class-versionnotfoundexception): Used when server doesn't return a version
- [`service_mixin.OMetaServiceMixin`](/sdk/python/api-reference/service-mixin#class-ometaservicemixin): OpenMetadata API methods related to service.
- [`table_mixin.OMetaTableMixin`](/sdk/python/api-reference/table-mixin#class-ometatablemixin): OpenMetadata API methods related to Tables.
- [`tests_mixin.OMetaTestsMixin`](/sdk/python/api-reference/tests-mixin#class-ometatestsmixin): OpenMetadata API methods related to Tests.
- [`topic_mixin.OMetaTopicMixin`](/sdk/python/api-reference/topic-mixin#class-ometatopicmixin): OpenMetadata API methods related to Topics.
- [`user_mixin.OMetaUserMixin`](/sdk/python/api-reference/user-mixin#class-ometausermixin): OpenMetadata API methods related to user.
- [`version_mixin.OMetaVersionMixin`](/sdk/python/api-reference/version-mixin#class-ometaversionmixin): OpenMetadata API methods related to entity versioning.

## Functions

- [`client_utils.create_ometa_client`](/sdk/python/api-reference/client-utils#function-create_ometa_client): Create an OpenMetadata client
- [`client_utils.get_chart_entities_from_id`](/sdk/python/api-reference/client-utils#function-get_chart_entities_from_id): Method to get the chart entity using get_by_name api
- [`credentials.get_api_version`](/sdk/python/api-reference/credentials#function-get_api_version): Get version API
- [`credentials.get_credentials`](/sdk/python/api-reference/credentials#function-get_credentials): Get credentials
- [`provider_registry.auth0_auth_init`](/sdk/python/api-reference/provider-registry#function-auth0_auth_init)
- [`provider_registry.azure_auth_init`](/sdk/python/api-reference/provider-registry#function-azure_auth_init)
- [`provider_registry.basic_auth_init`](/sdk/python/api-reference/provider-registry#function-basic_auth_init)
- [`provider_registry.custom_oidc_auth_init`](/sdk/python/api-reference/provider-registry#function-custom_oidc_auth_init)
- [`provider_registry.google_auth_init`](/sdk/python/api-reference/provider-registry#function-google_auth_init)
- [`provider_registry.ldap_auth_init`](/sdk/python/api-reference/provider-registry#function-ldap_auth_init)
- [`provider_registry.no_auth_init`](/sdk/python/api-reference/provider-registry#function-no_auth_init)
- [`provider_registry.okta_auth_init`](/sdk/python/api-reference/provider-registry#function-okta_auth_init)
- [`provider_registry.om_auth_init`](/sdk/python/api-reference/provider-registry#function-om_auth_init)
- [`provider_registry.saml_auth_init`](/sdk/python/api-reference/provider-registry#function-saml_auth_init)
- [`provider_registry.warn_auth_deprecation`](/sdk/python/api-reference/provider-registry#function-warn_auth_deprecation)
- [`provider_registry.warn_not_supported`](/sdk/python/api-reference/provider-registry#function-warn_not_supported)
- [`utils.format_name`](/sdk/python/api-reference/utils#function-format_name): Given a name, replace all special characters by `_`
- [`utils.get_entity_type`](/sdk/python/api-reference/utils#function-get_entity_type): Given an Entity T, return its type.
- [`utils.model_str`](/sdk/python/api-reference/utils#function-model_str): Default model stringifying method.
- [`patch_mixin.update_column_description`](/sdk/python/api-reference/patch-mixin#function-update_column_description): Inplace update for the incoming column list
- [`patch_mixin.update_column_tags`](/sdk/python/api-reference/patch-mixin#function-update_column_tags): Inplace update for the incoming column list


