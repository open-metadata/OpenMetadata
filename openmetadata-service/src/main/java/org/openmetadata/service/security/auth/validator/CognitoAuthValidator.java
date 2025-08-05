package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class CognitoAuthValidator {

  private static final String COGNITO_WELL_KNOWN_PATH = "/.well-known/openid-configuration";

  public ValidationResult validateCognitoConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      // Step 1: Validate basic configuration
      ValidationResult basicValidation = validateBasicConfig(authConfig, oidcConfig);
      if ("failed".equals(basicValidation.getStatus())) {
        return basicValidation;
      }

      // Extract Cognito details
      CognitoDetails cognitoDetails = extractCognitoDetails(authConfig, oidcConfig);

      // Step 2: Validate Cognito user pool exists and is accessible
      ValidationResult poolValidation = validateUserPool(cognitoDetails);
      if ("failed".equals(poolValidation.getStatus())) {
        return poolValidation;
      }

      // Step 3: Validate public key URLs
      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig, cognitoDetails);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      // Step 4: Validate based on client type
      ValidationResult clientValidation =
          validateClientBasedOnType(authConfig, oidcConfig, cognitoDetails);
      if ("failed".equals(clientValidation.getStatus())) {
        return clientValidation;
      }

      return new ValidationResult()
          .withComponent("cognito")
          .withStatus("success")
          .withMessage(
              "AWS Cognito configuration validated successfully. User pool is accessible and configuration is valid.");
    } catch (Exception e) {
      LOG.error("Cognito validation failed", e);
      return new ValidationResult()
          .withComponent("cognito")
          .withStatus("failed")
          .withMessage("Cognito validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateBasicConfig(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      // Validate client ID
      String clientId = authConfig.getClientId();
      if (nullOrEmpty(clientId)) {
        throw new IllegalArgumentException("Client ID is required");
      }

      // Cognito client IDs are typically alphanumeric strings
      if (!clientId.matches("^[a-zA-Z0-9]+$") || clientId.length() < 10) {
        throw new IllegalArgumentException(
            "Invalid Cognito client ID format. Expected alphanumeric string.");
      }

      // For public clients, OIDC configuration is optional
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();
      if ("confidential".equals(clientType)) {
        // Validate OIDC configuration for confidential clients
        if (oidcConfig == null) {
          throw new IllegalArgumentException(
              "OIDC configuration is required for confidential Cognito clients");
        }

        // Discovery URI is required for confidential clients
        if (nullOrEmpty(oidcConfig.getDiscoveryUri())) {
          throw new IllegalArgumentException(
              "Cognito discovery URI is required for confidential clients");
        }
      } else if ("public".equals(clientType)) {
        // For public clients, we use authority from authConfig, OIDC config is optional
        if (nullOrEmpty(authConfig.getAuthority())) {
          throw new IllegalArgumentException("Authority is required for public Cognito clients");
        }

        // Validate authority format for Cognito
        if (!authConfig
            .getAuthority()
            .matches("https://cognito-idp\\.[a-z0-9-]+\\.amazonaws\\.com/[a-zA-Z0-9_-]+")) {
          throw new IllegalArgumentException(
              "Invalid Cognito authority format. Expected: https://cognito-idp.{region}.amazonaws.com/{userPoolId}");
        }
      }

      return new ValidationResult()
          .withComponent("cognito-basic")
          .withStatus("success")
          .withMessage("Basic Cognito configuration is valid");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("cognito-basic")
          .withStatus("failed")
          .withMessage(e.getMessage());
    }
  }

  private CognitoDetails extractCognitoDetails(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    String sourceUrl;
    String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();

    if ("public".equals(clientType)) {
      // For public clients, use authority
      sourceUrl = authConfig.getAuthority();
      if (nullOrEmpty(sourceUrl)) {
        throw new IllegalArgumentException("Authority is required for public Cognito clients");
      }
      LOG.debug("Extracting Cognito details from authority: {}", sourceUrl);
    } else {
      // For confidential clients, use discoveryUri
      if (oidcConfig == null || nullOrEmpty(oidcConfig.getDiscoveryUri())) {
        throw new IllegalArgumentException(
            "Discovery URI is required for confidential Cognito clients");
      }
      sourceUrl = oidcConfig.getDiscoveryUri();
      LOG.debug("Extracting Cognito details from discoveryUri: {}", sourceUrl);
    }

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
      URL url = new URL(cognitoDetails.discoveryUri);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);

      int responseCode = conn.getResponseCode();
      if (responseCode == 404) {
        return new ValidationResult()
            .withComponent("cognito-pool")
            .withStatus("failed")
            .withMessage(
                "Cognito user pool '"
                    + cognitoDetails.userPoolId
                    + "' not found in region '"
                    + cognitoDetails.region
                    + "'. Please verify the user pool ID and region.");
      } else if (responseCode != 200) {
        return new ValidationResult()
            .withComponent("cognito-pool")
            .withStatus("failed")
            .withMessage(
                "Failed to access Cognito discovery endpoint. HTTP response: " + responseCode);
      }

      // Parse and validate the discovery document
      try (BufferedReader reader =
          new BufferedReader(
              new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
          response.append(line);
        }

        JsonNode discoveryDoc = JsonUtils.readTree(response.toString());

        // Validate Cognito-specific fields
        if (!discoveryDoc.has("issuer") || !discoveryDoc.has("authorization_endpoint")) {
          throw new IllegalArgumentException("Invalid Cognito discovery document format");
        }

        // Validate issuer format
        String issuer = discoveryDoc.get("issuer").asText();
        String expectedIssuer =
            String.format(
                "https://cognito-idp.%s.amazonaws.com/%s",
                cognitoDetails.region, cognitoDetails.userPoolId);
        if (!issuer.equals(expectedIssuer)) {
          throw new IllegalArgumentException(
              "Unexpected issuer in Cognito discovery document. Expected: " + expectedIssuer);
        }

        // Check for required Cognito endpoints
        if (!discoveryDoc.has("token_endpoint")
            || !discoveryDoc.has("userinfo_endpoint")
            || !discoveryDoc.has("jwks_uri")) {
          throw new IllegalArgumentException(
              "Missing required Cognito endpoints in discovery document");
        }
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

  private ValidationResult validateClientCredentialsFormat(String clientId, String clientSecret) {
    try {
      // Cognito client secrets are optional (for public clients)
      // When present, they should be properly formatted

      if (nullOrEmpty(clientSecret)) {
        // This might be a public client
        LOG.info("No client secret provided - this may be a Cognito public client");
        return new ValidationResult()
            .withComponent("cognito-credentials")
            .withStatus("success")
            .withMessage("Cognito client configuration validated (public client)");
      }

      // Cognito client secrets are typically base64-encoded strings
      if (clientSecret.length() < 20) {
        throw new IllegalArgumentException(
            "Client secret appears to be invalid. Cognito client secrets are typically longer.");
      }

      // Note: Cognito doesn't support client_credentials grant
      // We can't directly validate the credentials without user interaction
      LOG.info(
          "Cognito client credentials format validated. "
              + "Note: Full validation requires user authentication flow.");

      return new ValidationResult()
          .withComponent("cognito-credentials")
          .withStatus("success")
          .withMessage(
              "Cognito client credentials format validated. "
                  + "Note: Full validation requires user authentication.");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("cognito-credentials")
          .withStatus("failed")
          .withMessage("Credentials validation failed: " + e.getMessage());
    }
  }

  /**
   * Attempts to validate app client configuration using AWS Cognito API.
   * Note: This would require AWS SDK and proper IAM permissions.
   * For now, we're doing format validation only.
   */
  private ValidationResult attemptAppClientValidation(
      CognitoDetails cognitoDetails, String clientId, String clientSecret) {
    // In a real implementation, you would use AWS SDK here:
    // AWSCognitoIdentityProvider client = AWSCognitoIdentityProviderClientBuilder.standard()
    //     .withRegion(cognitoDetails.region)
    //     .build();
    // DescribeUserPoolClientRequest request = new DescribeUserPoolClientRequest()
    //     .withUserPoolId(cognitoDetails.userPoolId)
    //     .withClientId(clientId);
    // DescribeUserPoolClientResult result = client.describeUserPoolClient(request);

    // For now, return a warning that full validation requires AWS credentials
    return new ValidationResult()
        .withComponent("cognito-app-client")
        .withStatus("warning")
        .withMessage(
            "App client format validated. "
                + "Full validation would require AWS credentials and appropriate permissions.");
  }

  private ValidationResult validateClientBasedOnType(
      AuthenticationConfiguration authConfig,
      OidcClientConfig oidcConfig,
      CognitoDetails cognitoDetails) {
    try {
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();
      String clientId = authConfig.getClientId();

      if ("public".equals(clientType)) {
        // For public clients, validate client ID format and test user pool accessibility
        return validatePublicClient(cognitoDetails, clientId);
      } else if ("confidential".equals(clientType)) {
        // For confidential clients, validate credentials
        if (oidcConfig == null || nullOrEmpty(oidcConfig.getSecret())) {
          throw new IllegalArgumentException(
              "Client secret is required for confidential Cognito clients");
        }
        return validateClientCredentialsFormat(clientId, oidcConfig.getSecret());
      } else {
        return new ValidationResult()
            .withComponent("cognito-client-type")
            .withStatus("failed")
            .withMessage("Unknown client type: " + authConfig.getClientType());
      }
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("cognito-client-type")
          .withStatus("failed")
          .withMessage("Client type validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validatePublicClient(CognitoDetails cognitoDetails, String clientId) {
    try {
      // For public clients, we can't fully validate without AWS SDK and credentials
      // But we can test the user pool accessibility and client ID format

      // The client ID format validation is already done in basicConfig
      // Here we add additional validation that the user pool is accessible

      return new ValidationResult()
          .withComponent("cognito-public-client")
          .withStatus("success")
          .withMessage(
              "Cognito public client validated successfully. User pool is accessible. "
                  + "Note: Full client ID validation requires AWS SDK and appropriate permissions.");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("cognito-public-client")
          .withStatus("warning")
          .withMessage("Public client validation encountered an error: " + e.getMessage());
    }
  }

  private ValidationResult validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, CognitoDetails cognitoDetails) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        throw new IllegalArgumentException("Public key URLs are required");
      }

      String expectedJwksUri =
          String.format(
              "https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json",
              cognitoDetails.region, cognitoDetails.userPoolId);

      for (String urlStr : publicKeyUrls) {
        try {
          URL url = new URL(urlStr);

          // Cognito JWKS URL should match the expected format
          if (!urlStr.equals(expectedJwksUri)) {
            throw new IllegalArgumentException(
                "Cognito public key URL should be: " + expectedJwksUri + ", but got: " + urlStr);
          }

          // Test URL accessibility
          HttpURLConnection conn = (HttpURLConnection) url.openConnection();
          conn.setRequestMethod("GET");
          conn.setConnectTimeout(5000);
          conn.setReadTimeout(5000);

          int responseCode = conn.getResponseCode();
          if (responseCode != 200) {
            throw new IllegalArgumentException(
                "Public key URL is not accessible. HTTP response: "
                    + responseCode
                    + " for URL: "
                    + urlStr);
          }

          // Validate response is proper JWKS
          try (BufferedReader reader =
              new BufferedReader(
                  new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
              response.append(line);
            }

            // Parse as JSON to validate format
            JsonNode jwks = JsonUtils.readTree(response.toString());

            // For JWKS, should have 'keys' array
            if (!jwks.has("keys")) {
              throw new IllegalArgumentException(
                  "Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
            }

            // Validate keys array is not empty
            if (jwks.get("keys").size() == 0) {
              throw new IllegalArgumentException(
                  "JWKS endpoint returned empty keys array: " + urlStr);
            }
          }

        } catch (Exception e) {
          throw new IllegalArgumentException(
              "Invalid public key URL '" + urlStr + "': " + e.getMessage());
        }
      }

      return new ValidationResult()
          .withComponent("cognito-public-key-urls")
          .withStatus("success")
          .withMessage("Cognito public key URLs are valid and accessible");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("cognito-public-key-urls")
          .withStatus("failed")
          .withMessage("Public key URL validation failed: " + e.getMessage());
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
