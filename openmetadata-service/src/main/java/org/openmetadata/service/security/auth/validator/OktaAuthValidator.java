package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.unboundid.util.Nullable;
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
          "", "Okta validation failed: " + e.getMessage());
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

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, oktaDomain, null);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      return null; // Success - Okta public client validated
    } catch (Exception e) {
      LOG.error("Okta public client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Okta public client validation failed: " + e.getMessage());
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
      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(
              oidcConfig.getDiscoveryUri(), authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      // Step 4: Validate public key URLs (required for JWT signature verification)
      FieldError publicKeyValidation =
          validatePublicKeyUrls(authConfig, oktaDomain, oidcConfig.getDiscoveryUri());
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      // Step 5: Validate client credentials (secret)
      String clientId = oidcConfig.getId();
      FieldError credentialsValidation =
          validateClientCredentials(
              oktaDomain, clientId, oidcConfig.getSecret(), oidcConfig.getDiscoveryUri());
      if (credentialsValidation != null) {
        return credentialsValidation;
      }

      return null; // Success - Okta confidential client validated
    } catch (Exception e) {
      LOG.error("Okta confidential client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Okta confidential client validation failed: " + e.getMessage());
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
    String discoveryUri = oktaDomain + OKTA_WELL_KNOWN_PATH;
    return validateClientIdViaIntrospection(
        discoveryUri, clientId, "okta-public-client-id", "public");
  }

  private String getIntrospectUrl(String discoveryUri) {
    try {
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);

      if (response.getStatusCode() != 200) {
        throw new IllegalArgumentException(
            "Failed to fetch OIDC discovery document. HTTP response: " + response.getStatusCode());
      }

      // 2. Parse JSON
      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());

      // 3. Prefer the explicit 'introspection_endpoint' field (best case)
      if (discoveryDoc.hasNonNull("introspection_endpoint")) {
        return discoveryDoc.get("introspection_endpoint").asText();
      }

      // 4. Fallback: derive from issuer (specifically for Okta)
      if (discoveryDoc.hasNonNull("issuer")) {
        String issuer = discoveryDoc.get("issuer").asText();
        if (issuer.endsWith("/")) {
          issuer = issuer.substring(0, issuer.length() - 1);
        }

        // Okta patterns:
        // - issuer = https://<domain>/oauth2/default  -> introspect = <issuer>/v1/introspect
        // - issuer = https://<domain>                -> introspect = <issuer>/oauth2/v1/introspect
        if (issuer.contains("/oauth2")) {
          return issuer + "/v1/introspect";
        } else {
          return issuer + "/oauth2/v1/introspect";
        }
      }

      throw new IllegalArgumentException(
          "Discovery document did not contain 'introspection_endpoint' or 'issuer'.");
    } catch (Exception e) {
      throw new RuntimeException(
          "Failed to resolve Okta introspection endpoint from discovery document", e);
    }
  }

  private FieldError validateClientIdViaIntrospection(
      String discoveryUri, String clientId, String componentName, String clientType) {
    try {
      String introspectUrl = getIntrospectUrl(discoveryUri);
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
              ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID,
              "Unexpected introspection response format - missing 'active' field");
        }
      } else {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID,
            "Client ID validation failed. HTTP response: " + response.getStatusCode());
      }

    } catch (Exception e) {
      // Warning only - format appears valid, so don't fail validation
      LOG.warn("Client ID validation warning: {}", e.getMessage());
      return null; // Treat as success since format appears valid
    }
  }

  private FieldError validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, String oktaDomain, @Nullable String discoveryUri) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      // Skip validation if publicKeyUrls is empty - it's auto-populated for confidential clients
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        LOG.debug(
            "publicKeyUrls is empty, skipping validation (auto-populated for confidential clients)");
        return null;
      }

      // Determine expected JWKS URL based on client type
      String expectedJwksUrl;

      if (!nullOrEmpty(discoveryUri)) {
        // CONFIDENTIAL CLIENT – read from metadata
        expectedJwksUrl = getJwksUriFromDiscovery(discoveryUri);
      } else {
        // PUBLIC CLIENT – derive from authority
        expectedJwksUrl = deriveOktaJwksFromAuthority(oktaDomain);
      }

      boolean hasCorrect = publicKeyUrls.stream().anyMatch(expectedJwksUrl::equals);

      if (!hasCorrect) {
        throw new IllegalArgumentException(
            "At least one public key URL must match the Okta JWKS endpoint: " + expectedJwksUrl);
      }

      // Validate URL reachability + JWKS format
      for (String urlStr : publicKeyUrls) {
        ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(urlStr);

        if (response.getStatusCode() != 200) {
          throw new IllegalArgumentException("Cannot access JWKS: " + urlStr);
        }

        JsonNode jwks = JsonUtils.readTree(response.getBody());
        if (!jwks.has("keys") || jwks.get("keys").size() == 0) {
          throw new IllegalArgumentException("Invalid JWKS: " + urlStr);
        }
      }

      return null;

    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
          "Public key URL validation failed: " + e.getMessage());
    }
  }

  private String deriveOktaJwksFromAuthority(String authority) {
    if (nullOrEmpty(authority)) {
      throw new IllegalArgumentException("Okta authority/domain must not be empty");
    }

    // Normalize trailing slash
    String domain =
        authority.endsWith("/") ? authority.substring(0, authority.length() - 1) : authority;

    /*
     * Patterns we want to support:
     *
     * 1) Custom / default authorization server:
     *    issuer / authority: https://dev-xxxx.okta.com/oauth2/default
     *                        https://dev-xxxx.okta.com/oauth2/ausosygfsxMxgYnFO5d7
     *    JWKS:               <issuer>/v1/keys
     *
     * 2) Org authorization server:
     *    issuer / authority: https://kansai-airports.okta.com
     *    JWKS:               https://kansai-airports.okta.com/oauth2/v1/keys
     */

    // Case 1: custom auth server (issuer contains /oauth2/{id})
    if (domain.matches(".*/oauth2/[^/]+$")) {
      return domain + "/v1/keys";
    }

    // Case 2: org auth server (no /oauth2/{id} in authority)
    return domain + "/oauth2/v1/keys";
  }

  private String getJwksUriFromDiscovery(String discoveryUri) {
    try {
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);

      if (response.getStatusCode() != 200) {
        throw new IllegalArgumentException(
            "Failed to fetch discovery document. HTTP " + response.getStatusCode());
      }

      JsonNode doc = JsonUtils.readTree(response.getBody());

      if (!doc.hasNonNull("jwks_uri")) {
        throw new IllegalArgumentException("Discovery document missing 'jwks_uri'");
      }

      return doc.get("jwks_uri").asText();

    } catch (Exception e) {
      throw new RuntimeException("Failed to resolve JWKS URI from discovery: " + e.getMessage(), e);
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
      String oktaDomain, String clientId, String clientSecret, String discoveryUri) {
    try {

      String introspectUrl = getIntrospectUrl(discoveryUri);
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
