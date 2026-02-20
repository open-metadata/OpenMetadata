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
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class CustomOidcValidator {

  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();

  public FieldError validateCustomOidcConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateCustomOidcPublicClient(authConfig, oidcConfig);
        case CONFIDENTIAL -> validateCustomOidcConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Custom OIDC validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "authenticationConfiguration", "Custom OIDC validation failed: " + e.getMessage());
    }
  }

  private FieldError validateCustomOidcPublicClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String discoveryUri = extractDiscoveryUri(authConfig, oidcConfig);
      if (nullOrEmpty(discoveryUri)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Discovery URI is required for custom OIDC validation. Provide either authority + /.well-known/openid-configuration or explicit discoveryUri");
      }

      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      DiscoveryEndpoints endpoints = extractEndpointsFromDiscovery(discoveryUri);
      if (endpoints == null) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Failed to extract required endpoints from discovery document");
      }

      FieldError jwksValidation = validateJwksEndpoint(endpoints.jwksUri, authConfig);
      if (jwksValidation != null) {
        return jwksValidation;
      }

      FieldError flowValidation = validateAuthorizationFlow(endpoints, authConfig);
      if (flowValidation != null) {
        return flowValidation;
      }

      return null; // Success - Custom OIDC public client validated

    } catch (Exception e) {
      LOG.error("Custom OIDC public client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "authenticationConfiguration",
          "Custom OIDC public client validation failed: " + e.getMessage());
    }
  }

  private FieldError validateCustomOidcConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String discoveryUri = extractDiscoveryUri(authConfig, oidcConfig);
      if (nullOrEmpty(discoveryUri)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Discovery URI is required for custom OIDC validation. Provide either oidcConfig.discoveryUri or authConfig.authority");
      }

      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      DiscoveryEndpoints endpoints = extractEndpointsFromDiscovery(discoveryUri);
      if (endpoints == null) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Failed to extract required endpoints from discovery document");
      }

      FieldError jwksValidation = validateJwksEndpoint(endpoints.jwksUri, authConfig);
      if (jwksValidation != null) {
        return jwksValidation;
      }

      if (nullOrEmpty(oidcConfig.getId())) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
            "Client ID is required for confidential clients");
      }
      if (nullOrEmpty(oidcConfig.getSecret())) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
            "Client Secret is required for confidential clients");
      }

      FieldError credentialsValidation =
          validateClientCredentialsWithTokenExchange(
              endpoints.tokenEndpoint, oidcConfig.getId(), oidcConfig.getSecret(), oidcConfig);

      if (credentialsValidation != null) {
        return credentialsValidation;
      }

      return null; // Success - Custom OIDC confidential client validated

    } catch (Exception e) {
      LOG.error("Custom OIDC confidential client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "authenticationConfiguration",
          "Custom OIDC confidential client validation failed: " + e.getMessage());
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

  private FieldError validateJwksEndpoint(String jwksUri, AuthenticationConfiguration authConfig) {
    try {
      // Check if JWKS URI is accessible
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(jwksUri);
      if (response.getStatusCode() != 200) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
            "JWKS endpoint is not accessible. HTTP status: " + response.getStatusCode());
      }

      // Validate it's a proper JWKS format
      JsonNode jwks = JsonUtils.readTree(response.getBody());
      if (!jwks.has("keys") || !jwks.get("keys").isArray() || jwks.get("keys").size() == 0) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
            "JWKS endpoint returned invalid or empty keys");
      }

      // Verify publicKeyUrls is configured and contains the JWKS URI
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      // Skip validation if publicKeyUrls is empty - it's auto-populated for confidential clients
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        LOG.debug(
            "publicKeyUrls is empty, skipping validation (auto-populated for confidential clients)");
        return null;
      }

      // Check if the JWKS URI from discovery is in publicKeyUrls
      boolean hasJwksUri = publicKeyUrls.stream().anyMatch(url -> url.equals(jwksUri));
      if (!hasJwksUri) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
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
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Public key URL is not accessible: "
                    + publicKeyUrl
                    + " (HTTP "
                    + publicKeyResponse.getStatusCode()
                    + ")");
          }

          // Verify it's a valid JWKS
          JsonNode publicKeyJwks = JsonUtils.readTree(publicKeyResponse.getBody());
          if (!publicKeyJwks.has("keys") || !publicKeyJwks.get("keys").isArray()) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Public key URL does not return valid JWKS format: " + publicKeyUrl);
          }
        } catch (Exception e) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
              "Failed to validate public key URL: " + publicKeyUrl + ". Error: " + e.getMessage());
        }
      }

      return null; // Success - JWKS endpoint is accessible and valid

    } catch (Exception e) {
      LOG.error("JWKS validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
          "JWKS validation failed: " + e.getMessage());
    }
  }

  private FieldError validateAuthorizationFlow(
      DiscoveryEndpoints endpoints, AuthenticationConfiguration authConfig) {
    try {
      // For public clients, verify authorization endpoint exists
      if (nullOrEmpty(endpoints.authorizationEndpoint)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Authorization endpoint is required for public clients");
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
        return null; // Success - Authorization flow is properly configured
      } else if (response.getStatusCode() == 400 || response.getStatusCode() == 401) {
        // Client ID might be invalid
        // Warning - treat as success
        LOG.warn(
            "Authorization endpoint responded with error. Client ID may be invalid or not configured properly.");
        return null;
      } else {
        // Warning - treat as success
        LOG.warn("Unexpected response from authorization endpoint: {}", response.getStatusCode());
        return null;
      }

    } catch (Exception e) {
      LOG.warn("Authorization flow validation encountered an error", e);
      // Warning - treat as success
      LOG.warn("Could not fully validate authorization flow: {}", e.getMessage());
      return null;
    }
  }

  private FieldError validateClientCredentialsWithTokenExchange(
      String tokenEndpoint, String clientId, String clientSecret, OidcClientConfig oidcConfig) {
    try {
      if (nullOrEmpty(clientId) || nullOrEmpty(clientSecret)) {
        if (nullOrEmpty(clientId)) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
              "Client ID is required for confidential clients");
        }
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
            "Client Secret is required for confidential clients");
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
            return null; // Success - Client credentials validated via token exchange
          } else {
            // Warning - treat as success
            LOG.warn("Token endpoint returned 200 but no access_token found in response");
            return null;
          }
        } catch (Exception e) {
          // Warning - treat as success
          LOG.warn("Token endpoint returned 200 but response was not valid JSON");
          return null;
        }
      } else if (statusCode == 401 || statusCode == 403) {
        // Authentication failed - make this lenient (warning instead of failure)
        String errorDetail = extractErrorFromResponse(responseBody);

        // 401/403 could mean either invalid credentials OR provider not configured for
        // client_credentials
        LOG.warn("Client authentication failed with status {}. Error: {}", statusCode, errorDetail);
        // Warning - treat as success
        LOG.warn(
            "Client credentials could not be validated via token exchange. Status: {}. {}",
            statusCode,
            errorDetail);
        return null;
      } else if (statusCode == 400) {
        // Bad request - could be unsupported grant type or scope issue
        String errorDetail = extractErrorFromResponse(responseBody);

        if (errorDetail.contains("unsupported_grant_type")) {
          // Provider doesn't support client_credentials - make lenient
          LOG.warn("Client credentials grant type not supported. Error: {}", errorDetail);
          // Warning - treat as success
          LOG.warn(
              "Client credentials grant type is not supported by the provider. {}", errorDetail);
          return null;
        }

        if (errorDetail.contains("invalid_scope") || errorDetail.contains("scope")) {
          // Try without scope parameter as some providers don't accept it
          LOG.info("Retrying without scope parameter");
          return attemptTokenExchangeWithoutScope(
              tokenEndpoint, clientId, clientSecret, oidcConfig);
        }

        // All other 400 errors - make lenient as it could be provider configuration
        LOG.warn("Token exchange failed with 400. Error: {}", errorDetail);
        // Warning - treat as success
        LOG.warn("Client credentials validation encountered issues. {}", errorDetail);
        return null;
      } else {
        // Unexpected status code - make lenient as it could be provider-specific behavior
        // Warning - treat as success
        LOG.warn(
            "Client credentials validation could not be completed. Unexpected response: {}",
            statusCode);
        return null;
      }

    } catch (Exception e) {
      LOG.warn("Client credentials validation encountered an error", e);
      // Warning - treat as success
      LOG.warn("Could not complete token exchange validation: {}", e.getMessage());
      return null;
    }
  }

  private FieldError attemptTokenExchangeWithoutScope(
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
            return null; // Success - Client credentials validated via token exchange without scope
          }
        } catch (Exception e) {
          LOG.debug("Failed to parse token response", e);
        }
      } else if (statusCode == 401 || statusCode == 403) {
        String errorDetail = extractErrorFromResponse(responseBody);

        // Authentication failed - make lenient
        // Warning - treat as success
        LOG.warn("Client authentication could not be verified. {}", errorDetail);
        return null;
      }

      // Any other response - make lenient
      // Warning - treat as success
      LOG.warn(
          "Client credentials validation could not be completed. Unable to obtain access token.");
      return null;

    } catch (Exception e) {
      LOG.warn("Token exchange without scope failed", e);
      // Warning - treat as success
      LOG.warn("Token exchange validation error: {}", e.getMessage());
      return null;
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
