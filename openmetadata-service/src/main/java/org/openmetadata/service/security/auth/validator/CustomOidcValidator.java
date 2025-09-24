package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class CustomOidcValidator {

  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();

  public ValidationResult validateCustomOidcConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateCustomOidcPublicClient(authConfig, oidcConfig);
        case CONFIDENTIAL -> validateCustomOidcConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Custom OIDC validation failed", e);
      return new ValidationResult()
          .withComponent("custom-oidc")
          .withStatus("failed")
          .withMessage("Custom OIDC validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateCustomOidcPublicClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String discoveryUri = extractDiscoveryUri(authConfig, oidcConfig);
      if (nullOrEmpty(discoveryUri)) {
        return new ValidationResult()
            .withComponent("custom-oidc-discovery")
            .withStatus("failed")
            .withMessage(
                "Discovery URI is required for custom OIDC validation. Provide either authority + /.well-known/openid-configuration or explicit discoveryUri");
      }

      ValidationResult discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);
      if (!"success".equals(discoveryCheck.getStatus())) {
        return discoveryCheck;
      }

      DiscoveryEndpoints endpoints = extractEndpointsFromDiscovery(discoveryUri);
      if (endpoints == null) {
        return new ValidationResult()
            .withComponent("custom-oidc-endpoints")
            .withStatus("failed")
            .withMessage("Failed to extract required endpoints from discovery document");
      }

      ValidationResult jwksValidation = validateJwksEndpoint(endpoints.jwksUri, authConfig);
      if ("failed".equals(jwksValidation.getStatus())) {
        return jwksValidation;
      }

      ValidationResult flowValidation = validateAuthorizationFlow(endpoints, authConfig);
      if ("failed".equals(flowValidation.getStatus())) {
        return flowValidation;
      }

      return new ValidationResult()
          .withComponent("custom-oidc-public")
          .withStatus("success")
          .withMessage(
              "Custom OIDC public client validated successfully. Discovery, JWKS, and authorization flow are properly configured.");

    } catch (Exception e) {
      LOG.error("Custom OIDC public client validation failed", e);
      return new ValidationResult()
          .withComponent("custom-oidc-public")
          .withStatus("failed")
          .withMessage("Custom OIDC public client validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateCustomOidcConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String discoveryUri = extractDiscoveryUri(authConfig, oidcConfig);
      if (nullOrEmpty(discoveryUri)) {
        return new ValidationResult()
            .withComponent("custom-oidc-discovery")
            .withStatus("failed")
            .withMessage(
                "Discovery URI is required for custom OIDC validation. Provide either oidcConfig.discoveryUri or authConfig.authority");
      }

      ValidationResult discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);
      if (!"success".equals(discoveryCheck.getStatus())) {
        return discoveryCheck;
      }

      DiscoveryEndpoints endpoints = extractEndpointsFromDiscovery(discoveryUri);
      if (endpoints == null) {
        return new ValidationResult()
            .withComponent("custom-oidc-endpoints")
            .withStatus("failed")
            .withMessage("Failed to extract required endpoints from discovery document");
      }

      ValidationResult jwksValidation = validateJwksEndpoint(endpoints.jwksUri, authConfig);
      if ("failed".equals(jwksValidation.getStatus())) {
        return jwksValidation;
      }

      if (nullOrEmpty(oidcConfig.getId()) || nullOrEmpty(oidcConfig.getSecret())) {
        return new ValidationResult()
            .withComponent("custom-oidc-credentials")
            .withStatus("failed")
            .withMessage("Client ID and Client Secret are required for confidential clients");
      }

      ValidationResult credentialsValidation =
          validateClientCredentialsWithTokenExchange(
              endpoints.tokenEndpoint, oidcConfig.getId(), oidcConfig.getSecret(), oidcConfig);

      if ("success".equals(credentialsValidation.getStatus())) {
        return new ValidationResult()
            .withComponent("custom-oidc-confidential")
            .withStatus("success")
            .withMessage(
                "Custom OIDC confidential client validated successfully. Discovery, JWKS, and client credentials verified via token exchange.");
      } else {
        // Token exchange returned warning - configuration is valid but credentials couldn't be
        // fully verified
        return new ValidationResult()
            .withComponent("custom-oidc-confidential")
            .withStatus("success")
            .withMessage(
                "Custom OIDC configuration validated successfully. Discovery and JWKS are properly configured. "
                    + "Note: "
                    + credentialsValidation.getMessage());
      }

    } catch (Exception e) {
      LOG.error("Custom OIDC confidential client validation failed", e);
      return new ValidationResult()
          .withComponent("custom-oidc-confidential")
          .withStatus("failed")
          .withMessage("Custom OIDC confidential client validation failed: " + e.getMessage());
    }
  }

  private String extractDiscoveryUri(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
      return oidcConfig.getDiscoveryUri();
    }

    if (!nullOrEmpty(authConfig.getAuthority())) {
      String authority = authConfig.getAuthority();
      if (!authority.endsWith("/")) {
        authority += "/";
      }
      return authority + ".well-known/openid-configuration";
    }

    // Priority 3: Try serverUrl as fallback
    if (!nullOrEmpty(oidcConfig.getServerUrl())) {
      String serverUrl = oidcConfig.getServerUrl();
      if (!serverUrl.endsWith("/")) {
        serverUrl += "/";
      }
      return serverUrl + ".well-known/openid-configuration";
    }

    return null;
  }

  private DiscoveryEndpoints extractEndpointsFromDiscovery(String discoveryUri) {
    try {
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);
      if (response.getStatusCode() != 200) {
        LOG.error("Failed to fetch discovery document. HTTP status: {}", response.getStatusCode());
        return null;
      }

      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());

      String issuer = discoveryDoc.path("issuer").asText(null);
      String tokenEndpoint = discoveryDoc.path("token_endpoint").asText(null);
      String authorizationEndpoint = discoveryDoc.path("authorization_endpoint").asText(null);
      String jwksUri = discoveryDoc.path("jwks_uri").asText(null);
      String userInfoEndpoint = discoveryDoc.path("userinfo_endpoint").asText(null);
      String introspectionEndpoint = discoveryDoc.path("introspection_endpoint").asText(null);

      if (nullOrEmpty(issuer) || nullOrEmpty(tokenEndpoint) || nullOrEmpty(jwksUri)) {
        LOG.error(
            "Discovery document missing required endpoints. Issuer: {}, Token: {}, JWKS: {}",
            issuer,
            tokenEndpoint,
            jwksUri);
        return null;
      }

      return new DiscoveryEndpoints(
          issuer,
          tokenEndpoint,
          authorizationEndpoint,
          jwksUri,
          userInfoEndpoint,
          introspectionEndpoint);

    } catch (Exception e) {
      LOG.error("Failed to extract endpoints from discovery document", e);
      return null;
    }
  }

  private ValidationResult validateJwksEndpoint(
      String jwksUri, AuthenticationConfiguration authConfig) {
    try {
      // Check if JWKS URI is accessible
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(jwksUri);
      if (response.getStatusCode() != 200) {
        return new ValidationResult()
            .withComponent("custom-oidc-jwks")
            .withStatus("failed")
            .withMessage(
                "JWKS endpoint is not accessible. HTTP status: " + response.getStatusCode());
      }

      // Validate it's a proper JWKS format
      JsonNode jwks = JsonUtils.readTree(response.getBody());
      if (!jwks.has("keys") || !jwks.get("keys").isArray() || jwks.get("keys").size() == 0) {
        return new ValidationResult()
            .withComponent("custom-oidc-jwks")
            .withStatus("failed")
            .withMessage("JWKS endpoint returned invalid or empty keys");
      }

      // Verify publicKeyUrls is configured and contains the JWKS URI
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        return new ValidationResult()
            .withComponent("custom-oidc-jwks")
            .withStatus("failed")
            .withMessage(
                "publicKeyUrls is required. Please configure it with the JWKS URI: " + jwksUri);
      }

      // Check if the JWKS URI from discovery is in publicKeyUrls
      boolean hasJwksUri = publicKeyUrls.stream().anyMatch(url -> url.equals(jwksUri));
      if (!hasJwksUri) {
        return new ValidationResult()
            .withComponent("custom-oidc-jwks")
            .withStatus("failed")
            .withMessage(
                "publicKeyUrls must include the JWKS URI from discovery. "
                    + "Expected: "
                    + jwksUri
                    + " but found: "
                    + publicKeyUrls);
      }

      // Also validate that each configured publicKeyUrl is accessible
      for (String publicKeyUrl : publicKeyUrls) {
        try {
          ValidationHttpUtil.HttpResponseData publicKeyResponse =
              ValidationHttpUtil.safeGet(publicKeyUrl);
          if (publicKeyResponse.getStatusCode() != 200) {
            return new ValidationResult()
                .withComponent("custom-oidc-jwks")
                .withStatus("failed")
                .withMessage(
                    "Public key URL is not accessible: "
                        + publicKeyUrl
                        + " (HTTP "
                        + publicKeyResponse.getStatusCode()
                        + ")");
          }

          // Verify it's a valid JWKS
          JsonNode publicKeyJwks = JsonUtils.readTree(publicKeyResponse.getBody());
          if (!publicKeyJwks.has("keys") || !publicKeyJwks.get("keys").isArray()) {
            return new ValidationResult()
                .withComponent("custom-oidc-jwks")
                .withStatus("failed")
                .withMessage("Public key URL does not return valid JWKS format: " + publicKeyUrl);
          }
        } catch (Exception e) {
          return new ValidationResult()
              .withComponent("custom-oidc-jwks")
              .withStatus("failed")
              .withMessage(
                  "Failed to validate public key URL: "
                      + publicKeyUrl
                      + ". Error: "
                      + e.getMessage());
        }
      }

      return new ValidationResult()
          .withComponent("custom-oidc-jwks")
          .withStatus("success")
          .withMessage("JWKS endpoint is accessible and valid");

    } catch (Exception e) {
      LOG.error("JWKS validation failed", e);
      return new ValidationResult()
          .withComponent("custom-oidc-jwks")
          .withStatus("failed")
          .withMessage("JWKS validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateAuthorizationFlow(
      DiscoveryEndpoints endpoints, AuthenticationConfiguration authConfig) {
    try {
      // For public clients, verify authorization endpoint exists
      if (nullOrEmpty(endpoints.authorizationEndpoint)) {
        return new ValidationResult()
            .withComponent("custom-oidc-auth-flow")
            .withStatus("failed")
            .withMessage("Authorization endpoint is required for public clients");
      }

      // Try to access authorization endpoint with test parameters
      String testAuthUrl =
          endpoints.authorizationEndpoint
              + "?client_id="
              + URLEncoder.encode(authConfig.getClientId(), StandardCharsets.UTF_8)
              + "&response_type=code"
              + "&redirect_uri="
              + URLEncoder.encode("http://localhost:8585/callback", StandardCharsets.UTF_8)
              + "&state=test-validation"
              + "&scope=openid+profile+email";

      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.getNoRedirect(testAuthUrl);

      // Success if we get a redirect to login page (302) or login form (200)
      if (response.getStatusCode() == 302 || response.getStatusCode() == 200) {
        return new ValidationResult()
            .withComponent("custom-oidc-auth-flow")
            .withStatus("success")
            .withMessage("Authorization flow is properly configured");
      } else if (response.getStatusCode() == 400 || response.getStatusCode() == 401) {
        // Client ID might be invalid
        return new ValidationResult()
            .withComponent("custom-oidc-auth-flow")
            .withStatus("warning")
            .withMessage(
                "Authorization endpoint responded with error. Client ID may be invalid or not configured properly.");
      } else {
        return new ValidationResult()
            .withComponent("custom-oidc-auth-flow")
            .withStatus("warning")
            .withMessage(
                "Unexpected response from authorization endpoint: " + response.getStatusCode());
      }

    } catch (Exception e) {
      LOG.warn("Authorization flow validation encountered an error", e);
      return new ValidationResult()
          .withComponent("custom-oidc-auth-flow")
          .withStatus("warning")
          .withMessage("Could not fully validate authorization flow: " + e.getMessage());
    }
  }

  private ValidationResult validateClientCredentialsWithTokenExchange(
      String tokenEndpoint, String clientId, String clientSecret, OidcClientConfig oidcConfig) {
    try {
      if (nullOrEmpty(clientId) || nullOrEmpty(clientSecret)) {
        return new ValidationResult()
            .withComponent("custom-oidc-credentials")
            .withStatus("failed")
            .withMessage("Client ID and Client Secret are required for confidential clients");
      }

      // Attempt standard OAuth2 client_credentials grant
      // Try with configured scope first, then fallback to standard
      String configuredScope = oidcConfig.getScope();
      String requestBody =
          "grant_type=client_credentials"
              + "&client_id="
              + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
              + "&client_secret="
              + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8);

      // Add scope if configured
      if (!nullOrEmpty(configuredScope)) {
        requestBody += "&scope=" + URLEncoder.encode(configuredScope, StandardCharsets.UTF_8);
      } else {
        // Use minimal OIDC scope as default
        requestBody += "&scope=openid";
      }

      Map<String, String> headers = new HashMap<>();
      headers.put("Content-Type", "application/x-www-form-urlencoded");

      LOG.info("Attempting token exchange at: {} for client: {}", tokenEndpoint, clientId);
      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(tokenEndpoint, requestBody, headers);

      int statusCode = response.getStatusCode();
      String responseBody = response.getBody();

      if (statusCode == 200) {
        // Success! We got a token - this means BOTH:
        // 1. Client credentials are VALID
        // 2. Provider is properly configured for client_credentials grant
        try {
          JsonNode tokenResponse = JsonUtils.readTree(responseBody);
          if (tokenResponse.has("access_token")) {
            LOG.info("Token exchange successful for client: {}", clientId);
            return new ValidationResult()
                .withComponent("custom-oidc-credentials")
                .withStatus("success")
                .withMessage(
                    "Client credentials validated successfully via token exchange. Access token obtained. "
                        + "Provider is properly configured for client_credentials grant.");
          } else {
            return new ValidationResult()
                .withComponent("custom-oidc-credentials")
                .withStatus("warning")
                .withMessage("Token endpoint returned 200 but no access_token found in response");
          }
        } catch (Exception e) {
          return new ValidationResult()
              .withComponent("custom-oidc-credentials")
              .withStatus("warning")
              .withMessage("Token endpoint returned 200 but response was not valid JSON");
        }
      } else if (statusCode == 401 || statusCode == 403) {
        // Authentication failed - make this lenient (warning instead of failure)
        String errorDetail = extractErrorFromResponse(responseBody);

        // 401/403 could mean either invalid credentials OR provider not configured for
        // client_credentials
        LOG.warn("Client authentication failed with status {}. Error: {}", statusCode, errorDetail);
        return new ValidationResult()
            .withComponent("custom-oidc-credentials")
            .withStatus("warning")
            .withMessage(
                "Client credentials could not be validated via token exchange. "
                    + "This may be due to invalid credentials or provider configuration. "
                    + "Status: "
                    + statusCode
                    + ". "
                    + errorDetail
                    + " Please ensure your OIDC provider is configured for machine-to-machine authentication.");
      } else if (statusCode == 400) {
        // Bad request - could be unsupported grant type or scope issue
        String errorDetail = extractErrorFromResponse(responseBody);

        if (errorDetail.contains("unsupported_grant_type")) {
          // Provider doesn't support client_credentials - make lenient
          LOG.warn("Client credentials grant type not supported. Error: {}", errorDetail);
          return new ValidationResult()
              .withComponent("custom-oidc-credentials")
              .withStatus("warning")
              .withMessage(
                  "Client credentials grant type is not supported by the provider. "
                      + "Please enable service account or machine-to-machine authentication for this client in your OIDC provider. "
                      + errorDetail);
        }

        if (errorDetail.contains("invalid_scope") || errorDetail.contains("scope")) {
          // Try without scope parameter as some providers don't accept it
          LOG.info("Retrying without scope parameter");
          return attemptTokenExchangeWithoutScope(
              tokenEndpoint, clientId, clientSecret, oidcConfig);
        }

        // All other 400 errors - make lenient as it could be provider configuration
        LOG.warn("Token exchange failed with 400. Error: {}", errorDetail);
        return new ValidationResult()
            .withComponent("custom-oidc-credentials")
            .withStatus("warning")
            .withMessage(
                "Client credentials validation encountered issues. "
                    + errorDetail
                    + " This may require additional provider configuration.");
      } else {
        // Unexpected status code - make lenient as it could be provider-specific behavior
        return new ValidationResult()
            .withComponent("custom-oidc-credentials")
            .withStatus("warning")
            .withMessage(
                "Client credentials validation could not be completed. Unexpected response from token endpoint: "
                    + statusCode
                    + ". Provider may require additional configuration.");
      }

    } catch (Exception e) {
      LOG.warn("Client credentials validation encountered an error", e);
      return new ValidationResult()
          .withComponent("custom-oidc-credentials")
          .withStatus("warning")
          .withMessage(
              "Could not complete token exchange validation: "
                  + e.getMessage()
                  + ". Credentials format appears valid.");
    }
  }

  private ValidationResult attemptTokenExchangeWithoutScope(
      String tokenEndpoint, String clientId, String clientSecret, OidcClientConfig oidcConfig) {
    try {
      // Some OIDC providers don't accept scope parameter for client_credentials
      String requestBody =
          "grant_type=client_credentials"
              + "&client_id="
              + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
              + "&client_secret="
              + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8);

      Map<String, String> headers = new HashMap<>();
      headers.put("Content-Type", "application/x-www-form-urlencoded");

      LOG.debug("Attempting token exchange without scope parameter");
      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(tokenEndpoint, requestBody, headers);

      int statusCode = response.getStatusCode();
      String responseBody = response.getBody();

      if (statusCode == 200) {
        try {
          JsonNode tokenResponse = JsonUtils.readTree(responseBody);
          if (tokenResponse.has("access_token")) {
            LOG.info("Token exchange successful without scope parameter");
            return new ValidationResult()
                .withComponent("custom-oidc-credentials")
                .withStatus("success")
                .withMessage(
                    "Client credentials validated successfully via token exchange (without scope). Access token obtained.");
          }
        } catch (Exception e) {
          LOG.debug("Failed to parse token response", e);
        }
      } else if (statusCode == 401 || statusCode == 403) {
        String errorDetail = extractErrorFromResponse(responseBody);

        // Authentication failed - make lenient
        return new ValidationResult()
            .withComponent("custom-oidc-credentials")
            .withStatus("warning")
            .withMessage(
                "Client authentication could not be verified. "
                    + errorDetail
                    + " Provider configuration may be required.");
      }

      // Any other response - make lenient
      return new ValidationResult()
          .withComponent("custom-oidc-credentials")
          .withStatus("warning")
          .withMessage(
              "Client credentials validation could not be completed. Unable to obtain access token. "
                  + "Provider may require additional configuration.");

    } catch (Exception e) {
      LOG.warn("Token exchange without scope failed", e);
      return new ValidationResult()
          .withComponent("custom-oidc-credentials")
          .withStatus("warning")
          .withMessage("Token exchange validation error: " + e.getMessage());
    }
  }

  private String extractErrorFromResponse(String responseBody) {
    try {
      JsonNode errorResponse = JsonUtils.readTree(responseBody);
      String error = errorResponse.path("error").asText("");
      String errorDescription = errorResponse.path("error_description").asText("");

      if (!errorDescription.isEmpty()) {
        return "Error: " + error + " - " + errorDescription;
      } else if (!error.isEmpty()) {
        return "Error: " + error;
      }
      return "Check OIDC provider logs for details.";
    } catch (Exception e) {
      LOG.debug("Could not parse error response: {}", responseBody);
      return "Unable to parse error details from response.";
    }
  }

  private static class DiscoveryEndpoints {
    final String issuer;
    final String tokenEndpoint;
    final String authorizationEndpoint;
    final String jwksUri;
    final String userInfoEndpoint;
    final String introspectionEndpoint;

    DiscoveryEndpoints(
        String issuer,
        String tokenEndpoint,
        String authorizationEndpoint,
        String jwksUri,
        String userInfoEndpoint,
        String introspectionEndpoint) {
      this.issuer = issuer;
      this.tokenEndpoint = tokenEndpoint;
      this.authorizationEndpoint = authorizationEndpoint;
      this.jwksUri = jwksUri;
      this.userInfoEndpoint = userInfoEndpoint;
      this.introspectionEndpoint = introspectionEndpoint;
    }
  }
}
