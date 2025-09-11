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
public class Auth0Validator {

  private static final String AUTH0_WELL_KNOWN_PATH = "/.well-known/openid-configuration";
  private static final String AUTH0_TOKEN_PATH = "/oauth/token";

  public ValidationResult validateAuth0Configuration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateAuth0PublicClient(authConfig);
        case CONFIDENTIAL -> validateAuth0ConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Auth0 validation failed", e);
      return new ValidationResult()
          .withComponent("auth0")
          .withStatus("failed")
          .withMessage("Auth0 validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateAuth0PublicClient(AuthenticationConfiguration authConfig) {
    try {
      String authority = authConfig.getAuthority();
      ValidationResult domainValidation = validateAuth0Domain(authority);
      if ("failed".equals(domainValidation.getStatus())) {
        return domainValidation;
      }
      ValidationResult clientIdValidation =
          validatePublicClientId(authority, authConfig.getClientId());
      if ("failed".equals(clientIdValidation.getStatus())) {
        return clientIdValidation;
      }

      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig, authority);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      return new ValidationResult()
          .withComponent("auth0-public")
          .withStatus("success")
          .withMessage(
              "Auth0 public client validated successfully. Authority, client ID, and public key URLs are valid.");
    } catch (Exception e) {
      LOG.error("Auth0 public client validation failed", e);
      return new ValidationResult()
          .withComponent("auth0-public")
          .withStatus("failed")
          .withMessage("Auth0 public client validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateAuth0ConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String auth0Domain = extractAuth0DomainFromOidcConfig(oidcConfig);
      ValidationResult domainValidation = validateAuth0Domain(auth0Domain);
      if ("failed".equals(domainValidation.getStatus())) {
        return domainValidation;
      }

      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig, auth0Domain);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      ValidationResult credentialsValidation =
          validateClientCredentials(auth0Domain, oidcConfig.getId(), oidcConfig.getSecret());
      if ("failed".equals(credentialsValidation.getStatus())) {
        return credentialsValidation;
      }

      return new ValidationResult()
          .withComponent("auth0-confidential")
          .withStatus("success")
          .withMessage(
              "Auth0 confidential client validated successfully. Discovery URI, client ID, public key URLs, and secret are valid.");
    } catch (Exception e) {
      LOG.error("Auth0 confidential client validation failed", e);
      return new ValidationResult()
          .withComponent("auth0-confidential")
          .withStatus("failed")
          .withMessage("Auth0 confidential client validation failed: " + e.getMessage());
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

  private ValidationResult validateAuth0Domain(String auth0Domain) {
    try {
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

  private ValidationResult validateClientCredentials(
      String auth0Domain, String clientId, String clientSecret) {
    try {
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
        return new ValidationResult()
            .withComponent("auth0-credentials")
            .withStatus("success")
            .withMessage("Auth0 client credentials validated successfully");
      } else {
        // Parse error response
        try {
          JsonNode errorResponse = JsonUtils.readTree(response.getBody());
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
        } catch (Exception parseError) {
          return new ValidationResult()
              .withComponent("auth0-credentials")
              .withStatus("failed")
              .withMessage("Credentials validation failed. HTTP response: " + responseCode);
        }
      }
    } catch (Exception e) {
      LOG.warn("Auth0 credentials validation encountered an error", e);
      return new ValidationResult()
          .withComponent("auth0-credentials")
          .withStatus("warning")
          .withMessage(
              "Could not fully validate credentials: "
                  + e.getMessage()
                  + ". Credentials format appears valid.");
    }
  }

  private ValidationResult validatePublicClientId(String auth0Domain, String clientId) {
    return validateClientIdViaAuthorizationEndpoint(
        auth0Domain, clientId, "auth0-public-client-id", "public");
  }

  private ValidationResult validateClientIdViaAuthorizationEndpoint(
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
        return new ValidationResult()
            .withComponent(componentName)
            .withStatus("success")
            .withMessage(
                "Auth0 "
                    + clientTypeDesc
                    + "client ID validated successfully via authorization endpoint");
      } else if (responseCode == 400 || responseCode == 404) {
        return new ValidationResult()
            .withComponent(componentName)
            .withStatus("failed")
            .withMessage(
                "Invalid Auth0 client ID. Client does not exist or is not properly configured.");
      } else {
        return new ValidationResult()
            .withComponent(componentName)
            .withStatus("warning")
            .withMessage("Could not fully validate client ID. HTTP response: " + responseCode);
      }

    } catch (Exception e) {
      return new ValidationResult()
          .withComponent(componentName)
          .withStatus("warning")
          .withMessage(
              "Client ID validation failed: " + e.getMessage() + ". Format appears valid.");
    }
  }

  private ValidationResult validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, String auth0Domain) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        return new ValidationResult()
            .withComponent("auth0-public-key-urls")
            .withStatus("failed")
            .withMessage("Public key URLs are required for Auth0 clients");
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
        return new ValidationResult()
            .withComponent("auth0-public-key-urls")
            .withStatus("failed")
            .withMessage(
                "At least one public key URL must be the Auth0 JWKS endpoint: " + expectedJwksUrl);
      }

      for (String urlStr : publicKeyUrls) {
        try {
          URL url = new URL(urlStr);

          String host = url.getHost();
          if (!host.endsWith(".auth0.com") && !host.contains(".")) {
            return new ValidationResult()
                .withComponent("auth0-public-key-urls")
                .withStatus("failed")
                .withMessage("Public key URL domain doesn't match Auth0 pattern: " + host);
          }

          ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(urlStr);

          if (response.getStatusCode() != 200) {
            return new ValidationResult()
                .withComponent("auth0-public-key-urls")
                .withStatus("failed")
                .withMessage(
                    "Public key URL is not accessible. HTTP response: "
                        + response.getStatusCode()
                        + " for URL: "
                        + urlStr);
          }
          JsonNode jwks = JsonUtils.readTree(response.getBody());
          if (!jwks.has("keys") && !urlStr.contains("/pem")) {
            return new ValidationResult()
                .withComponent("auth0-public-key-urls")
                .withStatus("failed")
                .withMessage("Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
          }
          if (jwks.has("keys") && jwks.get("keys").size() == 0) {
            return new ValidationResult()
                .withComponent("auth0-public-key-urls")
                .withStatus("failed")
                .withMessage("JWKS endpoint returned empty keys array: " + urlStr);
          }

        } catch (Exception e) {
          return new ValidationResult()
              .withComponent("auth0-public-key-urls")
              .withStatus("failed")
              .withMessage("Invalid public key URL '" + urlStr + "': " + e.getMessage());
        }
      }

      return new ValidationResult()
          .withComponent("auth0-public-key-urls")
          .withStatus("success")
          .withMessage(
              "Auth0 public key URLs are valid and accessible. Found expected JWKS endpoint: "
                  + expectedJwksUrl);
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("auth0-public-key-urls")
          .withStatus("failed")
          .withMessage("Public key URL validation failed: " + e.getMessage());
    }
  }
}
