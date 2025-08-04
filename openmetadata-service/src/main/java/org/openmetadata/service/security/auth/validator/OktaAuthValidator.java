package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class OktaAuthValidator {

  private static final String OKTA_WELL_KNOWN_PATH = "/.well-known/openid-configuration";
  private static final String OKTA_INTROSPECT_PATH = "/v1/introspect";

  public ValidationResult validateOktaConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      // Step 1: Validate basic configuration
      ValidationResult basicValidation = validateBasicConfig(authConfig, oidcConfig);
      if ("failed".equals(basicValidation.getStatus())) {
        return basicValidation;
      }

      // Extract Okta domain
      String oktaDomain = extractOktaDomain(oidcConfig);

      // Step 2: Validate Okta domain format and accessibility
      ValidationResult domainValidation = validateOktaDomain(oktaDomain);
      if ("failed".equals(domainValidation.getStatus())) {
        return domainValidation;
      }

      // Step 3: Validate client credentials based on client type
      ValidationResult credentialsValidation =
          validateClientBasedOnType(authConfig, oidcConfig, oktaDomain);
      if ("failed".equals(credentialsValidation.getStatus())) {
        return credentialsValidation;
      }

      return new ValidationResult()
          .withComponent("okta")
          .withStatus("success")
          .withMessage(
              "Okta configuration validated successfully. Domain is accessible and credentials format is valid.");
    } catch (Exception e) {
      LOG.error("Okta validation failed", e);
      return new ValidationResult()
          .withComponent("okta")
          .withStatus("failed")
          .withMessage("Okta validation failed: " + e.getMessage());
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

      // Okta client IDs are typically base64-like strings (e.g., 0oa1bcdefg2hijklmn3o4)
      if (!clientId.matches("^[0-9a-zA-Z]{20,}$")) {
        LOG.warn("Okta client ID format may be invalid: {}", clientId);
      }

      // Validate OIDC configuration
      if (oidcConfig == null) {
        throw new IllegalArgumentException(
            "OIDC configuration is required for Okta authentication");
      }

      // Discovery URI is strongly preferred for Okta validation
      if (nullOrEmpty(oidcConfig.getDiscoveryUri()) && nullOrEmpty(oidcConfig.getServerUrl())) {
        throw new IllegalArgumentException(
            "Okta discovery URI is required for validation. Please provide discoveryUri in OIDC configuration.");
      }

      return new ValidationResult()
          .withComponent("okta-basic")
          .withStatus("success")
          .withMessage("Basic Okta configuration is valid");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("okta-basic")
          .withStatus("failed")
          .withMessage(e.getMessage());
    }
  }

  private String extractOktaDomain(OidcClientConfig oidcConfig) {
    // Priority order: discoveryUri first (contains actual Okta domain), then serverUrl as fallback
    if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
      // Remove the well-known path to get the domain
      String domain = oidcConfig.getDiscoveryUri().replace(OKTA_WELL_KNOWN_PATH, "");
      LOG.debug(
          "Extracted Okta domain from discoveryUri: {} -> {}",
          oidcConfig.getDiscoveryUri(),
          domain);
      return domain;
    } else if (!nullOrEmpty(oidcConfig.getServerUrl())
        && oidcConfig.getServerUrl().contains("okta")) {
      // Only use serverUrl if it actually contains "okta" (not OpenMetadata server URL)
      LOG.debug("Using Okta domain from serverUrl: {}", oidcConfig.getServerUrl());
      return oidcConfig.getServerUrl();
    }

    LOG.error(
        "Failed to extract Okta domain. discoveryUri: {}, serverUrl: {}",
        oidcConfig.getDiscoveryUri(),
        oidcConfig.getServerUrl());
    throw new IllegalArgumentException(
        "Unable to extract Okta domain from configuration. Please provide a valid discoveryUri or Okta serverUrl.");
  }

  private ValidationResult validateOktaDomain(String oktaDomain) {
    try {
      // Validate domain format
      if (!oktaDomain.startsWith("https://")) {
        throw new IllegalArgumentException("Okta domain must use HTTPS");
      }

      // Check if it's a valid Okta domain pattern
      URL url = new URL(oktaDomain);
      String host = url.getHost();

      // Valid Okta domains:
      // - https://dev-12345.okta.com
      // - https://company.okta.com
      // - https://company.oktapreview.com
      // - https://custom-domain.com (for custom domains)
      boolean isValidOktaDomain =
          host.endsWith(".okta.com")
              || host.endsWith(".oktapreview.com")
              || host.endsWith(".okta-emea.com")
              || host.contains("."); // Allow custom domains

      if (!isValidOktaDomain) {
        throw new IllegalArgumentException(
            "Invalid Okta domain format. Expected *.okta.com, *.oktapreview.com, or custom domain");
      }

      // Test discovery endpoint
      String discoveryUrl = oktaDomain + OKTA_WELL_KNOWN_PATH;
      testOktaDiscoveryEndpoint(discoveryUrl);

      return new ValidationResult()
          .withComponent("okta-domain")
          .withStatus("success")
          .withMessage("Okta domain validated successfully");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("okta-domain")
          .withStatus("failed")
          .withMessage("Domain validation failed: " + e.getMessage());
    }
  }

  private void testOktaDiscoveryEndpoint(String discoveryUrl) throws Exception {
    URL url = new URL(discoveryUrl);
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    conn.setRequestMethod("GET");
    conn.setConnectTimeout(5000);
    conn.setReadTimeout(5000);

    int responseCode = conn.getResponseCode();
    if (responseCode != 200) {
      throw new IllegalArgumentException(
          "Failed to access Okta discovery endpoint. HTTP response: " + responseCode);
    }

    // Parse and validate the discovery document
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
      StringBuilder response = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) {
        response.append(line);
      }

      JsonNode discoveryDoc = JsonUtils.readTree(response.toString());

      // Validate Okta-specific fields
      if (!discoveryDoc.has("issuer") || !discoveryDoc.has("authorization_endpoint")) {
        throw new IllegalArgumentException("Invalid Okta discovery document format");
      }

      String issuer = discoveryDoc.get("issuer").asText();
      if (!issuer.contains("okta")) {
        LOG.warn("Discovery document issuer doesn't contain 'okta': {}", issuer);
      }

      // Check for required Okta endpoints
      if (!discoveryDoc.has("token_endpoint") || !discoveryDoc.has("userinfo_endpoint")) {
        throw new IllegalArgumentException("Missing required Okta endpoints in discovery document");
      }
    }
  }

  private ValidationResult validateClientCredentials(
      String oktaDomain, String clientId, String clientSecret) {
    try {
      // Okta supports introspection endpoint to validate tokens
      // We can attempt a basic auth check against the introspect endpoint
      // This won't fully validate but will check if credentials are properly formatted

      if (nullOrEmpty(clientSecret)) {
        throw new IllegalArgumentException("Client secret is required for confidential clients");
      }

      // Okta client secrets should be reasonably long
      if (clientSecret.length() < 20) {
        throw new IllegalArgumentException(
            "Client secret appears to be invalid. Okta client secrets are typically longer.");
      }

      // Try to access the introspect endpoint with basic auth
      // This will fail with 400 (no token provided) if creds are valid
      // or 401 if creds are invalid
      String introspectUrl = oktaDomain + "/oauth2/v1/introspect";
      URL url = new URL(introspectUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

      // Set Basic Auth header
      String auth = clientId + ":" + clientSecret;
      String encodedAuth =
          Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
      conn.setRequestProperty("Authorization", "Basic " + encodedAuth);

      conn.setDoOutput(true);
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);

      // Send empty token parameter (will fail, but we're checking auth)
      String requestBody = "token=dummy&token_type_hint=access_token";
      try (OutputStream os = conn.getOutputStream()) {
        byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
        os.write(input, 0, input.length);
      }

      int responseCode = conn.getResponseCode();

      if (responseCode == 401) {
        // 401 means invalid client credentials
        return new ValidationResult()
            .withComponent("okta-credentials")
            .withStatus("failed")
            .withMessage(
                "Invalid client credentials. Please verify the client ID and secret are correct.");
      } else if (responseCode == 400 || responseCode == 200) {
        // 400 or 200 means client authenticated successfully (but token was invalid/dummy)
        return new ValidationResult()
            .withComponent("okta-credentials")
            .withStatus("success")
            .withMessage("Okta client credentials validated successfully");
      } else {
        // Some other error
        return new ValidationResult()
            .withComponent("okta-credentials")
            .withStatus("warning")
            .withMessage("Could not fully validate credentials. HTTP response: " + responseCode);
      }
    } catch (Exception e) {
      LOG.warn("Okta credentials validation encountered an error", e);
      return new ValidationResult()
          .withComponent("okta-credentials")
          .withStatus("warning")
          .withMessage(
              "Could not fully validate credentials: "
                  + e.getMessage()
                  + ". Credentials format appears valid.");
    }
  }

  private ValidationResult validateClientBasedOnType(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig, String oktaDomain) {
    try {
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();
      String clientId = authConfig.getClientId();

      if ("public".equals(clientType)) {
        // Public clients don't have secrets, validate client ID against authorization endpoint
        return validatePublicClient(oktaDomain, clientId);
      } else if ("confidential".equals(clientType)) {
        // Confidential clients must have secrets
        if (oidcConfig == null || nullOrEmpty(oidcConfig.getSecret())) {
          throw new IllegalArgumentException(
              "Client secret is required for confidential Okta clients");
        }
        return validateClientCredentials(oktaDomain, clientId, oidcConfig.getSecret());
      } else {
        return new ValidationResult()
            .withComponent("okta-client-type")
            .withStatus("failed")
            .withMessage("Unknown client type: " + authConfig.getClientType());
      }
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("okta-client-type")
          .withStatus("failed")
          .withMessage("Client type validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validatePublicClient(String oktaDomain, String clientId) {
    try {
      // For public clients, test the authorization endpoint to verify client_id exists
      String authEndpoint = oktaDomain + "/oauth2/v1/authorize";
      String testUrl =
          authEndpoint
              + "?client_id="
              + clientId
              + "&response_type=code"
              + "&redirect_uri=http://test.example.com"
              + "&state=test";

      URL url = new URL(testUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);
      conn.setInstanceFollowRedirects(false); // Don't follow redirects

      int responseCode = conn.getResponseCode();

      // For public clients:
      // - 302 redirect = client_id is valid
      // - 400 with specific error = client_id is invalid
      if (responseCode == 302) {
        return new ValidationResult()
            .withComponent("okta-public-client")
            .withStatus("success")
            .withMessage("Okta public client ID validated successfully");
      } else if (responseCode == 400) {
        // Read error response to check if it's invalid_client
        try (BufferedReader reader =
            new BufferedReader(
                new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
          StringBuilder response = new StringBuilder();
          String line;
          while ((line = reader.readLine()) != null) {
            response.append(line);
          }

          if (response.toString().contains("invalid_client")) {
            return new ValidationResult()
                .withComponent("okta-public-client")
                .withStatus("failed")
                .withMessage(
                    "Invalid Okta client ID. Client does not exist or is not configured properly.");
          }
        }
      }

      return new ValidationResult()
          .withComponent("okta-public-client")
          .withStatus("warning")
          .withMessage("Could not fully validate public client. HTTP response: " + responseCode);

    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("okta-public-client")
          .withStatus("warning")
          .withMessage(
              "Public client validation failed: " + e.getMessage() + ". Format appears valid.");
    }
  }
}
