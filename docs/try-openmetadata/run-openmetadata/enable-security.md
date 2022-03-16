---
description: This guide helps you enable security in OpenMetadata with Docker
---

# Enable Security

By default, security is not enabled when bringing up a cluster with the `metadata docker --start` command. To enable authentication and authorization, follow the below-mentioned steps:

1.  Create an env file like the following in your machine and update the values as required. Refer to the [Enable Security](../../../deploy/deploy-on-bare-metal/enable-security/) documentation to set up your preferred authentication provider.

    ```
    AUTHORIZER_CLASS_NAME=org.openmetadata.catalog.security.DefaultAuthorizer
    AUTHORIZER_REQUEST_FILTER=org.openmetadata.catalog.security.JwtFilter
    AUTHORIZER_ADMIN_PRINCIPALS=admin
    AUTHORIZER_INGESTION_PRINCIPAL=ingestion-bot
    AUTHORIZER_PRINCIPAL_DOMAIN=open-metadata.org
    AUTHENTICATION_PROVIDER=google
    AUTHENTICATION_PUBLIC_KEY=https://www.googleapis.com/oauth2/v3/certs
    AUTHENTICATION_AUTHORITY=https://accounts.google.com
    AUTHENTICATION_CLIENT_ID=709849217090-n7s8oc4cvpffubraoi5vbr1s0qfboqvv.apps.googleusercontent.com
    AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
    ```


2.  Start the Docker containers from metadata CLI with the above env file.

    ```
    metadata docker -env-file ~/env_open_metadata --start
    ```


3. Do not wait for the sample metadata ingestion to complete. The sample data ingestion will fail since the metadata server starts in a secure mode and will expect credentials to be present in the requests. Follow the [Configure Ingestion](../../../deploy/deploy-on-bare-metal/enable-security/okta-sso/configure-security-ingestion.md) documentation for your preferred SSO to configure ingestion with secure credentials. You can exit the command line with "Ctrl + C".
4. Visit [http://localhost:8585](http://localhost:8585) to start exploring OpenMetadata in a secure mode



