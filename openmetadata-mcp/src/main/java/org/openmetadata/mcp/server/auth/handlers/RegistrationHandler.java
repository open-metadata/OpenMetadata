package org.openmetadata.mcp.server.auth.handlers;

import java.net.URI;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthClientMetadata;
import org.openmetadata.mcp.auth.exception.RegistrationException;
import org.openmetadata.mcp.server.auth.settings.ClientRegistrationOptions;

/**
 * Handler for OAuth client registration requests.
 */
public class RegistrationHandler {

  private final OAuthAuthorizationServerProvider provider;

  private final ClientRegistrationOptions options;

  public RegistrationHandler(
      OAuthAuthorizationServerProvider provider, ClientRegistrationOptions options) {
    this.provider = provider;
    this.options = options;
  }

  /**
   * Handle a client registration request.
   * @param clientMetadata The client metadata
   * @return A CompletableFuture that resolves to the registered client information
   */
  public CompletableFuture<OAuthClientInformation> handle(OAuthClientMetadata clientMetadata) {
    // Validate client metadata
    if (clientMetadata.getRedirectUris() == null || clientMetadata.getRedirectUris().isEmpty()) {
      return CompletableFuture.failedFuture(
          new RegistrationException(
              "invalid_redirect_uri", "At least one redirect URI is required"));
    }

    // Validate redirect URIs
    for (URI redirectUri : clientMetadata.getRedirectUris()) {
      if (!isValidRedirectUri(redirectUri)) {
        return CompletableFuture.failedFuture(
            new RegistrationException(
                "invalid_redirect_uri", "Invalid redirect URI: " + redirectUri));
      }
    }

    // Validate scopes if provided
    if (clientMetadata.getScope() != null && options.getValidScopes() != null) {
      String[] requestedScopes = clientMetadata.getScope().split(" ");
      for (String scope : requestedScopes) {
        if (!options.getValidScopes().contains(scope)) {
          return CompletableFuture.failedFuture(
              new RegistrationException("invalid_scope", "Invalid scope: " + scope));
        }
      }
    }

    // Create client information
    OAuthClientInformation clientInfo = new OAuthClientInformation();

    // Copy metadata fields
    clientInfo.setRedirectUris(clientMetadata.getRedirectUris());
    clientInfo.setTokenEndpointAuthMethod(clientMetadata.getTokenEndpointAuthMethod());
    clientInfo.setGrantTypes(clientMetadata.getGrantTypes());
    clientInfo.setResponseTypes(clientMetadata.getResponseTypes());
    clientInfo.setScope(clientMetadata.getScope());
    clientInfo.setClientName(clientMetadata.getClientName());
    clientInfo.setClientUri(clientMetadata.getClientUri());
    clientInfo.setLogoUri(clientMetadata.getLogoUri());
    clientInfo.setContacts(clientMetadata.getContacts());
    clientInfo.setTosUri(clientMetadata.getTosUri());
    clientInfo.setPolicyUri(clientMetadata.getPolicyUri());
    clientInfo.setJwksUri(clientMetadata.getJwksUri());
    clientInfo.setJwks(clientMetadata.getJwks());
    clientInfo.setSoftwareId(clientMetadata.getSoftwareId());
    clientInfo.setSoftwareVersion(clientMetadata.getSoftwareVersion());

    // Generate client ID and secret
    clientInfo.setClientId(generateClientId());

    // Generate client secret if using client_secret_post auth method
    if ("client_secret_post".equals(clientMetadata.getTokenEndpointAuthMethod())) {
      clientInfo.setClientSecret(generateClientSecret());
    }

    // Set issuance time
    clientInfo.setClientIdIssuedAt(System.currentTimeMillis() / 1000);

    // Register client with provider
    try {
      return provider.registerClient(clientInfo).thenApply(v -> clientInfo);
    } catch (RegistrationException e) {
      return CompletableFuture.failedFuture(e);
    }
  }

  /**
   * Validate a redirect URI.
   * @param redirectUri The redirect URI to validate
   * @return true if the redirect URI is valid, false otherwise
   */
  private boolean isValidRedirectUri(URI redirectUri) {
    String scheme = redirectUri.getScheme();

    // Check if localhost is allowed for non-HTTPS URIs
    if (options.isAllowLocalhostRedirect() && ("http".equals(scheme) || "custom".equals(scheme))) {
      String host = redirectUri.getHost();
      if ("localhost".equals(host) || host.startsWith("127.0.0.1")) {
        return true;
      }
    }

    // Require HTTPS for all other URIs
    return "https".equals(scheme);
  }

  /**
   * Generate a random client ID.
   * @return A random client ID
   */
  private String generateClientId() {
    return UUID.randomUUID().toString();
  }

  /**
   * Generate a random client secret.
   * @return A random client secret
   */
  private String generateClientSecret() {
    return UUID.randomUUID().toString() + UUID.randomUUID().toString();
  }
}
