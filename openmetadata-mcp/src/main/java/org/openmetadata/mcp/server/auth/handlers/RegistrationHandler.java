package org.openmetadata.mcp.server.auth.handlers;

import java.net.URI;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Set;
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
 *
 * <p>TODO: The registration endpoint is currently open (unauthenticated) per RFC 7591 §3 SHOULD
 * and MCP spec requirements. Future improvements:
 * <ul>
 *   <li>Add configurable registration policy (open vs admin-only) via MCPConfiguration
 *   <li>Add client expiry and automated cleanup of orphaned registrations
 *   <li>Consider static client initialization during server configuration
 *   <li>Add admin API for listing and pruning registered clients
 * </ul>
 */
@Slf4j
public class RegistrationHandler {

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final int CLIENT_SECRET_BYTES = 32;
  // Block dangerous schemes; allow http, https, and private-use URI schemes
  // per RFC 8252 Section 7.1 (e.g. cursor://, vscode://, claude-desktop://)
  private static final Set<String> BLOCKED_REDIRECT_SCHEMES =
      Set.of("javascript", "data", "file", "blob", "vbscript");
  private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "::1");

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
                    : List.of("authorization_code", "refresh_token"));
            clientInfo.setResponseTypes(
                metadata.getResponseTypes() != null && !metadata.getResponseTypes().isEmpty()
                    ? metadata.getResponseTypes()
                    : List.of("code"));
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

          } catch (RegistrationException e) {
            LOG.warn("Client registration rejected: {}", e.getMessage());
            throw new RuntimeException(e);
          } catch (Exception e) {
            LOG.error("Client registration failed due to server error", e);
            throw new RuntimeException(
                new RegistrationException("server_error", "Client registration failed"));
          }
        });
  }

  /**
   * Validate registration request per RFC 7591.
   *
   * @param metadata The client registration metadata
   * @throws RegistrationException if validation fails
   */
  private static final int MAX_STRING_FIELD_LENGTH = 255;

  private static final int MAX_URI_FIELD_LENGTH = 2048;

  private static final int MAX_REDIRECT_URIS = 10;

  private static final int MAX_CONTACTS = 5;

  private static final int MAX_GRANT_TYPES = 5;

  private static final int MAX_RESPONSE_TYPES = 5;

  private void validateRegistrationRequest(OAuthClientMetadata metadata)
      throws RegistrationException {

    // Validate string field lengths to prevent storage exhaustion
    validateFieldLength(metadata.getClientName(), "client_name", MAX_STRING_FIELD_LENGTH);
    validateFieldLength(metadata.getSoftwareId(), "software_id", MAX_STRING_FIELD_LENGTH);
    validateFieldLength(metadata.getSoftwareVersion(), "software_version", MAX_STRING_FIELD_LENGTH);
    validateFieldLength(metadata.getScope(), "scope", MAX_STRING_FIELD_LENGTH);
    validateUriFieldLength(metadata.getClientUri(), "client_uri");
    validateUriFieldLength(metadata.getLogoUri(), "logo_uri");
    validateUriFieldLength(metadata.getTosUri(), "tos_uri");
    validateUriFieldLength(metadata.getPolicyUri(), "policy_uri");
    if (metadata.getContacts() != null) {
      validateListSize(metadata.getContacts(), "contacts", MAX_CONTACTS);
      for (String contact : metadata.getContacts()) {
        validateFieldLength(contact, "contacts entry", MAX_STRING_FIELD_LENGTH);
      }
    }

    // redirect_uris is REQUIRED per RFC 7591 Section 2
    if (metadata.getRedirectUris() == null || metadata.getRedirectUris().isEmpty()) {
      throw new RegistrationException(
          "invalid_redirect_uri", "At least one redirect_uri must be provided");
    }
    validateListSize(metadata.getRedirectUris(), "redirect_uris", MAX_REDIRECT_URIS);

    // Validate redirect URI schemes and hosts
    // RFC 8252 Section 7.1: native apps may use private-use URI schemes (e.g. cursor://, vscode://)
    // RFC 8252 Section 7.3: http redirect URIs MUST use loopback addresses only
    for (URI uri : metadata.getRedirectUris()) {
      String scheme = uri.getScheme();
      if (scheme == null || BLOCKED_REDIRECT_SCHEMES.contains(scheme.toLowerCase())) {
        throw new RegistrationException(
            "invalid_redirect_uri", "redirect_uri uses a disallowed scheme: " + uri);
      }
      if (uri.getFragment() != null) {
        throw new RegistrationException(
            "invalid_redirect_uri", "redirect_uri must not contain a fragment: " + uri);
      }
      if ("http".equalsIgnoreCase(scheme)) {
        String host = uri.getHost();
        if (host == null || !LOOPBACK_HOSTS.contains(host)) {
          throw new RegistrationException(
              "invalid_redirect_uri",
              "http redirect_uri must use localhost/loopback address: " + uri);
        }
      }
    }

    // Validate supported grant types
    if (metadata.getGrantTypes() != null) {
      validateListSize(metadata.getGrantTypes(), "grant_types", MAX_GRANT_TYPES);
      for (String grantType : metadata.getGrantTypes()) {
        if (!isSupportedGrantType(grantType)) {
          throw new RegistrationException(
              "invalid_client_metadata", "Unsupported grant_type: " + grantType);
        }
      }
    }

    // Validate supported response types
    if (metadata.getResponseTypes() != null) {
      validateListSize(metadata.getResponseTypes(), "response_types", MAX_RESPONSE_TYPES);
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
    return "client_secret_post".equals(authMethod) || "none".equals(authMethod);
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

  private void validateFieldLength(String value, String fieldName, int maxLength)
      throws RegistrationException {
    if (value != null && value.length() > maxLength) {
      throw new RegistrationException(
          "invalid_client_metadata", fieldName + " exceeds maximum length of " + maxLength);
    }
  }

  private void validateUriFieldLength(URI value, String fieldName) throws RegistrationException {
    if (value != null && value.toString().length() > MAX_URI_FIELD_LENGTH) {
      throw new RegistrationException(
          "invalid_client_metadata",
          fieldName + " exceeds maximum length of " + MAX_URI_FIELD_LENGTH);
    }
  }

  private void validateListSize(java.util.Collection<?> list, String fieldName, int maxSize)
      throws RegistrationException {
    if (list != null && list.size() > maxSize) {
      throw new RegistrationException(
          "invalid_client_metadata",
          fieldName + " exceeds maximum allowed entries (" + maxSize + ")");
    }
  }
}
