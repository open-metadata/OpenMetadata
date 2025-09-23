package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URL;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class CognitoAuthValidator {

  private static final String COGNITO_WELL_KNOWN_PATH = "/.well-known/openid-configuration";
  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();

  public ValidationResult validateCognitoConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateCognitoPublicClient(authConfig);
        case CONFIDENTIAL -> validateCognitoConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Cognito validation failed", e);
      return new ValidationResult()
          .withComponent("cognito")
          .withStatus("failed")
          .withMessage("Cognito validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateCognitoPublicClient(AuthenticationConfiguration authConfig) {
    try {
      // Step 1: Validate authority URL format and extract Cognito details
      String authority = authConfig.getAuthority();

      CognitoDetails cognitoDetails = validateAndExtractCognitoDetails(authority);

      ValidationResult poolValidation = validateUserPool(cognitoDetails);
      if ("failed".equals(poolValidation.getStatus())) {
        return poolValidation;
      }

      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig, cognitoDetails);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      return new ValidationResult()
          .withComponent("cognito-public")
          .withStatus("success")
          .withMessage(
              "Cognito public client validated successfully. Authority, client ID, and public key URLs are valid.");
    } catch (Exception e) {
      LOG.error("Cognito public client validation failed", e);
      return new ValidationResult()
          .withComponent("cognito-public")
          .withStatus("failed")
          .withMessage("Cognito public client validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateCognitoConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      CognitoDetails cognitoDetails = extractCognitoDetailsFromOidcConfig(oidcConfig);

      ValidationResult poolValidation = validateUserPool(cognitoDetails);
      if ("failed".equals(poolValidation.getStatus())) {
        return poolValidation;
      }

      // Validate against OIDC discovery document (scopes, response types, etc.)
      ValidationResult discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(
              cognitoDetails.discoveryUri, authConfig, oidcConfig);
      if (!"success".equals(discoveryCheck.getStatus())) {
        return discoveryCheck;
      }

      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig, cognitoDetails);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      // Validate client credentials
      ValidationResult credentialsValidation =
          validateClientCredentials(cognitoDetails, oidcConfig.getId(), oidcConfig.getSecret());
      if ("failed".equals(credentialsValidation.getStatus())) {
        return credentialsValidation;
      }

      return new ValidationResult()
          .withComponent("cognito-confidential")
          .withStatus("success")
          .withMessage(
              "Cognito confidential client validated successfully. Discovery URI, client ID, public key URLs, and secret are valid.");
    } catch (Exception e) {
      LOG.error("Cognito confidential client validation failed", e);
      return new ValidationResult()
          .withComponent("cognito-confidential")
          .withStatus("failed")
          .withMessage("Cognito confidential client validation failed: " + e.getMessage());
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

  private ValidationResult validateUserPool(CognitoDetails cognitoDetails) {
    try {
      // Test discovery endpoint
      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.safeGet(cognitoDetails.discoveryUri);

      if (response.getStatusCode() == 404) {
        return new ValidationResult()
            .withComponent("cognito-pool")
            .withStatus("failed")
            .withMessage(
                "Cognito user pool '"
                    + cognitoDetails.userPoolId
                    + "' not found in region '"
                    + cognitoDetails.region
                    + "'. Please verify the user pool ID and region.");
      } else if (response.getStatusCode() != 200) {
        return new ValidationResult()
            .withComponent("cognito-pool")
            .withStatus("failed")
            .withMessage(
                "Failed to access Cognito discovery endpoint. HTTP response: "
                    + response.getStatusCode());
      }

      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());

      if (!discoveryDoc.has("issuer") || !discoveryDoc.has("authorization_endpoint")) {
        return new ValidationResult()
            .withComponent("cognito-pool")
            .withStatus("failed")
            .withMessage("Invalid Cognito discovery document format");
      }

      // Validate issuer format
      String issuer = discoveryDoc.get("issuer").asText();
      String expectedIssuer =
          String.format(
              "https://cognito-idp.%s.amazonaws.com/%s",
              cognitoDetails.region, cognitoDetails.userPoolId);
      if (!issuer.equals(expectedIssuer)) {
        return new ValidationResult()
            .withComponent("cognito-pool")
            .withStatus("failed")
            .withMessage(
                "Unexpected issuer in Cognito discovery document. Expected: " + expectedIssuer);
      }

      // Check for required Cognito endpoints
      if (!discoveryDoc.has("token_endpoint")
          || !discoveryDoc.has("userinfo_endpoint")
          || !discoveryDoc.has("jwks_uri")) {
        return new ValidationResult()
            .withComponent("cognito-pool")
            .withStatus("failed")
            .withMessage("Missing required Cognito endpoints in discovery document");
      }

      return new ValidationResult()
          .withComponent("cognito-pool")
          .withStatus("success")
          .withMessage("Cognito user pool validated successfully");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("cognito-pool")
          .withStatus("failed")
          .withMessage("User pool validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, CognitoDetails cognitoDetails) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        return new ValidationResult()
            .withComponent("cognito-public-key-urls")
            .withStatus("failed")
            .withMessage("Public key URLs are required for Cognito clients");
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
        return new ValidationResult()
            .withComponent("cognito-public-key-urls")
            .withStatus("failed")
            .withMessage(
                "At least one public key URL must be the Cognito JWKS endpoint: "
                    + expectedJwksUri);
      }

      for (String urlStr : publicKeyUrls) {
        try {
          URL url = new URL(urlStr);

          // Validate domain matches Cognito pattern
          String host = url.getHost();
          if (!host.matches("cognito-idp\\.[a-z0-9-]+\\.amazonaws\\.com")) {
            return new ValidationResult()
                .withComponent("cognito-public-key-urls")
                .withStatus("failed")
                .withMessage("Public key URL domain doesn't match Cognito pattern: " + host);
          }

          ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(urlStr);

          if (response.getStatusCode() != 200) {
            return new ValidationResult()
                .withComponent("cognito-public-key-urls")
                .withStatus("failed")
                .withMessage(
                    "Public key URL is not accessible. HTTP response: "
                        + response.getStatusCode()
                        + " for URL: "
                        + urlStr);
          }

          JsonNode jwks = JsonUtils.readTree(response.getBody());
          if (!jwks.has("keys")) {
            return new ValidationResult()
                .withComponent("cognito-public-key-urls")
                .withStatus("failed")
                .withMessage("Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
          }

          // Validate keys array is not empty
          if (jwks.get("keys").size() == 0) {
            return new ValidationResult()
                .withComponent("cognito-public-key-urls")
                .withStatus("failed")
                .withMessage("JWKS endpoint returned empty keys array: " + urlStr);
          }

        } catch (Exception e) {
          return new ValidationResult()
              .withComponent("cognito-public-key-urls")
              .withStatus("failed")
              .withMessage("Invalid public key URL '" + urlStr + "': " + e.getMessage());
        }
      }

      return new ValidationResult()
          .withComponent("cognito-public-key-urls")
          .withStatus("success")
          .withMessage(
              "Cognito public key URLs are valid and accessible. Found expected JWKS endpoint: "
                  + expectedJwksUri);
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("cognito-public-key-urls")
          .withStatus("failed")
          .withMessage("Public key URL validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateClientCredentials(
      CognitoDetails cognitoDetails, String clientId, String clientSecret) {
    try {
      if (nullOrEmpty(clientSecret)) {
        return new ValidationResult()
            .withComponent("cognito-credentials")
            .withStatus("failed")
            .withMessage("Client secret is required for confidential Cognito clients");
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
        return new ValidationResult()
            .withComponent("cognito-credentials")
            .withStatus("success")
            .withMessage("Cognito client credentials validated successfully");
      } else if (responseCode == 400 || responseCode == 401) {
        // Parse error response
        try {
          JsonNode errorResponse = JsonUtils.readTree(response.getBody());
          String error = errorResponse.path("error").asText();
          String errorDescription = errorResponse.path("error_description").asText();

          if ("invalid_client".equals(error)) {
            return new ValidationResult()
                .withComponent("cognito-credentials")
                .withStatus("failed")
                .withMessage(
                    "Invalid client credentials. Please verify the client ID and secret are correct.");
          } else if ("unauthorized_client".equals(error)) {
            return new ValidationResult()
                .withComponent("cognito-credentials")
                .withStatus("failed")
                .withMessage(
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
        return new ValidationResult()
            .withComponent("cognito-credentials")
            .withStatus("warning")
            .withMessage("Could not fully validate credentials. HTTP response: " + responseCode);
      }
    } catch (Exception e) {
      LOG.warn("Cognito credentials validation encountered an error", e);
      return new ValidationResult()
          .withComponent("cognito-credentials")
          .withStatus("warning")
          .withMessage(
              "Could not fully validate credentials: "
                  + e.getMessage()
                  + ". Credentials format appears valid.");
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

  private ValidationResult tryFallbackCredentialsValidation(
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
            // Credentials are definitely wrong
            return new ValidationResult()
                .withComponent("cognito-credentials")
                .withStatus("failed")
                .withMessage(
                    "Invalid client credentials. Please verify the client ID and secret are correct.");
          } else if ("invalid_grant".equals(error) || "invalid_request".equals(error)) {
            // Credentials are likely correct, just the code is invalid (as expected)
            return new ValidationResult()
                .withComponent("cognito-credentials")
                .withStatus("success")
                .withMessage(
                    "Cognito client credentials validated successfully. Note: " + initialError);
          } else {
            // Some other error, but credentials might still be valid
            return new ValidationResult()
                .withComponent("cognito-credentials")
                .withStatus("warning")
                .withMessage("Client credentials format appears valid. " + initialError);
          }
        } catch (Exception e) {
          return new ValidationResult()
              .withComponent("cognito-credentials")
              .withStatus("warning")
              .withMessage("Could not fully validate credentials. " + initialError);
        }
      } else {
        return new ValidationResult()
            .withComponent("cognito-credentials")
            .withStatus("warning")
            .withMessage("Could not fully validate credentials. " + initialError);
      }
    } catch (Exception e) {
      LOG.warn("Fallback validation failed", e);
      return new ValidationResult()
          .withComponent("cognito-credentials")
          .withStatus("warning")
          .withMessage(
              "Could not fully validate credentials: " + e.getMessage() + ". " + initialError);
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
