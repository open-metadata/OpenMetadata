---
title: airflowConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/airflowconfiguration
---

# AirflowConfiguration

*This schema defines the AirFlow Configuration*

## Properties

- **`apiEndpoint`** *(string)*: API host endpoint for Airflow.
- **`hostIp`** *(string)*: Airflow host IP that will be used to connect to the sources.
- **`username`** *(string)*: Username for Login.
- **`password`** *(string)*: Password for Login.
- **`metadataApiEndpoint`** *(string)*: Metadata api endpoint.
- **`authProvider`** *(string)*: Auth Provider like no-auth, azure , google, okta, auth0, customOidc, openmetadata.
- **`timeout`** *(integer)*: Timeout. Default: `10`.
- **`authConfig`**: Auth Provider Configuration. Refer to *authConfig.json*.
- **`verifySSL`** *(string)*: Client SSL verification policy: no-ssl, ignore, validate. Default: `no-ssl`.
- **`sslConfig`**: OpenMetadata Client SSL configuration. Refer to *sslConfig.json*.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
