# Authentication Implementation for Java SDK

This package provides OAuth 2.0 authentication functionality for the Java SDK, based on the implementation in the Python SDK.

## Overview

The authentication implementation follows the OAuth 2.0 specification and includes:

1. **Core OAuth Models**:
   - `OAuthToken`: Represents an OAuth token with access and refresh tokens
   - `OAuthClientMetadata`: Client registration metadata
   - `OAuthClientInformation`: Client information including credentials
   - `OAuthMetadata`: Authorization server metadata

2. **Token Models**:
   - `AccessToken`: Represents an OAuth access token
   - `RefreshToken`: Represents an OAuth refresh token
   - `AuthorizationCode`: Represents an OAuth authorization code

3. **Authentication Middleware**:
   - `BearerAuthenticator`: Validates Bearer tokens in Authorization headers
   - `ClientAuthenticator`: Validates client credentials
   - `AuthContext`: Holds authentication context for a request

4. **Provider Interface**:
   - `OAuthAuthorizationServerProvider`: Interface for OAuth authorization server providers

5. **Exceptions**:
   - `RegistrationException`: Thrown during client registration errors
   - `AuthorizeException`: Thrown during authorization errors
   - `TokenException`: Thrown during token operations errors
   - `InvalidScopeException`: Thrown when a requested scope is invalid
   - `InvalidRedirectUriException`: Thrown when a redirect URI is invalid

## Usage

To use the authentication functionality:

1. Implement the `OAuthAuthorizationServerProvider` interface
2. Use the `BearerAuthenticator` to validate Bearer tokens
3. Use the `ClientAuthenticator` to validate client credentials

Example:

```java
// Create an OAuth provider implementation
OAuthAuthorizationServerProvider provider = new MyOAuthProvider();

// Create authenticators
BearerAuthenticator bearerAuth = new BearerAuthenticator(provider);
ClientAuthenticator clientAuth = new ClientAuthenticator(provider);

// Authenticate a request with a Bearer token
String authHeader = "Bearer abc123";
bearerAuth.authenticate(authHeader)
    .thenAccept(user -> {
        if (user != null) {
            // User is authenticated
            String clientId = user.getClientId();
            // ...
        } else {
            // Authentication failed
        }
    });

// Authenticate a client
String clientId = "client123";
String clientSecret = "secret456";
clientAuth.authenticate(clientId, clientSecret)
    .thenAccept(client -> {
        // Client is authenticated
        // ...
    })
    .exceptionally(ex -> {
        // Authentication failed
        // ...
        return null;
    });
```

## Implementation Notes

- The implementation uses CompletableFuture for asynchronous operations
- Token validation includes expiration checks
- Client authentication supports both secret and no-secret modes
- URI utilities are provided for constructing redirect URIs