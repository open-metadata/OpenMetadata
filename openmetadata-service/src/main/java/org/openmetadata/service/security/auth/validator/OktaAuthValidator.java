package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
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
public class OktaAuthValidator {

  private static final String OKTA_WELL_KNOWN_PATH = "/.well-known/openid-configuration";
  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();

  public FieldError validateOktaConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();

      if ("public".equals(clientType)) {
        return validateOktaPublicClient(authConfig);
      } else if ("confidential".equals(clientType)) {
        return validateOktaConfidentialClient(authConfig, oidcConfig);
      } else {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_TYPE,
            "Unknown client type: "
                + authConfig.getClientType()
                + ". Must be 'public' or 'confidential'.");
      }
    } catch (Exception e) {
      LOG.error("Okta validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "authenticationConfiguration", "Okta validation failed: " + e.getMessage());
    }
  }

  private FieldError validateOktaPublicClient(AuthenticationConfiguration authConfig) {
    try {
      String oktaDomain = authConfig.getAuthority();
      FieldError domainValidation =
          validateOktaDomain(oktaDomain, ValidationErrorBuilder.FieldPaths.AUTH_AUTHORITY);
      if (domainValidation != null) {
        return domainValidation;
      }

      // Validate against OIDC discovery document for public clients too
      String discoveryUri = oktaDomain + OKTA_WELL_KNOWN_PATH;
      OidcClientConfig publicClientConfig =
          new OidcClientConfig().withId(authConfig.getClientId()).withDiscoveryUri(discoveryUri);

      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, publicClientConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      FieldError clientIdValidation = validatePublicClientId(oktaDomain, authConfig.getClientId());
      if (clientIdValidation != null) {
        return clientIdValidation;
      }

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, oktaDomain);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      return null; // Success - Okta public client validated
    } catch (Exception e) {
      LOG.error("Okta public client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "authenticationConfiguration", "Okta public client validation failed: " + e.getMessage());
    }
  }

  private FieldError validateOktaConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {

      // Step 1: Extract and validate Okta domain from oidcConfig
      String oktaDomain = extractOktaDomainFromOidcConfig(oidcConfig);

      // Step 2: Validate domain accessibility
      FieldError domainValidation =
          validateOktaDomain(oktaDomain, ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI);
      if (domainValidation != null) {
        return domainValidation;
      }

      // Step 3: Validate against OIDC discovery document (scopes, response types, etc.)
      //   String discoveryUri = oktaDomain + OKTA_WELL_KNOWN_PATH;
      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(
              oidcConfig.getDiscoveryUri(), authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      // Step 4: Validate public key URLs (required for JWT signature verification)
      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, oktaDomain);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      // Step 5: Validate client credentials (secret)
      String clientId = oidcConfig.getId();
      FieldError credentialsValidation =
          validateClientCredentials(oktaDomain, clientId, oidcConfig.getSecret());
      if (credentialsValidation != null) {
        return credentialsValidation;
      }

      return null; // Success - Okta confidential client validated
    } catch (Exception e) {
      LOG.error("Okta confidential client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "authenticationConfiguration",
          "Okta confidential client validation failed: " + e.getMessage());
    }
  }

  private String extractOktaDomainFromOidcConfig(OidcClientConfig oidcConfig) {
    if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
      String domain = oidcConfig.getDiscoveryUri().replace(OKTA_WELL_KNOWN_PATH, "");
      LOG.debug(
          "Extracted Okta domain from discoveryUri: {} -> {}",
          oidcConfig.getDiscoveryUri(),
          domain);
      return domain;
    }
    LOG.error(
        "Failed to extract Okta domain. discoveryUri: {}, serverUrl: {}",
        oidcConfig.getDiscoveryUri(),
        oidcConfig.getServerUrl());
    throw new IllegalArgumentException(
        "Unable to extract Okta domain from OIDC configuration. Please provide a valid discoveryUri");
  }

  private FieldError validatePublicClientId(String oktaDomain, String clientId) {
    return validateClientIdViaIntrospection(
        oktaDomain, clientId, "okta-public-client-id", "public");
  }

  private FieldError validateClientIdViaIntrospection(
      String oktaDomain, String clientId, String componentName, String clientType) {
    try {
      String introspectUrl = oktaDomain + "/v1/introspect";
      String requestBody =
          "token=dummy_invalid_token&token_type_hint=access_token&client_id=" + clientId;

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(introspectUrl, requestBody);

      // Introspection endpoint responses:
      // - 200 = client ID is valid (should return {"active": false} for dummy token)
      // - Any other status = validation failed
      if (response.getStatusCode() == 200) {
        // Verify response contains expected introspection format
        JsonNode result = JsonUtils.readTree(response.getBody());
        if (result.has("active")) {
          String clientTypeDesc = clientType.isEmpty() ? "" : clientType + " ";
          return null; // Success - Okta client ID validated
        } else {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
              "Unexpected introspection response format - missing 'active' field");
        }
      } else {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
            "Client ID validation failed. HTTP response: " + response.getStatusCode());
      }

    } catch (Exception e) {
      // Warning only - format appears valid, so don't fail validation
      LOG.warn("Client ID validation warning: {}", e.getMessage());
      return null; // Treat as success since format appears valid
    }
  }

  private FieldError validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, String oktaDomain) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        throw new IllegalArgumentException("Public key URLs are required for public clients");
      }

      String expectedJwksUrl = oktaDomain + "/v1/keys";
      boolean hasCorrectOktaJwksUrl = false;

      // Check if at least one URL matches the expected Okta JWKS format
      for (String urlStr : publicKeyUrls) {
        if (urlStr.equals(expectedJwksUrl)) {
          hasCorrectOktaJwksUrl = true;
          break;
        }
      }

      if (!hasCorrectOktaJwksUrl) {
        throw new IllegalArgumentException(
            "At least one public key URL must be the Okta JWKS endpoint: " + expectedJwksUrl);
      }

      // Validate all provided URLs
      for (String urlStr : publicKeyUrls) {
        try {
          ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(urlStr);

          if (response.getStatusCode() != 200) {
            throw new IllegalArgumentException(
                "Public key URL is not accessible. HTTP response: "
                    + response.getStatusCode()
                    + " for URL: "
                    + urlStr);
          }

          // Validate response is proper JWKS
          JsonNode jwks = JsonUtils.readTree(response.getBody());

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

          // For the expected Okta URL, validate it contains RSA keys
          if (urlStr.equals(expectedJwksUrl)) {
            JsonNode keys = jwks.get("keys");
            boolean hasRsaKey = false;
            for (JsonNode key : keys) {
              if (key.has("kty") && "RSA".equals(key.get("kty").asText())) {
                hasRsaKey = true;
                break;
              }
            }
            if (!hasRsaKey) {
              throw new IllegalArgumentException(
                  "Okta JWKS endpoint should contain at least one RSA key at: " + urlStr);
            }
          }

        } catch (Exception e) {
          throw new IllegalArgumentException(
              "Invalid public key URL '" + urlStr + "': " + e.getMessage());
        }
      }

      return null; // Success - Okta public key URLs are valid
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
          "Public key URL validation failed: " + e.getMessage());
    }
  }

  private FieldError validateOktaDomain(String oktaDomain, String fieldPath) {
    try {
      String discoveryUrl = oktaDomain + OKTA_WELL_KNOWN_PATH;
      testOktaDiscoveryEndpoint(discoveryUrl);

      return null; // Success - Okta domain validated
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          fieldPath, "Domain validation failed: " + e.getMessage());
    }
  }

  private void testOktaDiscoveryEndpoint(String discoveryUrl) throws Exception {
    ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUrl);

    if (response.getStatusCode() != 200) {
      throw new IllegalArgumentException(
          "Failed to access Okta discovery endpoint. HTTP response: " + response.getStatusCode());
    }

    // Parse and validate the discovery document
    JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());

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

  private FieldError validateClientCredentials(
      String oktaDomain, String clientId, String clientSecret) {
    try {

      String introspectUrl = oktaDomain + "/v1/introspect";
      String requestBody = "token=dummy&token_type_hint=access_token";
      String authHeader = ValidationHttpUtil.createBasicAuthHeader(clientId, clientSecret);

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(
              introspectUrl, requestBody, Map.of("Authorization", authHeader));

      int responseCode = response.getStatusCode();

      if (responseCode == 401) {
        JsonNode jsonNode = JsonUtils.readTree(response.getBody());
        if (jsonNode.has("errorSummary")) {
          String errorDescription = jsonNode.get("errorSummary").asText();
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID, errorDescription);
        }
        if (jsonNode.has("error_description")) {
          String errorDescription = jsonNode.get("error_description").asText();
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, errorDescription);
        }
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
            "Invalid client credentials. Please verify the client ID and secret are correct.");
      } else if (responseCode == 400 || responseCode == 200) {
        // 400 or 200 means client authenticated successfully (but token was invalid/dummy)
        return null; // Success - Okta client credentials validated
      } else {
        // Some other error - treat warning as success since credentials format appears valid
        LOG.warn("Could not fully validate Okta credentials. HTTP response: {}", responseCode);
        return null;
      }
    } catch (Exception e) {
      LOG.warn("Okta credentials validation encountered an error", e);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, "Could not validate credentials.");
    }
  }
}
