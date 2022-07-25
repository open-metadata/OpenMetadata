---
title: Java SDK
slug: /sdk/java
---

# Java SDK 

We are now going to present a high-level Java API as a type-safe and gentle wrapper for the OpenMetadata backend.

The open-source OpenMetadata SDK for Java simplifies provisioning, managing, and using OpenMetadata resources from Java application code. \
The OpenMetadata SDK for Java libraries build on top of the underlying OpenMetadata REST API, allowing you to use those APIs through familiar Java paradigms. However, you can always use the REST API directly from Java code, if you prefer.

You can find the source code for the OpenMetadata libraries in the [GitHub repository](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-clients). As an open-source project, contributions are welcome!


## Establish OpenMetadata Server Connection

To create OpenMetadata Gateway, you will need to establish a connection with *OpenMetadata Server*. \
To do so, several inputs needs to be provided as follows:
* Host Port: The url on which your instance of OpenMetadata is up and running.
* ApiVersion: The value will be "v1".
* Auth Provider: This is Optional. To set security, please refer to **TODO**
* Security Config: Provide the config for the selected auth provider.

```java
    OpenMetadataServerConnection server = new OpenMetadataServerConnection();
    server.setHostPort("http://localhost:{port}}/api");
    server.setApiVersion("v1");
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.{auth_provider});
    server.setSecurityConfig({security_client_config});
```

## Create OpenMetadata Gateway

Once the connection details are provided. You can create an OpenMetadata Gateway
using following piece of code.

```java
    // OpenMetadata Gateway                                     
    OpenMetadata openMetadataGateway = new OpenMetadata(server);
```

## Use Java Client without Authentication
To use Java Client with any authentication, you can use `NoOpAuthenticationProvider.java`. \

```java
    NoOpAuthenticationProvider noOpAuthenticationProvider = new NoOpAuthenticationProvider();
``` 

Establish the [OpenMetadata Server Connection](#Establish OpenMetadata Server Connection) and provide the `noOpAuthenticationProvider` in the config.

```java
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.NO_AUTH);
```

## Use Java Client with Authentication.

The OpenMetadata Java SDK support several auth providers:
* [Google](#Google)
* [Okta](#Okta)
* [Auth0](#Auth0)
* [Azure](#Azure)
* [OpenMetadata](#OpenMetadata)

Other than the above auth providers, OpenMetadata Java SDK also supports [Custom OIDC](#Custom OIDC).

### Google
To set up Google as the auth provider. The following details are must:
* Secret Key: Pass the JSON file generated in [Create Service Account](../../../content/deployment/security/google/index.md) as secretKey.

```java
    GoogleSSOClientConfig googleSSOClientConfig = new GoogleSSOClientConfig();
    ssoConfig.setAudience("https://www.googleapis.com/oauth2/v4/token");
    ssoConfig.setSecretKey("{secret_key.json}");
```

Provide the Google config while creating the [server connection](#Establish OpenMetadata Server Connection).
```java
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    server.setSecurityConfig(googleSSOClientConfig);

```
 
### Okta
To set up Okta as the auth provider. The following details should be provided:
* Client ID: Provide the client ID for the service application
* Org URL: It is the same as the ISSUER_URL with v1/token. It is recommended to use a separate authorization server for different applications, rather than using the default authorization server.
* Private Key: Use the Public/Private Key Pair that was generated while [Creating the Service Application](../../../content/deployment/security/okta/index.md#For a Test or Staging Instance:). When copy-pasting the keys ensure that there are no additional codes and that it is a JSON compatible string.
* Email: Enter the email address
* Scopes: Add the details of the scope created in the Authorization Server. Enter the name of the default scope created.

```java
    OktaSSOClientConfig oktaSSOClientConfig = new OktaSSOClientConfig();
    oktaSSOClientConfig.setClientId("{client_id}");
    oktaSSOClientConfig.setOrgURL("{org_url}/v1/token");
    oktaSSOClientConfig.setPrivateKey("{public/private keypair}");
    oktaSSOClientConfig.setEmail("{email}");
    oktaSSOClientConfig.setScopes({scope_list});
```
Provide the Okta config while creating the [server connection](#Establish OpenMetadata Server Connection).
```java
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.OKTA);
    server.setSecurityConfig(oktaSSOClientConfig);

```

### Auth0
To set up Auth0 as the auth provider. The following details should be provided:
* Client ID: Provide the client ID for the service application
* Secret Key: Provide the client secret.
* Domain: Provide the okta domain. Example`test.us.auth0.com`

```java
    Auth0SSOClientConfig auth0SSOClientConfig = new Auth0SSOClientConfig();
    auth0SSOClientConfig.setClientId("{client_id}");
    auth0SSOClientConfig.setSecretKey("{secret_key}");
    auth0SSOClientConfig.setDomain("{domain}");
```
Provide the Auth0 config while creating the [server connection](#Establish OpenMetadata Server Connection).
```java
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.AUTH_0);
    server.setSecurityConfig(auth0SSOClientConfig);
```

### Azure
To set up Azure as the auth provider. The following details should be provided:
* Client ID: The Application (Client) ID is displayed in the Overview section of the registered application.
* Client Secret: The clientSecret can be accessed from the Certificates & secret section of the application.
* Authority: When passing the details for authority, the `Tenant ID` is added to the URL as: https://login.microsoftonline.com/TenantID
* Scopes: Add the details of the scope created.

```java
    AzureSSOClientConfig azureSSOClientConfig = new AzureSSOClientConfig();
    azureSSOClientConfig.setClientId("{client_id}");
    azureSSOClientConfig.setClientSecret("{client_secret}");
    azureSSOClientConfig.setAuthority("{authority}");
    oktaSSOClientConfig.setScopes({scope_list});
```    
Provide the Auth0 config while creating the [server connection](#Establish OpenMetadata Server Connection).
```java
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.AZURE);
    server.setSecurityConfig(azureSSOClientConfig);
```

### OpenMetadata
To set up OpenMetadata as the auth provider. The following details should be provided:
* JWT Token: Provide the JWT Token. Example `eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5Mmo....XN0aW9uLWJvdEBvcGVubWV0YWRhdGEub3JnIn0.Ku_FHGIS3Id3ARusMaXZDYKcq...Ztap9KDU7nZilNT2Bq-o75aIsgKKmtSuVdBTzpFK8aLGLmRp_8J007t-kpcjIW7Qf0l4...dGb0QqhoZin0JA`

```java
    OpenMetadataJWTClientConfig openMetadataJWTClientConfig = new OpenMetadataJWTClientConfig();
    openMetadataJWTClientConfig.setJwtToken("{jwt_token}");
```
Provide the OpenMetadata config while creating the [server connection](#Establish OpenMetadata Server Connection).
```java
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.OPENMETADATA);
    server.setSecurityConfig(openMetadataJWTClientConfig);
```

### Custom OIDC
To set up Custom auth provider. The following details should be provided:
* Client ID: Provide the client id of the preferred auth provider
* Client Secret: Provide the client secret of the preferred auth provider
* Token Endpoint: Provide the token endpoint of the preferred auth provider

```java
    CustomOIDCSSOClientConfig customOIDCSSOClientConfig = new CustomOIDCSSOClientConfig();
    config.setClientId("{client_id}");
    config.setSecretKey("{client_secret}");
    config.setTokenEndpoint("{token_endpoint}");
```

Provide the OpenMetadata config while creating the [server connection](#Establish OpenMetadata Server Connection).
```java
    server.setAuthProvider(OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC);
    server.setSecurityConfig(customOIDCSSOClientConfig);
```

## How to Use APIs Using Java Client
To use an API, you can do it using the [OpenMetadata Gateway](#Create OpenMetadata Gateway).
Using OpenMetadata Gateway, you will need to build the client by providing the `class` of the respected API.
Below are some examples:
```java
    // Dashboards API
    DashboardsApi botsApi = openMetadataGateway.buildClient(DashboardsApi.class);

    // Tables API
    TablesApi tablesApiClient = openMetadataGateway.buildClient(TablesApi.class);

    // Users API
    UsersApi client = openMetadataGateway.buildClient(UsersApi.class);

    // Locations API
    LocationsApi locationsApi = openMetadataGateway.buildClient(LocationsApi.class);
```

To access an API, lets consider and example of:
* Tables API
```java
    TablesApi tablesApi = openMetadataGateway.buildClient(TablesApi.class);
    tablesApi.addLocationToTable("{table_id}", "{location_id}");
```
* Location API
```java
    LocationsApi locationsApi = openMetadataGateway.buildClient(LocationsApi.class);
    CreateLocation createLocation = new CreateLocation();
    Location location = locationsApi.createLocation(createLocation);
```
