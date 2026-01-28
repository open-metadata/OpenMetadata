package org.openmetadata.mcp.server.auth.handlers;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthClientMetadata;
import org.openmetadata.mcp.auth.exception.RegistrationException;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;

/**
 * Handler for OAuth 2.0 Dynamic Client Registration (RFC 7591).
 *
 * <p>Processes client registration requests and generates client credentials.
 */
@Slf4j
public class RegistrationHandler {

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final int CLIENT_SECRET_BYTES = 32;

  private final OAuthClientRepository clientRepository;

  public RegistrationHandler(OAuthClientRepository clientRepository) {
    this.clientRepository = clientRepository;
  }

  /**
   * Handle a client registration request.
   *
   * <p>Validates the registration metadata and generates client credentials.
   *
   * @param metadata The client registration metadata
   * @return CompletableFuture resolving to registered client information
   */
  public CompletableFuture<OAuthClientInformation> handle(OAuthClientMetadata metadata) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            validateRegistrationRequest(metadata);

            OAuthClientInformation clientInfo = new OAuthClientInformation();

            // Generate client credentials
            String clientId = generateClientId();
            String clientSecret = generateClientSecret();
            long issuedAt = System.currentTimeMillis() / 1000;

            // Set credentials
            clientInfo.setClientId(clientId);
            clientInfo.setClientSecret(clientSecret);
            clientInfo.setClientIdIssuedAt(issuedAt);
            clientInfo.setClientSecretExpiresAt(0L); // 0 means never expires

            // Copy metadata
            clientInfo.setClientName(metadata.getClientName());
            clientInfo.setRedirectUris(metadata.getRedirectUris());
            clientInfo.setTokenEndpointAuthMethod(
                metadata.getTokenEndpointAuthMethod() != null
                    ? metadata.getTokenEndpointAuthMethod()
                    : "client_secret_post");
            clientInfo.setGrantTypes(
                metadata.getGrantTypes() != null && !metadata.getGrantTypes().isEmpty()
                    ? metadata.getGrantTypes()
                    : java.util.Arrays.asList("authorization_code", "refresh_token"));
            clientInfo.setResponseTypes(
                metadata.getResponseTypes() != null && !metadata.getResponseTypes().isEmpty()
                    ? metadata.getResponseTypes()
                    : java.util.Arrays.asList("code"));
            clientInfo.setScope(metadata.getScope());

            // Optional metadata
            clientInfo.setClientUri(metadata.getClientUri());
            clientInfo.setLogoUri(metadata.getLogoUri());
            clientInfo.setContacts(metadata.getContacts());
            clientInfo.setTosUri(metadata.getTosUri());
            clientInfo.setPolicyUri(metadata.getPolicyUri());
            clientInfo.setSoftwareId(metadata.getSoftwareId());
            clientInfo.setSoftwareVersion(metadata.getSoftwareVersion());

            // Register in database
            clientRepository.register(clientInfo);

            LOG.info("Successfully registered OAuth client: {}", clientId);
            return clientInfo;

          } catch (Exception e) {
            LOG.error("Client registration failed", e);
            throw new RuntimeException(
                new RegistrationException(
                    "invalid_client_metadata", "Client registration failed: " + e.getMessage()));
          }
        });
  }

  /**
   * Validate registration request per RFC 7591.
   *
   * @param metadata The client registration metadata
   * @throws RegistrationException if validation fails
   */
  private void validateRegistrationRequest(OAuthClientMetadata metadata)
      throws RegistrationException {

    // redirect_uris is REQUIRED per RFC 7591 Section 2
    if (metadata.getRedirectUris() == null || metadata.getRedirectUris().isEmpty()) {
      throw new RegistrationException(
          "invalid_redirect_uri", "At least one redirect_uri must be provided");
    }

    // Validate supported grant types
    if (metadata.getGrantTypes() != null) {
      for (String grantType : metadata.getGrantTypes()) {
        if (!isSupportedGrantType(grantType)) {
          throw new RegistrationException(
              "invalid_client_metadata", "Unsupported grant_type: " + grantType);
        }
      }
    }

    // Validate supported response types
    if (metadata.getResponseTypes() != null) {
      for (String responseType : metadata.getResponseTypes()) {
        if (!responseType.equals("code")) {
          throw new RegistrationException(
              "invalid_client_metadata",
              "Unsupported response_type: " + responseType + ". Only 'code' is supported.");
        }
      }
    }

    // Validate token endpoint auth method
    if (metadata.getTokenEndpointAuthMethod() != null) {
      if (!isSupportedAuthMethod(metadata.getTokenEndpointAuthMethod())) {
        throw new RegistrationException(
            "invalid_client_metadata",
            "Unsupported token_endpoint_auth_method: " + metadata.getTokenEndpointAuthMethod());
      }
    }
  }

  private boolean isSupportedGrantType(String grantType) {
    return "authorization_code".equals(grantType) || "refresh_token".equals(grantType);
  }

  private boolean isSupportedAuthMethod(String authMethod) {
    return "client_secret_post".equals(authMethod)
        || "client_secret_basic".equals(authMethod)
        || "none".equals(authMethod);
  }

  /**
   * Generate cryptographically secure client ID.
   *
   * @return A unique client identifier
   */
  private String generateClientId() {
    return UUID.randomUUID().toString();
  }

  /**
   * Generate cryptographically secure client secret.
   *
   * @return A base64url-encoded random secret
   */
  private String generateClientSecret() {
    byte[] secretBytes = new byte[CLIENT_SECRET_BYTES];
    SECURE_RANDOM.nextBytes(secretBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(secretBytes);
  }
}
