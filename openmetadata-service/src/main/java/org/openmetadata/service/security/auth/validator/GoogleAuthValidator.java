package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class GoogleAuthValidator {

  private static final String GOOGLE_ACCOUNTS_BASE = "https://accounts.google.com";
  private static final String GOOGLE_OAUTH2_BASE = "https://oauth2.googleapis.com";
  private static final String OPENID_CONFIG_PATH = "/.well-known/openid-configuration";
  private static final String TOKEN_ENDPOINT = "/token";

  public ValidationResult validateGoogleConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      // Step 1: Validate basic configuration
      ValidationResult basicValidation = validateBasicConfig(authConfig, oidcConfig);
      if ("failed".equals(basicValidation.getStatus())) {
        return basicValidation;
      }

      // Step 2: Validate Google discovery endpoint is accessible
      ValidationResult discoveryValidation = validateGoogleDiscoveryEndpoint();
      if ("failed".equals(discoveryValidation.getStatus())) {
        return discoveryValidation;
      }

      // Step 3: If we have client credentials, validate format and attempt validation
      if (oidcConfig != null && !nullOrEmpty(oidcConfig.getSecret())) {
        ValidationResult credentialsValidation =
            validateClientCredentialsFormat(authConfig.getClientId(), oidcConfig.getSecret());
        if ("failed".equals(credentialsValidation.getStatus())) {
          return credentialsValidation;
        }
      }

      return new ValidationResult()
          .withComponent("google")
          .withStatus("success")
          .withMessage(
              "Google OAuth configuration validated successfully. Client ID format is valid and Google services are accessible.");
    } catch (Exception e) {
      LOG.error("Google OAuth validation failed", e);
      return new ValidationResult()
          .withComponent("google")
          .withStatus("failed")
          .withMessage("Google OAuth validation failed: " + e.getMessage());
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

      // Google client IDs should end with .apps.googleusercontent.com
      if (!clientId.endsWith(".apps.googleusercontent.com")) {
        throw new IllegalArgumentException(
            "Invalid Google client ID format. Expected format: {project-id}.apps.googleusercontent.com");
      }

      // Extract project ID and validate format
      String projectId = clientId.substring(0, clientId.indexOf(".apps.googleusercontent.com"));
      if (projectId.isEmpty() || !projectId.matches("[0-9]+-[a-z0-9]+")) {
        throw new IllegalArgumentException(
            "Invalid Google client ID format. The project ID portion should match pattern: {numeric-id}-{alphanumeric-id}");
      }

      // Validate authority if provided
      String authority = authConfig.getAuthority();
      if (!nullOrEmpty(authority) && !authority.contains("accounts.google.com")) {
        throw new IllegalArgumentException("Google authority must use accounts.google.com domain");
      }

      // For Google, we typically use the discovery URI
      if (oidcConfig != null) {
        String discoveryUri = oidcConfig.getDiscoveryUri();
        if (!nullOrEmpty(discoveryUri)
            && !discoveryUri.equals(GOOGLE_ACCOUNTS_BASE + OPENID_CONFIG_PATH)) {
          LOG.warn(
              "Non-standard Google discovery URI provided: {}. Expected: {}",
              discoveryUri,
              GOOGLE_ACCOUNTS_BASE + OPENID_CONFIG_PATH);
        }
      }

      return new ValidationResult()
          .withComponent("google-basic")
          .withStatus("success")
          .withMessage("Basic Google configuration is valid");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("google-basic")
          .withStatus("failed")
          .withMessage(e.getMessage());
    }
  }

  private ValidationResult validateGoogleDiscoveryEndpoint() {
    try {
      String discoveryUrl = GOOGLE_ACCOUNTS_BASE + OPENID_CONFIG_PATH;
      URL url = new URL(discoveryUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);

      int responseCode = conn.getResponseCode();
      if (responseCode != 200) {
        return new ValidationResult()
            .withComponent("google-discovery")
            .withStatus("failed")
            .withMessage(
                "Failed to access Google discovery endpoint. HTTP response: " + responseCode);
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

        // Validate expected Google endpoints
        if (!discoveryDoc.has("issuer") || !discoveryDoc.has("token_endpoint")) {
          throw new IllegalArgumentException("Invalid discovery document format");
        }

        String issuer = discoveryDoc.get("issuer").asText();
        if (!issuer.equals("https://accounts.google.com")) {
          throw new IllegalArgumentException("Unexpected issuer in Google discovery document");
        }

        String tokenEndpoint = discoveryDoc.get("token_endpoint").asText();
        if (!tokenEndpoint.equals(GOOGLE_OAUTH2_BASE + TOKEN_ENDPOINT)) {
          throw new IllegalArgumentException(
              "Unexpected token endpoint in Google discovery document");
        }
      }

      return new ValidationResult()
          .withComponent("google-discovery")
          .withStatus("success")
          .withMessage("Google discovery endpoint validated successfully");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("google-discovery")
          .withStatus("failed")
          .withMessage("Discovery validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateClientCredentialsFormat(String clientId, String clientSecret) {
    try {
      // Google doesn't support client_credentials grant type, so we can only validate format

      // Validate client secret format (should not be empty)
      if (nullOrEmpty(clientSecret)) {
        throw new IllegalArgumentException("Client secret is required for confidential clients");
      }

      // Google client secrets are typically base64-like strings
      if (clientSecret.length() < 20) {
        throw new IllegalArgumentException(
            "Client secret appears to be invalid. Google client secrets are typically longer.");
      }

      // Note: We cannot actually validate the credentials without user interaction
      // Google requires authorization code flow with user consent
      LOG.info(
          "Google client credentials format validated. Note: Actual credential validation requires user authentication flow.");

      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("success")
          .withMessage(
              "Google client credentials format validated. Note: Full validation requires user authentication.");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage("Credentials validation failed: " + e.getMessage());
    }
  }

  /**
   * Attempts to validate credentials using Google's OAuth2 endpoint.
   * Note: This is limited as Google doesn't support client_credentials grant.
   * We can only attempt an invalid request to check if the client exists.
   */
  private ValidationResult attemptCredentialsValidation(String clientId, String clientSecret) {
    try {
      // Google doesn't support client_credentials, but we can try an invalid grant type
      // to see if we get a client authentication error vs invalid grant error
      String tokenUrl = GOOGLE_OAUTH2_BASE + TOKEN_ENDPOINT;
      URL url = new URL(tokenUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
      conn.setDoOutput(true);
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);

      // Attempt with an invalid grant type to trigger authentication
      String requestBody =
          String.format(
              "client_id=%s&client_secret=%s&grant_type=client_credentials",
              clientId, clientSecret);

      try (OutputStream os = conn.getOutputStream()) {
        byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
        os.write(input, 0, input.length);
      }

      int responseCode = conn.getResponseCode();

      // Read error response
      try (BufferedReader reader =
          new BufferedReader(
              new InputStreamReader(
                  responseCode >= 400 ? conn.getErrorStream() : conn.getInputStream(),
                  StandardCharsets.UTF_8))) {
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
          response.append(line);
        }

        JsonNode errorResponse = JsonUtils.readTree(response.toString());
        String error = errorResponse.path("error").asText();

        // Google returns "unsupported_grant_type" if client is valid but grant type is not
        // supported
        // Returns "invalid_client" if credentials are wrong
        if ("unsupported_grant_type".equals(error)) {
          // This actually means the client authenticated successfully
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("success")
              .withMessage(
                  "Google client credentials appear to be valid (client authenticated successfully)");
        } else if ("invalid_client".equals(error)) {
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("failed")
              .withMessage(
                  "Invalid client credentials. Please verify the client ID and secret are correct.");
        } else {
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("warning")
              .withMessage(
                  "Could not fully validate credentials. Google requires user authentication flow. Error: "
                      + error);
        }
      }
    } catch (Exception e) {
      // This is expected for Google as they don't support this flow
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("warning")
          .withMessage(
              "Could not validate credentials directly. Google requires user authentication flow.");
    }
  }
}
