---
description: This guide helps you enable security in OpenMetadata with Docker
---

# Configure OpenMetadata Server using Docker

By default, security is not enabled when bringing up a cluster with the `metadata docker --start` command. To enable authentication and authorization, follow the below-mentioned steps:

1.  Create an env file like the following in your machine and update the values as required.&#x20;

    ```
    AUTHORIZER_CLASS_NAME=org.openmetadata.catalog.security.DefaultAuthorizer
    AUTHORIZER_REQUEST_FILTER=org.openmetadata.catalog.security.JwtFilter
    AUTHORIZER_ADMIN_PRINCIPALS=[admin]
    AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
    AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org
    AUTHENTICATION_PROVIDER=azure
    AUTHENTICATION_PUBLIC_KEYS=[https://login.microsoftonline.com/common/discovery/keys]
    AUTHENTICATION_AUTHORITY=https://login.microsoftonline.com/{Tenant ID}
    AUTHENTICATION_CLIENT_ID={Client ID}
    AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
    AIRFLOW_AUTH_PROVIDER=azure
    OM_AUTH_AIRFLOW_AZURE_CLIENT_SECRET={client_secret}
    OM_AUTH_AIRFLOW_AZURE_AUTHORITY_URL={authority_url}
    OM_AUTH_AIRFLOW_AZURE_SCOPES=[{scopes}]
    OM_AUTH_AIRFLOW_AZURE_CLIENT_ID={Client ID}
    ```
2.  Start the Docker containers from metadata CLI with the above env file.

    ```
    metadata docker -env-file ~/env_open_metadata --skip-sample-data --start
    ```
3. Visit [http://localhost:8585](http://localhost:8585) to start exploring OpenMetadata in a secure mode
