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
public class CognitoAuthValidator {

  private static final String COGNITO_WELL_KNOWN_PATH = "/.well-known/openid-configuration";
  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();

  public FieldError validateCognitoConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateCognitoPublicClient(authConfig);
        case CONFIDENTIAL -> validateCognitoConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Cognito validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Cognito validation failed: " + e.getMessage());
    }
  }

  private FieldError validateCognitoPublicClient(AuthenticationConfiguration authConfig) {
    try {
      // Step 1: Validate authority URL format and extract Cognito details
      String authority = authConfig.getAuthority();

      CognitoDetails cognitoDetails = validateAndExtractCognitoDetails(authority);

      FieldError poolValidation = validateUserPool(cognitoDetails);
      if (poolValidation != null) {
        return poolValidation;
      }

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, cognitoDetails);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      return null; // Success - Cognito public client validated
    } catch (Exception e) {
      LOG.error("Cognito public client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Cognito public client validation failed: " + e.getMessage());
    }
  }

  private FieldError validateCognitoConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      CognitoDetails cognitoDetails = extractCognitoDetailsFromOidcConfig(oidcConfig);

      FieldError poolValidation = validateUserPool(cognitoDetails);
      if (poolValidation != null) {
        return poolValidation;
      }

      // Validate against OIDC discovery document (scopes, response types, etc.)
      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(
              cognitoDetails.discoveryUri, authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, cognitoDetails);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      // Validate client credentials
      FieldError credentialsValidation =
          validateClientCredentials(
              cognitoDetails,
              oidcConfig.getId(),
              oidcConfig.getSecret(),
              oidcConfig.getCallbackUrl());
      if (credentialsValidation != null) {
        return credentialsValidation;
      }

      return null; // Success - Cognito confidential client validated
    } catch (Exception e) {
      LOG.error("Cognito confidential client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Cognito confidential client validation failed: " + e.getMessage());
    }
  }

  private CognitoDetails extractCognitoDetailsFromOidcConfig(OidcClientConfig oidcConfig) {
    if (nullOrEmpty(oidcConfig.getDiscoveryUri())) {
      throw new IllegalArgumentException(
          "Discovery URI is required for confidential Cognito clients");
    }

    String sourceUrl = oidcConfig.getDiscoveryUri();
    LOG.debug("Extracting Cognito details from discoveryUri: {}", sourceUrl);

    return parseCognitoUrl(sourceUrl);
  }

  private CognitoDetails validateAndExtractCognitoDetails(String authority) {
    // Validate authority format for Cognito
    if (!authority.matches("https://cognito-idp\\.[a-z0-9-]+\\.amazonaws\\.com/[a-zA-Z0-9_-]+")) {
      throw new IllegalArgumentException(
          "Invalid Cognito authority format. Expected: https://cognito-idp.{region}.amazonaws.com/{userPoolId}");
    }

    LOG.debug("Extracting Cognito details from authority: {}", authority);
    return parseCognitoUrl(authority);
  }

  private CognitoDetails parseCognitoUrl(String sourceUrl) {
    // Parse Cognito URL to extract region and user pool ID
    // Authority format: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
    // Discovery format:
    // https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/openid-configuration

    String baseUrl;
    if (sourceUrl.contains("/.well-known/openid-configuration")) {
      baseUrl = sourceUrl.replace("/.well-known/openid-configuration", "");
    } else {
      baseUrl = sourceUrl;
    }

    if (!baseUrl.matches("https://cognito-idp\\.[a-z0-9-]+\\.amazonaws\\.com/[a-zA-Z0-9_-]+")) {
      throw new IllegalArgumentException(
          "Invalid Cognito URL format. Expected: https://cognito-idp.{region}.amazonaws.com/{userPoolId}");
    }

    // Extract region and user pool ID
    String[] parts = baseUrl.split("/");
    String domain = parts[2]; // cognito-idp.{region}.amazonaws.com
    String region = domain.split("\\.")[1];
    String userPoolId = parts[3];

    // Validate region
    if (!region.matches("^[a-z]{2}-[a-z]+-[0-9]$")) {
      throw new IllegalArgumentException("Invalid AWS region format: " + region);
    }

    // Validate user pool ID format
    if (!userPoolId.matches("^[a-zA-Z0-9][a-zA-Z0-9_-]+$")) {
      throw new IllegalArgumentException("Invalid Cognito user pool ID format: " + userPoolId);
    }

    String discoveryUri = baseUrl + COGNITO_WELL_KNOWN_PATH;
    return new CognitoDetails(region, userPoolId, discoveryUri);
  }

  private FieldError validateUserPool(CognitoDetails cognitoDetails) {
    try {
      // Test discovery endpoint
      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.safeGet(cognitoDetails.discoveryUri);

      if (response.getStatusCode() == 404) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Cognito user pool '"
                + cognitoDetails.userPoolId
                + "' not found in region '"
                + cognitoDetails.region
                + "'. Please verify the user pool ID and region.");
      } else if (response.getStatusCode() != 200) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Failed to access Cognito discovery endpoint. HTTP response: "
                + response.getStatusCode());
      }

      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());

      if (!discoveryDoc.has("issuer") || !discoveryDoc.has("authorization_endpoint")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Invalid Cognito discovery document format");
      }

      // Validate issuer format
      String issuer = discoveryDoc.get("issuer").asText();
      String expectedIssuer =
          String.format(
              "https://cognito-idp.%s.amazonaws.com/%s",
              cognitoDetails.region, cognitoDetails.userPoolId);
      if (!issuer.equals(expectedIssuer)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Unexpected issuer in Cognito discovery document. Expected: " + expectedIssuer);
      }

      // Check for required Cognito endpoints
      if (!discoveryDoc.has("token_endpoint")
          || !discoveryDoc.has("userinfo_endpoint")
          || !discoveryDoc.has("jwks_uri")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Missing required Cognito endpoints in discovery document");
      }

      return null; // Success - Cognito user pool validated
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
          "User pool validation failed: " + e.getMessage());
    }
  }

  private FieldError validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, CognitoDetails cognitoDetails) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      // Skip validation if publicKeyUrls is empty - it's auto-populated for confidential clients
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        LOG.debug(
            "publicKeyUrls is empty, skipping validation (auto-populated for confidential clients)");
        return null;
      }

      String expectedJwksUri =
          String.format(
              "https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json",
              cognitoDetails.region, cognitoDetails.userPoolId);

      boolean hasCorrectCognitoJwksUrl = false;

      // Check if at least one URL matches the expected Cognito JWKS format
      for (String urlStr : publicKeyUrls) {
        if (urlStr.equals(expectedJwksUri)) {
          hasCorrectCognitoJwksUrl = true;
          break;
        }
      }

      if (!hasCorrectCognitoJwksUrl) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
            "At least one public key URL must be the Cognito JWKS endpoint: " + expectedJwksUri);
      }

      for (String urlStr : publicKeyUrls) {
        try {
          URL url = new URL(urlStr);

          // Validate domain matches Cognito pattern
          String host = url.getHost();
          if (!host.matches("cognito-idp\\.[a-z0-9-]+\\.amazonaws\\.com")) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Public key URL domain doesn't match Cognito pattern: " + host);
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
          if (!jwks.has("keys")) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
          }

          // Validate keys array is not empty
          if (jwks.get("keys").size() == 0) {
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

      return null; // Success - Cognito public key URLs validated
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
          "Public key URL validation failed: " + e.getMessage());
    }
  }

  private FieldError validateClientCredentials(
      CognitoDetails cognitoDetails, String clientId, String clientSecret, String redirectUri) {
    try {
      if (nullOrEmpty(clientSecret)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
            "Client secret is required for confidential Cognito clients");
      }

      // Get the actual authorization endpoint from discovery document
      String authorizationEndpoint =
          getAuthorizationEndpointFromDiscovery(cognitoDetails.discoveryUri);
      if (authorizationEndpoint == null) {
        // Fallback to constructed URL if we can't get from discovery
        authorizationEndpoint =
            String.format(
                "https://cognito-idp.%s.amazonaws.com/%s/oauth2/authorize",
                cognitoDetails.region, cognitoDetails.userPoolId);
      }

      // Build auth URL exactly as done in AuthenticationCodeFlowHandler
      // Build query parameters similar to buildLoginParams in AuthenticationCodeFlowHandler
      StringBuilder authUrlBuilder = new StringBuilder(authorizationEndpoint);
      authUrlBuilder.append("?response_type=code");
      authUrlBuilder.append("&client_id=").append(clientId);
      authUrlBuilder
          .append("&redirect_uri=")
          .append(java.net.URLEncoder.encode(redirectUri, "UTF-8"));
      authUrlBuilder.append("&scope=openid%20email%20profile");
      authUrlBuilder.append("&response_mode=query");

      String authUrl = authUrlBuilder.toString();
      LOG.debug("Testing client ID with auth URL: {}", authUrl);

      try {
        ValidationHttpUtil.HttpResponseData authResponse =
            ValidationHttpUtil.getNoRedirect(authUrl);
        int statusCode = authResponse.getStatusCode();

        if (statusCode == 302 || statusCode == 301) {
          // Check the Location header to determine if client ID is valid
          String locationHeader = authResponse.getLocationHeader();

          LOG.debug(
              "Cognito authorization response - Status: {}, Location: {}",
              statusCode,
              locationHeader);

          if (locationHeader != null) {
            // Check if redirect is to error page (invalid client) or login page (valid client)
            if (locationHeader.contains("/error")
                && locationHeader.contains("error=invalid_request")) {
              return ValidationErrorBuilder.createFieldError(
                  ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID, "Invalid client ID");
            } else if (locationHeader.contains("/login")) {
              LOG.debug("Client ID validated successfully - redirects to login page");
            }
          }
        } else if (statusCode == 400 || statusCode == 404) {
          // Some Cognito configurations might return 400/404 directly
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID, "Invalid client ID");
        }
      } catch (Exception e) {
        // Log but continue - we'll try the full credentials next
        LOG.debug("Could not validate client ID separately: {}", e.getMessage());
      }

      // Extract token endpoint from discovery document
      String tokenEndpoint = getTokenEndpointFromDiscovery(cognitoDetails.discoveryUri);
      if (tokenEndpoint == null) {
        // Fallback to standard Cognito token endpoint pattern
        tokenEndpoint =
            String.format(
                "https://cognito-idp.%s.amazonaws.com/%s/token",
                cognitoDetails.region, cognitoDetails.userPoolId);
      }

      // First, try to validate using client credentials grant
      // Note: This requires the app client to have client credentials grant enabled
      // and custom scopes configured in Cognito
      String requestBody =
          String.format("grant_type=client_credentials&client_id=%s&scope=openid", clientId);

      String authHeader = ValidationHttpUtil.createBasicAuthHeader(clientId, clientSecret);

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(
              tokenEndpoint, requestBody, java.util.Map.of("Authorization", authHeader));

      int responseCode = response.getStatusCode();
      if (responseCode == 200) {
        // Successfully obtained token
        return null; // Success - Cognito client credentials validated
      } else if (responseCode == 400 || responseCode == 401) {
        // Parse error response
        try {
          JsonNode errorResponse = JsonUtils.readTree(response.getBody());
          String error = errorResponse.path("error").asText();
          String errorDescription = errorResponse.path("error_description").asText();

          if ("invalid_client".equals(error)) {
            // Check if we have more details in the error description
            if (!errorDescription.isEmpty() && errorDescription.toLowerCase().contains("secret")) {
              return ValidationErrorBuilder.createFieldError(
                  ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, "Invalid client secret");
            } else if (!errorDescription.isEmpty()
                && errorDescription.toLowerCase().contains("client")) {
              return ValidationErrorBuilder.createFieldError(
                  ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID, "Invalid client ID");
            } else {
              // Since we tried to validate client ID first, if we get invalid_client here
              // it's more likely to be a secret issue
              return ValidationErrorBuilder.createFieldError(
                  ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, "Invalid client secret");
            }
          } else if ("unauthorized_client".equals(error)) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
                "Client is not authorized. Please check app client settings in Cognito.");
          } else if ("unsupported_grant_type".equals(error)) {
            // Client credentials grant not enabled - try fallback validation
            return tryFallbackCredentialsValidation(
                tokenEndpoint,
                clientId,
                clientSecret,
                "Client credentials grant not enabled for this app client.");
          } else if ("invalid_grant".equals(error)) {
            // This typically means client_credentials is enabled but no custom scopes are
            // configured
            // Or the scope requested is not allowed
            return tryFallbackCredentialsValidation(
                tokenEndpoint,
                clientId,
                clientSecret,
                "Client credentials grant may require custom scopes in Cognito. "
                    + "Error: "
                    + (errorDescription.isEmpty() ? error : errorDescription));
          } else {
            // Unknown error - try fallback validation
            return tryFallbackCredentialsValidation(
                tokenEndpoint, clientId, clientSecret, "Initial validation failed: " + error);
          }
        } catch (Exception parseError) {
          // Could not parse error response - try fallback
          return tryFallbackCredentialsValidation(
              tokenEndpoint, clientId, clientSecret, "Could not parse error response");
        }
      } else {
        // Warning case - treat as success since credentials format appears valid
        LOG.warn("Could not fully validate Cognito credentials. HTTP response: {}", responseCode);
        return null;
      }
    } catch (Exception e) {
      LOG.warn("Cognito credentials validation encountered an error", e);
      // Warning case - treat as success since credentials format appears valid
      LOG.warn("Could not fully validate Cognito credentials: {}", e.getMessage());
      return null;
    }
  }

  private String getTokenEndpointFromDiscovery(String discoveryUri) {
    try {
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);
      if (response.getStatusCode() == 200) {
        JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());
        if (discoveryDoc.has("token_endpoint")) {
          return discoveryDoc.get("token_endpoint").asText();
        }
      }
    } catch (Exception e) {
      LOG.debug("Failed to get token endpoint from discovery document", e);
    }
    return null;
  }

  private String getAuthorizationEndpointFromDiscovery(String discoveryUri) {
    try {
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);
      if (response.getStatusCode() == 200) {
        JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());
        if (discoveryDoc.has("authorization_endpoint")) {
          String authEndpoint = discoveryDoc.get("authorization_endpoint").asText();
          LOG.debug("Found authorization endpoint from discovery: {}", authEndpoint);
          return authEndpoint;
        }
      }
    } catch (Exception e) {
      LOG.debug("Failed to get authorization endpoint from discovery document", e);
    }
    return null;
  }

  private FieldError tryFallbackCredentialsValidation(
      String tokenEndpoint, String clientId, String clientSecret, String initialError) {
    try {
      // Try using an invalid authorization code to test if credentials are correct
      // This will fail with a different error if credentials are valid
      String fallbackBody =
          String.format(
              "grant_type=authorization_code&client_id=%s&code=invalid_test_code&redirect_uri=http://localhost",
              clientId);

      String authHeader = ValidationHttpUtil.createBasicAuthHeader(clientId, clientSecret);

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(
              tokenEndpoint, fallbackBody, java.util.Map.of("Authorization", authHeader));

      int responseCode = response.getStatusCode();
      if (responseCode == 400 || responseCode == 401) {
        try {
          JsonNode errorResponse = JsonUtils.readTree(response.getBody());
          String error = errorResponse.path("error").asText();

          if ("invalid_client".equals(error)) {
            // Since we already checked client ID, this likely means wrong secret
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, "Invalid client secret");
          } else if ("invalid_grant".equals(error) || "invalid_request".equals(error)) {
            // Credentials are likely correct, just the code is invalid (as expected)
            return null; // Success - Cognito credentials validated with fallback method
          } else {
            // Some other error, but credentials might still be valid - treat warning as success
            LOG.warn("Cognito credentials validation warning: {}", initialError);
            return null;
          }
        } catch (Exception e) {
          // Warning case - treat as success since format appears valid
          LOG.warn("Could not fully validate Cognito credentials. Initial error: {}", initialError);
          return null;
        }
      } else {
        // Warning case - treat as success since format appears valid
        LOG.warn("Could not fully validate Cognito credentials. Initial error: {}", initialError);
        return null;
      }
    } catch (Exception e) {
      LOG.warn("Fallback validation failed", e);
      // Warning case - treat as success since format appears valid
      LOG.warn(
          "Cognito fallback validation failed: {}. Initial error: {}",
          e.getMessage(),
          initialError);
      return null;
    }
  }

  private static class CognitoDetails {
    final String region;
    final String userPoolId;
    final String discoveryUri;

    CognitoDetails(String region, String userPoolId, String discoveryUri) {
      this.region = region;
      this.userPoolId = userPoolId;
      this.discoveryUri = discoveryUri;
    }
  }
}
