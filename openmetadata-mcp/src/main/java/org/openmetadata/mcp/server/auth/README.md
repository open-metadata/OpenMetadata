# OAuth 2.0 Server Implementation

This package provides an OAuth 2.0 server implementation for the MCP Java SDK, supporting the Authorization Code flow with PKCE (Proof Key for Code Exchange).

## Components

### Handlers
- `AuthorizationHandler`: Handles OAuth authorization requests
- `TokenHandler`: Handles OAuth token requests
- `RegistrationHandler`: Handles OAuth client registration requests
- `RevocationHandler`: Handles OAuth token revocation requests
- `MetadataHandler`: Handles OAuth metadata requests

### Middleware
- `ClientAuthenticator`: Authenticates OAuth clients
- `BearerAuthenticator`: Authenticates requests with bearer tokens

### Settings
- `ClientRegistrationOptions`: Options for OAuth client registration
- `RevocationOptions`: Options for OAuth token revocation

### Utilities
- `OAuthRoutes`: Helper class for creating OAuth routes and metadata

## Usage Example

```java
// Create provider implementation
OAuthAuthorizationServerProvider provider = new MyOAuthProvider();

// Create options
ClientRegistrationOptions registrationOptions = new ClientRegistrationOptions();
registrationOptions.setValidScopes(List.of("read", "write"));

RevocationOptions revocationOptions = new RevocationOptions();

// Create metadata
URI issuerUrl = URI.create("https://api.example.com");
URI docsUrl = URI.create("https://docs.example.com");
OAuthMetadata metadata = OAuthRoutes.buildMetadata(
    issuerUrl,
    docsUrl,
    registrationOptions,
    revocationOptions
);

// Create handlers
OAuthRoutes.OAuthHandlers handlers = OAuthRoutes.createHandlers(
    provider,
    metadata,
    registrationOptions,
    revocationOptions
);

// Use handlers in your web framework
// For example, with Spring MVC:

@RestController
public class OAuthController {
    
    private final OAuthRoutes.OAuthHandlers handlers;
    
    public OAuthController(OAuthRoutes.OAuthHandlers handlers) {
        this.handlers = handlers;
    }
    
    @GetMapping("/.well-known/oauth-authorization-server")
    public OAuthMetadata getMetadata() {
        return handlers.getMetadataHandler().handle().join();
    }
    
    @GetMapping("/authorize")
    public ResponseEntity<String> authorize(@RequestParam Map<String, String> params) {
        try {
            String redirectUrl = handlers.getAuthorizationHandler().handle(params).join();
            return ResponseEntity.status(HttpStatus.FOUND)
                .header("Location", redirectUrl)
                .header("Cache-Control", "no-store")
                .build();
        } catch (CompletionException e) {
            // Handle errors
            return ResponseEntity.badRequest().body("Error: " + e.getCause().getMessage());
        }
    }
    
    @PostMapping("/token")
    public ResponseEntity<OAuthToken> token(@RequestParam Map<String, String> params) {
        try {
            OAuthToken token = handlers.getTokenHandler().handle(params).join();
            return ResponseEntity.ok()
                .header("Cache-Control", "no-store")
                .header("Pragma", "no-cache")
                .body(token);
        } catch (CompletionException e) {
            // Handle errors
            return ResponseEntity.badRequest().body(null);
        }
    }
    
    // Add other endpoints for registration and revocation
}
```

## Provider Implementation

You need to implement the `OAuthAuthorizationServerProvider` interface to provide the actual OAuth functionality:

```java
public class MyOAuthProvider implements OAuthAuthorizationServerProvider {
    
    // Store clients, authorization codes, tokens, etc.
    private final Map<String, OAuthClientInformation> clients = new ConcurrentHashMap<>();
    private final Map<String, AuthorizationCode> authCodes = new ConcurrentHashMap<>();
    private final Map<String, AccessToken> accessTokens = new ConcurrentHashMap<>();
    private final Map<String, RefreshToken> refreshTokens = new ConcurrentHashMap<>();
    
    @Override
    public CompletableFuture<OAuthClientInformation> getClient(String clientId) {
        return CompletableFuture.completedFuture(clients.get(clientId));
    }
    
    @Override
    public CompletableFuture<Void> registerClient(OAuthClientInformation clientInfo) {
        clients.put(clientInfo.getClientId(), clientInfo);
        return CompletableFuture.completedFuture(null);
    }
    
    @Override
    public CompletableFuture<String> authorize(OAuthClientInformation client, AuthorizationParams params) {
        // In a real implementation, you would show a UI to the user
        // and get their consent before generating an authorization code
        
        // For this example, we'll just generate a code immediately
        String code = generateRandomCode();
        
        AuthorizationCode authCode = new AuthorizationCode();
        authCode.setClientId(client.getClientId());
        authCode.setCodeChallenge(params.getCodeChallenge());
        authCode.setRedirectUri(params.getRedirectUri());
        authCode.setRedirectUriProvidedExplicitly(params.isRedirectUriProvidedExplicitly());
        authCode.setScopes(params.getScopes());
        authCode.setExpiresAt(Instant.now().plusSeconds(600).getEpochSecond()); // 10 minutes
        
        authCodes.put(code, authCode);
        
        // Build redirect URI with code and state
        String redirectUri = params.getRedirectUri().toString();
        redirectUri += "?code=" + code;
        if (params.getState() != null) {
            redirectUri += "&state=" + params.getState();
        }
        
        return CompletableFuture.completedFuture(redirectUri);
    }
    
    // Implement other methods...
}
```

## Security Features

- PKCE support to prevent authorization code interception attacks
- State parameter to prevent CSRF attacks
- Strict redirect URI validation
- Token expiration
- Scope validation
- HTTPS requirement (with localhost exception for testing)