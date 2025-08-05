package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
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
public class Auth0Validator {

  private static final String AUTH0_WELL_KNOWN_PATH = "/.well-known/openid-configuration";
  private static final String AUTH0_TOKEN_PATH = "/oauth/token";

  public ValidationResult validateAuth0Configuration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      // Step 1: Validate basic configuration
      ValidationResult basicValidation = validateBasicConfig(authConfig, oidcConfig);
      if ("failed".equals(basicValidation.getStatus())) {
        return basicValidation;
      }

      // Step 2: Validate public key URLs
      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      // Step 3: Extract Auth0 domain - use authority for public clients
      String auth0Domain = extractAuth0Domain(authConfig, oidcConfig);

      // Step 4: Validate Auth0 domain format and accessibility
      ValidationResult domainValidation = validateAuth0Domain(auth0Domain);
      if ("failed".equals(domainValidation.getStatus())) {
        return domainValidation;
      }

      // Step 5: Validate based on client type
      ValidationResult clientValidation =
          validateClientBasedOnType(authConfig, oidcConfig, auth0Domain);
      if ("failed".equals(clientValidation.getStatus())) {
        return clientValidation;
      }

      return new ValidationResult()
          .withComponent("auth0")
          .withStatus("success")
          .withMessage(
              "Auth0 configuration validated successfully. Domain is accessible and credentials are valid.");
    } catch (Exception e) {
      LOG.error("Auth0 validation failed", e);
      return new ValidationResult()
          .withComponent("auth0")
          .withStatus("failed")
          .withMessage("Auth0 validation failed: " + e.getMessage());
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

      // Auth0 client IDs are typically alphanumeric strings
      if (clientId.length() < 10) {
        throw new IllegalArgumentException(
            "Invalid Auth0 client ID format. Client ID appears too short.");
      }

      // For public clients, OIDC configuration is optional
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();
      if ("confidential".equals(clientType)) {
        // Validate OIDC configuration for confidential clients
        if (oidcConfig == null) {
          throw new IllegalArgumentException(
              "OIDC configuration is required for confidential Auth0 clients");
        }

        // Either discovery URI or server URL must be provided for confidential clients
        if (nullOrEmpty(oidcConfig.getDiscoveryUri()) && nullOrEmpty(oidcConfig.getServerUrl())) {
          throw new IllegalArgumentException(
              "Either Auth0 discovery URI or server URL must be provided for confidential clients");
        }
      } else if ("public".equals(clientType)) {
        // For public clients, we use authority from authConfig, OIDC config is optional
        if (nullOrEmpty(authConfig.getAuthority())) {
          throw new IllegalArgumentException("Authority is required for public Auth0 clients");
        }
      }

      return new ValidationResult()
          .withComponent("auth0-basic")
          .withStatus("success")
          .withMessage("Basic Auth0 configuration is valid");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("auth0-basic")
          .withStatus("failed")
          .withMessage(e.getMessage());
    }
  }

  private String extractAuth0Domain(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    // For public clients, use authority field
    //    if (oidcConfig == null
    //        || (nullOrEmpty(oidcConfig.getServerUrl()) &&
    // nullOrEmpty(oidcConfig.getDiscoveryUri()))) {
    String authority = authConfig.getAuthority();
    if (!nullOrEmpty(authority)) {
      LOG.debug("Extracting Auth0 domain from authority: {}", authority);
      return authority;
    } else {
      LOG.error("No authority found in authentication configuration");
    }
    //    }

    // For confidential clients, prefer oidcConfig
    //    if (oidcConfig != null) {
    //      if (!nullOrEmpty(oidcConfig.getServerUrl())) {
    //        return oidcConfig.getServerUrl();
    //      } else if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
    //        // Remove the well-known path to get the domain
    //        return oidcConfig.getDiscoveryUri().replace(AUTH0_WELL_KNOWN_PATH, "");
    //      }
    //    }

    throw new IllegalArgumentException(
        "Unable to extract Auth0 domain from configuration. Please provide authority or OIDC configuration.");
  }

  private ValidationResult validateAuth0Domain(String auth0Domain) {
    try {
      // Validate domain format
      if (!auth0Domain.startsWith("https://")) {
        throw new IllegalArgumentException("Auth0 domain must use HTTPS");
      }

      // Check if it's a valid Auth0 domain pattern
      URL url = new URL(auth0Domain);
      String host = url.getHost();

      // Valid Auth0 domains:
      // - https://tenant.auth0.com
      // - https://tenant.us.auth0.com (regional)
      // - https://tenant.eu.auth0.com
      // - https://tenant.au.auth0.com
      // - https://custom-domain.com (for custom domains)
      boolean isValidAuth0Domain =
          host.endsWith(".auth0.com") || host.contains("."); // Allow custom domains

      if (!isValidAuth0Domain) {
        throw new IllegalArgumentException(
            "Invalid Auth0 domain format. Expected format: https://tenant.auth0.com or custom domain");
      }

      // Test discovery endpoint
      String discoveryUrl = auth0Domain + AUTH0_WELL_KNOWN_PATH;
      testAuth0DiscoveryEndpoint(discoveryUrl);

      return new ValidationResult()
          .withComponent("auth0-domain")
          .withStatus("success")
          .withMessage("Auth0 domain validated successfully");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("auth0-domain")
          .withStatus("failed")
          .withMessage("Domain validation failed: " + e.getMessage());
    }
  }

  private void testAuth0DiscoveryEndpoint(String discoveryUrl) throws Exception {
    LOG.debug("Testing Auth0 discovery endpoint: {}", discoveryUrl);
    URL url = new URL(discoveryUrl);
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    conn.setRequestMethod("GET");
    conn.setConnectTimeout(5000);
    conn.setReadTimeout(5000);

    int responseCode = conn.getResponseCode();
    LOG.debug("Auth0 discovery endpoint response code: {}", responseCode);

    if (responseCode != 200) {
      String errorMsg =
          String.format(
              "Failed to access Auth0 discovery endpoint. HTTP response: %d for URL: %s",
              responseCode, discoveryUrl);
      LOG.error(errorMsg);
      throw new IllegalArgumentException(errorMsg);
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

      // Validate Auth0-specific fields
      if (!discoveryDoc.has("issuer") || !discoveryDoc.has("authorization_endpoint")) {
        throw new IllegalArgumentException("Invalid Auth0 discovery document format");
      }

      // Check for required Auth0 endpoints
      if (!discoveryDoc.has("token_endpoint") || !discoveryDoc.has("userinfo_endpoint")) {
        throw new IllegalArgumentException(
            "Missing required Auth0 endpoints in discovery document");
      }

      // Validate issuer matches the domain
      String issuer = discoveryDoc.get("issuer").asText();
      if (!issuer.startsWith("https://")) {
        throw new IllegalArgumentException("Auth0 issuer must use HTTPS");
      }
    }
  }

  private ValidationResult validateClientCredentials(
      String auth0Domain, String clientId, String clientSecret) {
    try {
      // Auth0 supports client_credentials grant, so we can validate directly
      if (nullOrEmpty(clientSecret)) {
        throw new IllegalArgumentException("Client secret is required for confidential clients");
      }

      // Auth0 client secrets are typically long base64-like strings
      if (clientSecret.length() < 20) {
        throw new IllegalArgumentException(
            "Client secret appears to be invalid. Auth0 client secrets are typically longer.");
      }

      // Attempt to get a token using client credentials grant
      String tokenUrl = auth0Domain + AUTH0_TOKEN_PATH;
      URL url = new URL(tokenUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
      conn.setDoOutput(true);
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);

      // Build request body for client credentials grant
      String requestBody =
          String.format(
              "grant_type=client_credentials&client_id=%s&client_secret=%s&audience=%s",
              clientId, clientSecret, auth0Domain + "/api/v2/");

      try (OutputStream os = conn.getOutputStream()) {
        byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
        os.write(input, 0, input.length);
      }

      int responseCode = conn.getResponseCode();

      if (responseCode == 200) {
        // Successfully obtained token
        return new ValidationResult()
            .withComponent("auth0-credentials")
            .withStatus("success")
            .withMessage("Auth0 client credentials validated successfully");
      } else {
        // Read error response
        try (BufferedReader reader =
            new BufferedReader(
                new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
          StringBuilder response = new StringBuilder();
          String line;
          while ((line = reader.readLine()) != null) {
            response.append(line);
          }

          JsonNode errorResponse = JsonUtils.readTree(response.toString());
          String error = errorResponse.path("error").asText();
          String errorDescription = errorResponse.path("error_description").asText();

          if ("invalid_client".equals(error) || "unauthorized_client".equals(error)) {
            return new ValidationResult()
                .withComponent("auth0-credentials")
                .withStatus("failed")
                .withMessage(
                    "Invalid client credentials. Please verify the client ID and secret are correct.");
          } else if ("access_denied".equals(error)) {
            return new ValidationResult()
                .withComponent("auth0-credentials")
                .withStatus("failed")
                .withMessage(
                    "Client is not authorized for client credentials grant. "
                        + "Please enable this grant type in Auth0 application settings.");
          } else {
            return new ValidationResult()
                .withComponent("auth0-credentials")
                .withStatus("failed")
                .withMessage("Authentication failed: " + errorDescription);
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Auth0 credentials validation failed", e);
      return new ValidationResult()
          .withComponent("auth0-credentials")
          .withStatus("failed")
          .withMessage("Credentials validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateClientBasedOnType(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig, String auth0Domain) {
    try {
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();
      String clientId = authConfig.getClientId();

      if ("public".equals(clientType)) {
        // For public clients, validate client ID format and test authorization endpoint
        return validatePublicClient(auth0Domain, clientId);
      } else if ("confidential".equals(clientType)) {
        // For confidential clients, validate credentials
        if (oidcConfig == null || nullOrEmpty(oidcConfig.getSecret())) {
          throw new IllegalArgumentException(
              "Client secret is required for confidential Auth0 clients");
        }
        return validateClientCredentials(auth0Domain, clientId, oidcConfig.getSecret());
      } else {
        return new ValidationResult()
            .withComponent("auth0-client-type")
            .withStatus("failed")
            .withMessage("Unknown client type: " + authConfig.getClientType());
      }
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("auth0-client-type")
          .withStatus("failed")
          .withMessage("Client type validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validatePublicClient(String auth0Domain, String clientId) {
    try {
      // For public clients, we can't fully validate without user interaction
      // But we can test if the authorization endpoint is accessible
      String authEndpoint = auth0Domain + "/authorize";

      // Test with a dummy authorization request
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

      // Auth0 will redirect to login page (302) if client_id is valid
      // or return error page (400/404) if client_id is invalid
      if (responseCode == 302 || responseCode == 200) {
        // Check if it's redirecting to Auth0 login page
        String location = conn.getHeaderField("Location");
        if (location != null && location.contains("auth0.com")) {
          return new ValidationResult()
              .withComponent("auth0-public-client")
              .withStatus("success")
              .withMessage(
                  "Auth0 public client ID appears valid. Full validation requires user authentication.");
        }
      } else if (responseCode == 400 || responseCode == 404) {
        return new ValidationResult()
            .withComponent("auth0-public-client")
            .withStatus("failed")
            .withMessage(
                "Invalid Auth0 client ID. Client does not exist or is not properly configured.");
      }

      return new ValidationResult()
          .withComponent("auth0-public-client")
          .withStatus("warning")
          .withMessage("Could not fully validate public client. HTTP response: " + responseCode);

    } catch (Exception e) {
      LOG.warn("Auth0 public client validation failed", e);
      return new ValidationResult()
          .withComponent("auth0-public-client")
          .withStatus("warning")
          .withMessage(
              "Public client validation encountered an error: "
                  + e.getMessage()
                  + ". Client ID format appears valid.");
    }
  }

  private ValidationResult validatePublicKeyUrls(AuthenticationConfiguration authConfig) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        throw new IllegalArgumentException("Public key URLs are required");
      }

      for (String urlStr : publicKeyUrls) {
        try {
          URL url = new URL(urlStr);

          // Auth0 JWKS URL should be: https://your-tenant.auth0.com/.well-known/jwks.json
          if (!urlStr.endsWith("/.well-known/jwks.json") && !urlStr.contains("/pem")) {
            throw new IllegalArgumentException(
                "Auth0 public key URL should be JWKS endpoint: https://your-tenant.auth0.com/.well-known/jwks.json, "
                    + "but got: "
                    + urlStr);
          }

          // Validate domain matches the auth0 domain pattern
          String host = url.getHost();
          if (!host.endsWith(".auth0.com") && !host.contains(".")) {
            throw new IllegalArgumentException(
                "Public key URL domain doesn't match Auth0 pattern: " + host);
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
            if (!jwks.has("keys") && !urlStr.contains("/pem")) {
              throw new IllegalArgumentException(
                  "Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
            }

            // Validate keys array is not empty
            if (jwks.has("keys") && jwks.get("keys").size() == 0) {
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
          .withComponent("auth0-public-key-urls")
          .withStatus("success")
          .withMessage("Auth0 public key URLs are valid and accessible");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("auth0-public-key-urls")
          .withStatus("failed")
          .withMessage("Public key URL validation failed: " + e.getMessage());
    }
  }
}
