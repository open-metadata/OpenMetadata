package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class AzureAuthValidator {

  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();
  private static final String AZURE_LOGIN_BASE = "https://login.microsoftonline.com";
  private static final String TOKEN_ENDPOINT_V2 = "/oauth2/v2.0/token";
  private static final String OPENID_CONFIG_PATH = "/.well-known/openid-configuration";

  public FieldError validateAzureConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateAzurePublicClient(authConfig);
        case CONFIDENTIAL -> validateAzureConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Azure AD validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Azure OAuth validation failed: " + e.getMessage());
    }
  }

  private FieldError validateAzurePublicClient(AuthenticationConfiguration authConfig) {
    try {
      String authority = authConfig.getAuthority();
      if (!authority.contains("login.microsoftonline.com")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_AUTHORITY,
            "Azure authority must use login.microsoftonline.com domain");
      }

      String tenantId;
      try {
        tenantId = extractTenantId(authority);
      } catch (IllegalArgumentException e) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_AUTHORITY, e.getMessage());
      }

      FieldError tenantValidation = validateTenantExists(tenantId);
      if (tenantValidation != null) {
        return tenantValidation;
      }

      FieldError clientIdValidation = validatePublicClientId(tenantId, authConfig.getClientId());
      if (clientIdValidation != null) {
        return clientIdValidation;
      }

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, tenantId);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      return null;
    } catch (Exception e) {
      LOG.error("Azure public client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Azure public key validation failed" + e.getMessage());
    }
  }

  private FieldError validateAzureConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String tenantId = oidcConfig.getTenant();

      // Validate tenant ID for confidential clients
      if (nullOrEmpty(tenantId)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_TENANT,
            "Tenant ID is required for Azure confidential clients");
      }

      // Validate tenant ID format
      if (!isValidGuid(tenantId)
          && !"common".equals(tenantId)
          && !"organizations".equals(tenantId)
          && !"consumers".equals(tenantId)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_TENANT,
            "Invalid tenant ID format. Must be a valid GUID or 'common'/'organizations'/'consumers'");
      }

      // Determine the discovery URI to use
      String discoveryUri;
      if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
        // User provided a discovery URI - validate it's correct for Azure
        discoveryUri = oidcConfig.getDiscoveryUri();
        String expectedDiscoveryUri = AZURE_LOGIN_BASE + "/" + tenantId + OPENID_CONFIG_PATH;
        String expectedV2DiscoveryUri =
            AZURE_LOGIN_BASE + "/" + tenantId + "/v2.0" + OPENID_CONFIG_PATH;

        // Check if the provided URI matches either v1 or v2 format
        if (!discoveryUri.equals(expectedDiscoveryUri)
            && !discoveryUri.equals(expectedV2DiscoveryUri)) {
          // Check if it's a malformed URI (common error: missing slash)
          if (discoveryUri.contains(".well-knownopenid-configuration")) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
                "Malformed discovery URI detected. Missing '/' between '.well-known' and 'openid-configuration'. "
                    + "Expected format: "
                    + expectedDiscoveryUri);
          }

          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
              "Invalid Azure discovery URI. Expected: "
                  + expectedDiscoveryUri
                  + " or "
                  + expectedV2DiscoveryUri
                  + " but got: "
                  + discoveryUri);
        }
      } else {
        // No discovery URI provided, construct default v2 endpoint
        discoveryUri = AZURE_LOGIN_BASE + "/" + tenantId + "/v2.0" + OPENID_CONFIG_PATH;
      }

      // First validate that the discovery URI is accessible
      FieldError tenantValidation = validateDiscoveryEndpoint(discoveryUri, tenantId);
      if (tenantValidation != null) {
        return tenantValidation;
      }

      // Validate against the discovery document
      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      // For Azure confidential clients, validate offline_access scope is present
      FieldError offlineAccessCheck = validateOfflineAccessScope(discoveryUri, oidcConfig);
      if (offlineAccessCheck != null) {
        return offlineAccessCheck;
      }

      FieldError publicKeyValidation = validatePublicKeyUrls(authConfig, tenantId);
      if (publicKeyValidation != null) {
        return publicKeyValidation;
      }

      FieldError credentialsValidation =
          validateClientCredentials(tenantId, oidcConfig.getId(), oidcConfig.getSecret());
      if (credentialsValidation != null) {
        return credentialsValidation;
      }

      return null;
    } catch (Exception e) {
      LOG.error("Azure confidential client validation failed", e);
      return ValidationErrorBuilder.createFieldError("", "Failed azure confidential validation");
    }
  }

  private FieldError validateDiscoveryEndpoint(String discoveryUrl, String tenantId) {
    try {
      LOG.debug("Validating Azure discovery endpoint: {}", discoveryUrl);
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUrl);

      if (response.getStatusCode() == 404) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Azure discovery endpoint not found. Please verify the discovery URI is correct");
      } else if (response.getStatusCode() != 200) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Failed to access Azure discovery endpoint. HTTP response: "
                + response.getStatusCode());
      }

      // Parse and validate the discovery document
      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());
      if (!discoveryDoc.has("issuer") || !discoveryDoc.has("token_endpoint")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Invalid Azure discovery document format at: " + discoveryUrl);
      }
      return null;
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
          "Azure discovery document validation failed");
    }
  }

  private FieldError validateTenantExists(String tenantId) {
    try {
      String discoveryUrl = AZURE_LOGIN_BASE + "/" + tenantId + OPENID_CONFIG_PATH;

      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUrl);

      if (response.getStatusCode() != 200) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_TENANT, "Failed to validate tenant");
      }

      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());
      if (!discoveryDoc.has("issuer") || !discoveryDoc.has("token_endpoint")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Invalid Azure discovery document format");
      }
      return null;
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_TENANT, "Failed to validate tenant");
    }
  }

  private FieldError validateClientCredentials(
      String tenantId, String clientId, String clientSecret) {
    try {
      if (nullOrEmpty(clientSecret)) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
            "Client secret is required for confidential Azure AD clients");
      }

      String tokenUrl = AZURE_LOGIN_BASE + "/" + tenantId + TOKEN_ENDPOINT_V2;
      String requestBody =
          String.format(
              "client_id=%s&client_secret=%s&scope=https://graph.microsoft.com/.default&grant_type=client_credentials",
              clientId, clientSecret);

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(tokenUrl, requestBody);

      int responseCode = response.getStatusCode();
      if (responseCode == 200) {
        // Successfully obtained token
        return null;
      } else {
        // Parse error response
        try {
          JsonNode errorResponse = JsonUtils.readTree(response.getBody());
          String error = errorResponse.path("error").asText();
          String errorDescription = errorResponse.path("error_description").asText();

          if ("invalid_client".equals(error)) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
                "Invalid client credentials. Please verify the client ID and secret are correct.");
          } else if ("unauthorized_client".equals(error)) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
                "Client is not authorized. Please ensure the application is properly configured in Azure AD.");
          } else {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
                "Authentication failed: " + errorDescription);
          }
        } catch (Exception parseError) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
              "Credentials validation failed. HTTP response: " + responseCode);
        }
      }
    } catch (Exception e) {
      LOG.warn("Azure credentials validation encountered an error", e);

      LOG.warn("Could not fully validate credentials: {}", e.getMessage());
      return ValidationErrorBuilder.createFieldError("", "Exception occured while validating");
    }
  }

  private String extractTenantId(String authority) {
    String[] parts = authority.split("/");
    if (parts.length < 4) {
      throw new IllegalArgumentException(
          "Invalid Azure authority format. Expected: https://login.microsoftonline.com/{tenant-id}");
    }
    String tenantId = parts[parts.length - 1];

    // Validate tenant ID format
    if (!isValidGuid(tenantId)
        && !"common".equals(tenantId)
        && !"organizations".equals(tenantId)
        && !"consumers".equals(tenantId)) {
      throw new IllegalArgumentException(
          "Invalid tenant ID format. Must be a valid GUID or 'common'/'organizations'/'consumers'");
    }

    return tenantId;
  }

  private boolean isValidGuid(String guid) {
    return guid != null
        && guid.matches(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  }

  private FieldError validatePublicClientId(String tenantId, String clientId) {
    return validateClientIdViaTokenEndpoint(tenantId, clientId, "azure-public-client-id", "public");
  }

  private FieldError validateClientIdViaTokenEndpoint(
      String tenantId, String clientId, String componentName, String clientType) {
    try {
      String tokenUrl = AZURE_LOGIN_BASE + "/" + tenantId + TOKEN_ENDPOINT_V2;
      String requestBody =
          String.format(
              "client_id=%s&grant_type=invalid_grant_type&scope=https://graph.microsoft.com/.default",
              clientId);

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(tokenUrl, requestBody);

      int responseCode = response.getStatusCode();

      // Parse response to get error details
      try {
        JsonNode errorResponse = JsonUtils.readTree(response.getBody());
        String error = errorResponse.path("error").asText();

        if ("invalid_client".equals(error)) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
              "Azure client ID not found. Please verify the client ID is correct");
        } else if ("unsupported_grant_type".equals(error) || "invalid_grant".equals(error)) {
          return null;
        } else {
          return null;
        }
      } catch (Exception parseError) {
        // If we can't parse the response, assume client ID is valid if we got a response
        if (responseCode == 400) {
          return null;
        } else {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID, "Client ID validation failed");
        }
      }

    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID, "Client ID validation failed");
    }
  }

  private FieldError validatePublicKeyUrls(
      AuthenticationConfiguration authConfig, String tenantId) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      // Skip validation if publicKeyUrls is empty - it's auto-populated for confidential clients
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        LOG.debug(
            "publicKeyUrls is empty, skipping validation (auto-populated for confidential clients)");
        return null;
      }

      String expectedJwksUrl = AZURE_LOGIN_BASE + "/" + tenantId + "/discovery/v2.0/keys";
      boolean hasCorrectAzureJwksUrl = false;

      // Check if at least one URL matches the expected Azure JWKS format
      for (String urlStr : publicKeyUrls) {
        if (urlStr.equals(expectedJwksUrl)) {
          hasCorrectAzureJwksUrl = true;
          break;
        }
      }

      if (!hasCorrectAzureJwksUrl) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
            "At least one public key URL must be the Azure JWKS endpoint: " + expectedJwksUrl);
      }

      // Validate all provided URLs
      for (String urlStr : publicKeyUrls) {
        try {
          ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(urlStr);

          if (response.getStatusCode() != 200) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Public key url not accessible");
          }

          // Validate response is proper JWKS
          JsonNode jwks = JsonUtils.readTree(response.getBody());

          // For JWKS, should have 'keys' array
          if (!jwks.has("keys")) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
          }

          // Validate keys array is not empty
          if (jwks.get("keys").isEmpty()) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
                "JWKS endpoint returned empty keys array: " + urlStr);
          }

        } catch (Exception e) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
              "Invalid public key URL: " + urlStr);
        }
      }

      return null;
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
          "Public key URL validation failed");
    }
  }

  private FieldError validateOfflineAccessScope(String discoveryUri, OidcClientConfig oidcConfig) {
    try {
      // Fetch the discovery document to check supported scopes
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUri);
      if (response.getStatusCode() != 200) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
            "Could not find offline_access scope in discovery document");
      }

      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());
      JsonNode scopesSupported = discoveryDoc.get("scopes_supported");

      boolean offlineAccessSupported = false;
      if (scopesSupported != null && scopesSupported.isArray()) {
        for (JsonNode scope : scopesSupported) {
          if ("offline_access".equals(scope.asText())) {
            offlineAccessSupported = true;
            break;
          }
        }
      }

      // Check if the configured scope includes offline_access
      String configuredScope = oidcConfig.getScope();
      boolean hasOfflineAccess =
          configuredScope != null && configuredScope.contains("offline_access");

      if (offlineAccessSupported && !hasOfflineAccess) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_SCOPE,
            "Azure confidential clients require 'offline_access' scope for refresh tokens. "
                + "Without this scope, users may experience frequent authentication issues due to Azure's short token lifetimes. "
                + "Please add 'offline_access' to your scope configuration. "
                + "Current scope: '"
                + (configuredScope != null ? configuredScope : "")
                + "'");
      }

      return null;

    } catch (Exception e) {
      LOG.error("Error validating offline_access scope", e);
      return null;
    }
  }
}
