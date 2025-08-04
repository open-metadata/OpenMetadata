package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
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
      CognitoDetails cognitoDetails = extractCognitoDetails(oidcConfig);

      // Step 2: Validate Cognito user pool exists and is accessible
      ValidationResult poolValidation = validateUserPool(cognitoDetails);
      if ("failed".equals(poolValidation.getStatus())) {
        return poolValidation;
      }

      // Step 3: If we have client credentials, validate format
      if (oidcConfig != null && !nullOrEmpty(oidcConfig.getSecret())) {
        ValidationResult credentialsValidation =
            validateClientCredentialsFormat(authConfig.getClientId(), oidcConfig.getSecret());
        if ("failed".equals(credentialsValidation.getStatus())) {
          return credentialsValidation;
        }
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

      // Validate OIDC configuration
      if (oidcConfig == null) {
        throw new IllegalArgumentException(
            "OIDC configuration is required for Cognito authentication");
      }

      // Discovery URI is required for Cognito
      if (nullOrEmpty(oidcConfig.getDiscoveryUri())) {
        throw new IllegalArgumentException("Cognito discovery URI is required");
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

  private CognitoDetails extractCognitoDetails(OidcClientConfig oidcConfig) {
    String discoveryUri = oidcConfig.getDiscoveryUri();

    // Parse Cognito discovery URI
    // Format:
    // https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/openid-configuration
    if (!discoveryUri.matches(
        "https://cognito-idp\\.[a-z0-9-]+\\.amazonaws\\.com/[a-zA-Z0-9_-]+/.well-known/openid-configuration")) {
      throw new IllegalArgumentException(
          "Invalid Cognito discovery URI format. "
              + "Expected: https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/openid-configuration");
    }

    // Extract region and user pool ID
    String[] parts = discoveryUri.split("/");
    String domain = parts[2]; // cognito-idp.{region}.amazonaws.com
    String region = domain.split("\\.")[1];
    String userPoolId = parts[3];

    // Validate region
    if (!region.matches("^[a-z]{2}-[a-z]+-[0-9]$")) {
      throw new IllegalArgumentException("Invalid AWS region format in discovery URI: " + region);
    }

    // Validate user pool ID format
    if (!userPoolId.matches("^[a-zA-Z0-9][a-zA-Z0-9_-]+$")) {
      throw new IllegalArgumentException("Invalid Cognito user pool ID format: " + userPoolId);
    }

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
