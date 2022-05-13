---
description: This guide helps you enable security in OpenMetadata with Docker
---

# Configure OpenMetadata Server using Docker

By default, security is not enabled when bringing up a cluster with the `metadata docker --start` command. To enable authentication and authorization, follow the below-mentioned steps:

1.  Create an env file like the following in your machine and update the values as required. Refer to the [Enable Security](../../google-sso-1/configure-openmetadata/broken-reference/) documentation to set up your preferred authentication provider. The variables `AIRFLOW_AUTH_PROVIDER` and `OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH` are required for UI based metadata ingestion.

    ```
    AUTHORIZER_CLASS_NAME=org.openmetadata.catalog.security.DefaultAuthorizer
    AUTHORIZER_REQUEST_FILTER=org.openmetadata.catalog.security.JwtFilter
    AUTHORIZER_ADMIN_PRINCIPALS=[admin]
    AUTHORIZER_INGESTION_PRINCIPALS=[ingestion-bot]
    AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org
    AUTHENTICATION_PROVIDER=google
    AUTHENTICATION_PUBLIC_KEY=https://www.googleapis.com/oauth2/v3/certs
    AUTHENTICATION_AUTHORITY=https://accounts.google.com
    AUTHENTICATION_CLIENT_ID=709849217090-n7s8oc4cvpffubraoi5vbr1s0qfboqvv.apps.googleusercontent.com
    AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
    AIRFLOW_AUTH_PROVIDER=google
    OM_AUTH_AIRFLOW_GOOGLE_SECRET_KEY_PATH=/tmp/secret.json
    ```
2.  Start the Docker containers from metadata CLI with the above env file.

    ```
    metadata docker -env-file ~/env_open_metadata --skip-sample-data --start
    ```
3. Visit [http://localhost:8585](http://localhost:8585) to start exploring OpenMetadata in a secure mode
