package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class OidcDiscoveryValidator {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  public static class DiscoveryDocument {
    public String issuer;
    public String authorizationEndpoint;
    public String tokenEndpoint;
    public String userinfoEndpoint;
    public String jwksUri;
    public Set<String> responseTypesSupported = new HashSet<>();
    public Set<String> scopesSupported = new HashSet<>();
    public Set<String> tokenEndpointAuthMethodsSupported = new HashSet<>();
    public Set<String> idTokenSigningAlgValuesSupported = new HashSet<>();
    public Set<String> grantTypesSupported = new HashSet<>();
    public Set<String> claimsSupported = new HashSet<>();
    public Set<String> subjectTypesSupported = new HashSet<>();

    public static DiscoveryDocument fromJson(String json) throws Exception {
      JsonNode root = OBJECT_MAPPER.readTree(json);
      DiscoveryDocument doc = new DiscoveryDocument();

      doc.issuer = getTextValue(root, "issuer");
      doc.authorizationEndpoint = getTextValue(root, "authorization_endpoint");
      doc.tokenEndpoint = getTextValue(root, "token_endpoint");
      doc.userinfoEndpoint = getTextValue(root, "userinfo_endpoint");
      doc.jwksUri = getTextValue(root, "jwks_uri");

      doc.responseTypesSupported = getArrayAsSet(root, "response_types_supported");
      doc.scopesSupported = getArrayAsSet(root, "scopes_supported");
      doc.tokenEndpointAuthMethodsSupported =
          getArrayAsSet(root, "token_endpoint_auth_methods_supported");
      doc.idTokenSigningAlgValuesSupported =
          getArrayAsSet(root, "id_token_signing_alg_values_supported");
      doc.grantTypesSupported = getArrayAsSet(root, "grant_types_supported");
      doc.claimsSupported = getArrayAsSet(root, "claims_supported");
      doc.subjectTypesSupported = getArrayAsSet(root, "subject_types_supported");

      return doc;
    }

    private static String getTextValue(JsonNode node, String field) {
      return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }

    private static Set<String> getArrayAsSet(JsonNode node, String field) {
      Set<String> result = new HashSet<>();
      if (node.has(field) && node.get(field).isArray()) {
        node.get(field).forEach(item -> result.add(item.asText()));
      }
      return result;
    }
  }

  public FieldError validateAgainstDiscovery(
      String discoveryUri, AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      if (nullOrEmpty(discoveryUri)) {
        LOG.debug("No discovery URI provided, skipping discovery validation");
        // No discovery URI - this is not an error, just skip validation
        return null;
      }

      LOG.debug("Fetching OIDC discovery document from: {}", discoveryUri);
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);

      if (response.getStatusCode() != 200) {
        LOG.error(
            "Failed to fetch discovery document, status: {}, body: {}",
            response.getStatusCode(),
            response.getBody());
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Failed to fetch OIDC discovery document. Status: " + response.getStatusCode());
      }

      DiscoveryDocument discovery = DiscoveryDocument.fromJson(response.getBody());
      List<String> warnings = new ArrayList<>();
      List<String> errors = new ArrayList<>();

      validateScopes(oidcConfig, discovery, errors, warnings);
      validateResponseType(oidcConfig, discovery, errors, warnings);
      validateTokenAuthMethod(oidcConfig, discovery, errors, warnings);
      validateJwsAlgorithm(authConfig, oidcConfig, discovery, errors, warnings);
      validateGrantTypes(oidcConfig, discovery, warnings);
      validateEndpoints(oidcConfig, discovery, warnings);
      validatePromptParameter(authConfig, errors);

      if (!errors.isEmpty()) {
        String errorMessage = String.join("; ", errors);
        LOG.error("Discovery validation failed: {}", errorMessage);
        // Determine which field to map the error to based on the error message
        String fieldPath = determineFieldPathFromErrors(errors);
        return ValidationErrorBuilder.createFieldError(fieldPath, errorMessage);
      }

      String message = "OIDC configuration validated against discovery document.";
      if (!warnings.isEmpty()) {
        message += " Warnings: " + String.join("; ", warnings);
        LOG.warn("Discovery validation warnings: {}", warnings);
      }

      // Success - no error
      return null;

    } catch (Exception e) {
      LOG.error("Error during discovery validation", e);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
          "Failed to validate against discovery document: " + e.getMessage());
    }
  }

  private void validateScopes(
      OidcClientConfig config,
      DiscoveryDocument discovery,
      List<String> errors,
      List<String> warnings) {
    if (nullOrEmpty(config.getScope())) {
      errors.add("Scope is required for OIDC. Must include 'openid' scope.");
      return;
    }

    String[] requestedScopes = config.getScope().split(" ");

    boolean hasOpenIdScope = false;
    for (String scope : requestedScopes) {
      if ("openid".equals(scope)) {
        hasOpenIdScope = true;
        break;
      }
    }

    if (!hasOpenIdScope) {
      errors.add(
          "The scope must include 'openid' for OIDC authentication. Current scopes: "
              + config.getScope());
    }

    if (!discovery.scopesSupported.isEmpty()) {
      List<String> unsupportedScopes = new ArrayList<>();

      for (String scope : requestedScopes) {
        if (!discovery.scopesSupported.contains(scope)) {
          unsupportedScopes.add(scope);
        }
      }

      if (!unsupportedScopes.isEmpty()) {
        errors.add(
            "The following scopes are not supported by the IdP: "
                + String.join(", ", unsupportedScopes));
      }
    }
  }

  private void validateResponseType(
      OidcClientConfig config,
      DiscoveryDocument discovery,
      List<String> errors,
      List<String> warnings) {
    if (!nullOrEmpty(config.getResponseType()) && !discovery.responseTypesSupported.isEmpty()) {
      if (!discovery.responseTypesSupported.contains(config.getResponseType())) {
        errors.add(
            "Response type '"
                + config.getResponseType()
                + "' is not supported by the IdP. Supported: "
                + discovery.responseTypesSupported);
      }
    }
  }

  private void validateTokenAuthMethod(
      OidcClientConfig config,
      DiscoveryDocument discovery,
      List<String> errors,
      List<String> warnings) {
    if (config.getClientAuthenticationMethod() != null
        && !discovery.tokenEndpointAuthMethodsSupported.isEmpty()) {
      String authMethod = mapClientAuthMethod(config.getClientAuthenticationMethod().toString());
      if (!discovery.tokenEndpointAuthMethodsSupported.contains(authMethod)) {
        warnings.add(
            "Client authentication method '"
                + authMethod
                + "' may not be supported. Supported methods: "
                + discovery.tokenEndpointAuthMethodsSupported);
      }
    }
  }

  private void validateJwsAlgorithm(
      AuthenticationConfiguration authConfig,
      OidcClientConfig config,
      DiscoveryDocument discovery,
      List<String> errors,
      List<String> warnings) {
    String preferredAlg = null;
    if (config.getPreferredJwsAlgorithm() != null) {
      preferredAlg = config.getPreferredJwsAlgorithm();
    } else if (authConfig != null && !nullOrEmpty(authConfig.getJwtPrincipalClaims())) {
      preferredAlg = "RS256";
    }

    if (preferredAlg != null && !discovery.idTokenSigningAlgValuesSupported.isEmpty()) {
      if (!discovery.idTokenSigningAlgValuesSupported.contains(preferredAlg)) {
        errors.add(
            "JWS algorithm '"
                + preferredAlg
                + "' is not supported by the IdP. Supported: "
                + discovery.idTokenSigningAlgValuesSupported);
      }
    }
  }

  private void validateGrantTypes(
      OidcClientConfig config, DiscoveryDocument discovery, List<String> warnings) {
    if (!discovery.grantTypesSupported.isEmpty()) {
      boolean supportsAuthCode = discovery.grantTypesSupported.contains("authorization_code");
      if (!supportsAuthCode) {
        warnings.add("IdP may not support authorization_code grant type");
      }

      boolean supportsRefreshToken = discovery.grantTypesSupported.contains("refresh_token");
      if (!supportsRefreshToken) {
        warnings.add("IdP may not support refresh_token grant type");
      }
    }
  }

  private void validateEndpoints(
      OidcClientConfig config, DiscoveryDocument discovery, List<String> warnings) {
    // OidcClientConfig doesn't expose token endpoint or public key URLs directly
    // We can only suggest using the discovery document's endpoints
    if (!nullOrEmpty(discovery.jwksUri)) {
      warnings.add("JWKS URI available from discovery: " + discovery.jwksUri);
    }

    if (!nullOrEmpty(discovery.tokenEndpoint)) {
      LOG.debug("Token endpoint from discovery: {}", discovery.tokenEndpoint);
    }
  }

  private void validatePromptParameter(
      AuthenticationConfiguration authConfig, List<String> errors) {
    // Validate prompt parameter for confidential clients
    if (authConfig != null
        && authConfig.getClientType() == ClientType.CONFIDENTIAL
        && authConfig.getOidcConfiguration() != null) {

      String prompt = authConfig.getOidcConfiguration().getPrompt();
      if (!nullOrEmpty(prompt)) {
        // Valid prompt values according to OpenID Connect spec
        Set<String> validPromptValues = Set.of("", "none", "consent", "select_account", "login");

        // The prompt parameter can contain multiple space-separated values
        String[] promptValues = prompt.trim().split("\\s+");
        List<String> invalidValues = new ArrayList<>();

        for (String value : promptValues) {
          if (!value.isEmpty() && !validPromptValues.contains(value)) {
            invalidValues.add(value);
          }
        }

        if (!invalidValues.isEmpty()) {
          errors.add(
              "Invalid prompt value(s) for confidential client: "
                  + String.join(", ", invalidValues)
                  + ". Valid values are: empty string, none, consent, select_account, login");
        }

        // Additional validation: 'none' cannot be combined with other values
        if (promptValues.length > 1 && List.of(promptValues).contains("none")) {
          errors.add("Prompt value 'none' cannot be combined with other prompt values");
        }
      }
    }
  }

  private String mapClientAuthMethod(String method) {
    return switch (method.toLowerCase()) {
      case "client_secret_basic" -> "client_secret_basic";
      case "client_secret_post" -> "client_secret_post";
      case "client_secret_jwt" -> "client_secret_jwt";
      case "private_key_jwt" -> "private_key_jwt";
      case "none" -> "none";
      default -> method.toLowerCase();
    };
  }

  public static DiscoveryDocument fetchDiscoveryDocument(String discoveryUri) throws Exception {
    ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);
    if (response.getStatusCode() != 200) {
      throw new RuntimeException(
          "Failed to fetch discovery document. Status: " + response.getStatusCode());
    }
    return DiscoveryDocument.fromJson(response.getBody());
  }

  private String determineFieldPathFromErrors(List<String> errors) {
    // Join all errors to analyze them
    String allErrors = String.join(" ", errors).toLowerCase();

    // Check for specific error patterns
    if (allErrors.contains("scope")) {
      return ValidationErrorBuilder.FieldPaths.OIDC_SCOPE;
    }
    if (allErrors.contains("prompt")) {
      return ValidationErrorBuilder.FieldPaths.OIDC_PROMPT;
    }
    if (allErrors.contains("response_type") || allErrors.contains("response type")) {
      return ValidationErrorBuilder.FieldPaths
          .OIDC_DISCOVERY_URI; // Response type is part of OIDC config
    }
    if (allErrors.contains("token") && allErrors.contains("auth")) {
      return ValidationErrorBuilder.FieldPaths
          .OIDC_CLIENT_SECRET; // Token auth method relates to secret
    }
    if (allErrors.contains("algorithm")
        || allErrors.contains("jws")
        || allErrors.contains("signing")) {
      return ValidationErrorBuilder.FieldPaths
          .OIDC_DISCOVERY_URI; // Algorithm issues relate to discovery config
    }

    // Default to discovery URI for general OIDC configuration errors
    return ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI;
  }

  /**
   * Auto-populates publicKeyUrls from OIDC discovery document if not already set
   *
   * @param discoveryUri The OIDC discovery URI
   * @param authConfig The authentication configuration to populate
   * @throws Exception if discovery document cannot be fetched or parsed
   */
  public void autoPopulatePublicKeyUrls(String discoveryUri, AuthenticationConfiguration authConfig)
      throws Exception {

    // Skip if publicKeyUrls already populated
    if (authConfig.getPublicKeyUrls() != null && !authConfig.getPublicKeyUrls().isEmpty()) {
      LOG.debug("publicKeyUrls already set, skipping auto-population");
      return;
    }

    if (nullOrEmpty(discoveryUri)) {
      throw new IOException("Discovery URI is required for auto-populating publicKeyUrls");
    }

    // Fetch discovery document
    ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);
    if (response.getStatusCode() != 200) {
      throw new IOException(
          "Failed to fetch discovery document from: "
              + discoveryUri
              + " (HTTP "
              + response.getStatusCode()
              + ")");
    }

    // Parse and extract jwks_uri
    JsonNode discoveryDoc = OBJECT_MAPPER.readTree(response.getBody());
    if (!discoveryDoc.has("jwks_uri")) {
      throw new IOException("Discovery document missing required 'jwks_uri' field");
    }

    String jwksUri = discoveryDoc.get("jwks_uri").asText();
    if (nullOrEmpty(jwksUri)) {
      throw new IOException("Discovery document contains empty 'jwks_uri' field");
    }

    // Auto-populate publicKeyUrls
    authConfig.setPublicKeyUrls(List.of(jwksUri));
    LOG.debug("Auto-populated publicKeyUrls from discovery document: {}", jwksUri);
  }
}
