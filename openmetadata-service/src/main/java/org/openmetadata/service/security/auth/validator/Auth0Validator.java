package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URL;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class Auth0Validator {

  private static final String AUTH0_WELL_KNOWN_PATH = "/.well-known/openid-configuration";
  private static final String AUTH0_TOKEN_PATH = "/oauth/token";
  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();

  public FieldError validateAuth0Configuration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateAuth0PublicClient(authConfig);
        case CONFIDENTIAL -> validateAuth0ConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Auth0 validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Auth0 validation failed: " + e.getMessage());
    }
  }

  private FieldError validateAuth0PublicClient(AuthenticationConfiguration authConfig) {
    try {
      String authority = authConfig.getAuthority();
      FieldError domainValidation =
          validateAuth0Domain(authority, ValidationErrorBuilder.FieldPaths.AUTH_AUTHORITY);
      if (domainValidation != null) {
        return domainValidation;
      }

      FieldError clientIdValidation = validatePublicClientId(authority, authConfig.getClientId());
      if (clientIdValidation != null) {
        return clientIdValidation;
      }

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, authority);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      return null; // Success - Auth0 public client validated
    } catch (Exception e) {
      LOG.error("Auth0 public client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Auth0 public client validation failed: " + e.getMessage());
    }
  }

  private FieldError validateAuth0ConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String auth0Domain = extractAuth0DomainFromOidcConfig(oidcConfig);
      FieldError domainValidation =
          validateAuth0Domain(auth0Domain, ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI);
      if (domainValidation != null) {
        return domainValidation;
      }

      // Validate against OIDC discovery document (scopes, response types, etc.)
      String discoveryUri = auth0Domain + AUTH0_WELL_KNOWN_PATH;
      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(
              oidcConfig.getDiscoveryUri(), authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, auth0Domain);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      FieldError credentialsValidation =
          validateClientCredentials(
              auth0Domain, oidcConfig.getId(), oidcConfig.getSecret(), oidcConfig.getCallbackUrl());
      if (credentialsValidation != null) {
        return credentialsValidation;
      }

      return null; // Success - Auth0 confidential client validated
    } catch (Exception e) {
      LOG.error("Auth0 confidential client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Auth0 confidential client validation failed: " + e.getMessage());
    }
  }

  private String extractAuth0DomainFromOidcConfig(OidcClientConfig oidcConfig) {
    if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
      String domain = oidcConfig.getDiscoveryUri().replace(AUTH0_WELL_KNOWN_PATH, "");
      LOG.debug(
          "Extracted Auth0 domain from discoveryUri: {} -> {}",
          oidcConfig.getDiscoveryUri(),
          domain);
      return domain;
    }
    LOG.error("Failed to extract Auth0 domain. discoveryUri: {}", oidcConfig.getDiscoveryUri());
    throw new IllegalArgumentException(
        "Unable to extract Auth0 domain from OIDC configuration. Please provide a valid discoveryUri or serverUrl");
  }

  private FieldError validateAuth0Domain(String auth0Domain, String fieldPath) {
    try {
      String discoveryUrl = auth0Domain + AUTH0_WELL_KNOWN_PATH;
      testAuth0DiscoveryEndpoint(discoveryUrl);

      return null; // Success - Auth0 domain validated
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          fieldPath, "Domain validation failed: " + e.getMessage());
    }
  }

  private void testAuth0DiscoveryEndpoint(String discoveryUrl) throws Exception {
    LOG.debug("Testing Auth0 discovery endpoint: {}", discoveryUrl);

    ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUrl);

    if (response.getStatusCode() != 200) {
      String errorMsg =
          String.format(
              "Failed to access Auth0 discovery endpoint. HTTP response: %d for URL: %s",
              response.getStatusCode(), discoveryUrl);
      LOG.error(errorMsg);
      throw new IllegalArgumentException(errorMsg);
    }
    JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());
    if (!discoveryDoc.has("issuer") || !discoveryDoc.has("authorization_endpoint")) {
      throw new IllegalArgumentException("Invalid Auth0 discovery document format");
    }

    if (!discoveryDoc.has("token_endpoint") || !discoveryDoc.has("userinfo_endpoint")) {
      throw new IllegalArgumentException("Missing required Auth0 endpoints in discovery document");
    }
    String issuer = discoveryDoc.get("issuer").asText();
    if (!issuer.startsWith("https://")) {
      throw new IllegalArgumentException("Auth0 issuer must use HTTPS");
    }
  }

  private FieldError validateClientCredentials(
      String auth0Domain, String clientId, String clientSecret, String redirectUri) {
    try {
      String authUrl =
          auth0Domain
              + "/authorize"
              + "?response_type=code"
              + "&client_id="
              + clientId
              + "&redirect_uri="
              + redirectUri
              + "&scope=openid";

      try {
        ValidationHttpUtil.HttpResponseData authResponse = ValidationHttpUtil.safeGet(authUrl);
        if (authResponse.getStatusCode() == 400 || authResponse.getStatusCode() == 404) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
              "Invalid client ID. The client ID is not recognized by Auth0.");
        }
      } catch (Exception e) {
        // Log but continue - we'll try the full credentials next
        LOG.debug("Could not validate client ID separately: {}", e.getMessage());
      }

      // Now try the full credentials
      String tokenUrl = auth0Domain + AUTH0_TOKEN_PATH;
      String requestBody =
          String.format(
              "grant_type=client_credentials&client_id=%s&client_secret=%s&audience=%s",
              clientId, clientSecret, auth0Domain + "/api/v2/");

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(tokenUrl, requestBody);

      int responseCode = response.getStatusCode();
      if (responseCode == 200) {
        // Successfully obtained token
        return null; // Success - Auth0 client credentials validated
      } else {
        // Parse error response
        try {
          JsonNode errorResponse = JsonUtils.readTree(response.getBody());
          String error = errorResponse.path("error").asText();
          String errorDescription = errorResponse.path("error_description").asText();

          if ("invalid_client".equals(error) || "unauthorized_client".equals(error)) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, "Invalid client secret");
          } else if ("access_denied".equals(error)) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
                "Access denied: " + errorDescription);
          } else {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
                "Authentication failed: " + errorDescription);
          }
        } catch (Exception parseError) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
              "Credentials validation failed. HTTP response: " + responseCode);
        }
      }
    } catch (Exception e) {
      LOG.warn("Auth0 credentials validation encountered an error", e);
      // Warning case - treat as success since credentials format appears valid
      LOG.warn("Could not fully validate Auth0 credentials: {}", e.getMessage());
      return null;
    }
  }

  private FieldError validatePublicClientId(String auth0Domain, String clientId) {
    return validateClientIdViaAuthorizationEndpoint(
        auth0Domain, clientId, "auth0-public-client-id", "public");
  }

  private FieldError validateClientIdViaAuthorizationEndpoint(
      String auth0Domain, String clientId, String componentName, String clientType) {
    try {
      String authEndpoint = auth0Domain + "/authorize";
      String testUrl =
          authEndpoint
              + "?client_id="
              + clientId
              + "&response_type=code"
              + "&redirect_uri=http://test.example.com"
              + "&state=test";

      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.getNoRedirect(testUrl);

      int responseCode = response.getStatusCode();

      // Auth0 will redirect to login page (302) if client_id is valid
      // or return error page (400/404) if client_id is invalid
      if (responseCode == 302 || responseCode == 200) {
        // Check if it's redirecting to Auth0 login page or showing login form
        String clientTypeDesc = clientType.isEmpty() ? "" : clientType + " ";
        return null; // Success - Auth0 client ID validated
      } else if (responseCode == 400 || responseCode == 404) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID,
            "Invalid Auth0 client ID. Client does not exist or is not properly configured.");
      } else {
        // Warning case - treat as success since format appears valid
        LOG.warn("Could not fully validate Auth0 client ID. HTTP response: {}", responseCode);
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID, "Could not validate client Id");
      }

    } catch (Exception e) {
      // Warning case - treat as success since format appears valid
      LOG.warn("Auth0 client ID validation warning: {}", e.getMessage());
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID,
          "Auth0 client ID validation warning: {}" + e.getMessage());
    }
  }

  private FieldError validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, String auth0Domain) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      // Skip validation if publicKeyUrls is empty - it's auto-populated for confidential clients
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        LOG.debug(
            "publicKeyUrls is empty, skipping validation (auto-populated for confidential clients)");
        return null;
      }

      String expectedJwksUrl = auth0Domain + "/.well-known/jwks.json";
      boolean hasCorrectAuth0JwksUrl = false;

      for (String urlStr : publicKeyUrls) {
        if (urlStr.equals(expectedJwksUrl)) {
          hasCorrectAuth0JwksUrl = true;
          break;
        }
      }

      if (!hasCorrectAuth0JwksUrl) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
            "At least one public key URL must be the Auth0 JWKS endpoint: " + expectedJwksUrl);
      }

      for (String urlStr : publicKeyUrls) {
        try {
          URL url = new URL(urlStr);

          String host = url.getHost();
          if (!host.endsWith(".auth0.com") && !host.contains(".")) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Public key URL domain doesn't match Auth0 pattern: " + host);
          }

          ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(urlStr);

          if (response.getStatusCode() != 200) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Public key URL is not accessible. HTTP response: "
                    + response.getStatusCode()
                    + " for URL: "
                    + urlStr);
          }
          JsonNode jwks = JsonUtils.readTree(response.getBody());
          if (!jwks.has("keys") && !urlStr.contains("/pem")) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
          }
          if (jwks.has("keys") && jwks.get("keys").size() == 0) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "JWKS endpoint returned empty keys array: " + urlStr);
          }

        } catch (Exception e) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
              "Invalid public key URL '" + urlStr + "': " + e.getMessage());
        }
      }

      return null; // Success - Auth0 public key URLs validated
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
          "Public key URL validation failed: " + e.getMessage());
    }
  }
}
