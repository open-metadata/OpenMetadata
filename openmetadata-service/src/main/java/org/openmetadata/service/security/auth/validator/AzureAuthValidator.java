package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class AzureAuthValidator {

  private static final String AZURE_LOGIN_BASE = "https://login.microsoftonline.com";
  private static final String TOKEN_ENDPOINT_V2 = "/oauth2/v2.0/token";
  private static final String OPENID_CONFIG_PATH = "/.well-known/openid-configuration";

  public ValidationResult validateAzureConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateAzurePublicClient(authConfig);
        case CONFIDENTIAL -> validateAzureConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Azure AD validation failed", e);
      return new ValidationResult()
          .withComponent("azure")
          .withStatus("failed")
          .withMessage("Azure AD validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateAzurePublicClient(AuthenticationConfiguration authConfig) {
    try {
      String authority = authConfig.getAuthority();
      if (!authority.contains("login.microsoftonline.com")) {
        return new ValidationResult()
            .withComponent("azure-authority")
            .withStatus("failed")
            .withMessage("Azure authority must use login.microsoftonline.com domain");
      }

      String tenantId = extractTenantId(authority);

      ValidationResult tenantValidation = validateTenantExists(tenantId);
      if ("failed".equals(tenantValidation.getStatus())) {
        return tenantValidation;
      }

      ValidationResult clientIdValidation =
          validatePublicClientId(tenantId, authConfig.getClientId());
      if ("failed".equals(clientIdValidation.getStatus())) {
        return clientIdValidation;
      }

      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig, tenantId);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      return new ValidationResult()
          .withComponent("azure-public")
          .withStatus("success")
          .withMessage(
              "Azure public client validated successfully. Authority, client ID, and public key URLs are valid.");
    } catch (Exception e) {
      LOG.error("Azure public client validation failed", e);
      return new ValidationResult()
          .withComponent("azure-public")
          .withStatus("failed")
          .withMessage("Azure public client validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateAzureConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String tenantId = oidcConfig.getTenant();

      ValidationResult tenantValidation = validateTenantExists(tenantId);
      if ("failed".equals(tenantValidation.getStatus())) {
        return tenantValidation;
      }

      ValidationResult publicKeyValidation = validatePublicKeyUrls(authConfig, tenantId);
      if ("failed".equals(publicKeyValidation.getStatus())) {
        return publicKeyValidation;
      }

      ValidationResult credentialsValidation =
          validateClientCredentials(tenantId, oidcConfig.getId(), oidcConfig.getSecret());
      if ("failed".equals(credentialsValidation.getStatus())) {
        return credentialsValidation;
      }

      return new ValidationResult()
          .withComponent("azure-confidential")
          .withStatus("success")
          .withMessage(
              "Azure confidential client validated successfully. Discovery URI, client ID, public key URLs, and secret are valid.");
    } catch (Exception e) {
      LOG.error("Azure confidential client validation failed", e);
      return new ValidationResult()
          .withComponent("azure-confidential")
          .withStatus("failed")
          .withMessage("Azure confidential client validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateTenantExists(String tenantId) {
    try {
      String discoveryUrl = AZURE_LOGIN_BASE + "/" + tenantId + OPENID_CONFIG_PATH;

      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(discoveryUrl);

      if (response.getStatusCode() == 404) {
        return new ValidationResult()
            .withComponent("azure-tenant")
            .withStatus("failed")
            .withMessage(
                "Azure tenant '"
                    + tenantId
                    + "' not found. Please verify the tenant ID is correct.");
      } else if (response.getStatusCode() != 200) {
        return new ValidationResult()
            .withComponent("azure-tenant")
            .withStatus("failed")
            .withMessage("Failed to validate tenant. HTTP response: " + response.getStatusCode());
      }

      // Parse and validate the discovery document
      JsonNode discoveryDoc = JsonUtils.readTree(response.getBody());
      if (!discoveryDoc.has("issuer") || !discoveryDoc.has("token_endpoint")) {
        return new ValidationResult()
            .withComponent("azure-tenant")
            .withStatus("failed")
            .withMessage("Invalid Azure discovery document format");
      }

      return new ValidationResult()
          .withComponent("azure-tenant")
          .withStatus("success")
          .withMessage("Azure tenant validated successfully");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("azure-tenant")
          .withStatus("failed")
          .withMessage("Tenant validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateClientCredentials(
      String tenantId, String clientId, String clientSecret) {
    try {
      if (nullOrEmpty(clientSecret)) {
        return new ValidationResult()
            .withComponent("azure-credentials")
            .withStatus("failed")
            .withMessage("Client secret is required for confidential Azure AD clients");
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
        return new ValidationResult()
            .withComponent("azure-credentials")
            .withStatus("success")
            .withMessage("Azure client credentials validated successfully");
      } else {
        // Parse error response
        try {
          JsonNode errorResponse = JsonUtils.readTree(response.getBody());
          String error = errorResponse.path("error").asText();
          String errorDescription = errorResponse.path("error_description").asText();

          if ("invalid_client".equals(error)) {
            return new ValidationResult()
                .withComponent("azure-credentials")
                .withStatus("failed")
                .withMessage(
                    "Invalid client credentials. Please verify the client ID and secret are correct.");
          } else if ("unauthorized_client".equals(error)) {
            return new ValidationResult()
                .withComponent("azure-credentials")
                .withStatus("failed")
                .withMessage(
                    "Client is not authorized. Please ensure the application is properly configured in Azure AD.");
          } else {
            return new ValidationResult()
                .withComponent("azure-credentials")
                .withStatus("failed")
                .withMessage("Authentication failed: " + errorDescription);
          }
        } catch (Exception parseError) {
          return new ValidationResult()
              .withComponent("azure-credentials")
              .withStatus("failed")
              .withMessage("Credentials validation failed. HTTP response: " + responseCode);
        }
      }
    } catch (Exception e) {
      LOG.warn("Azure credentials validation encountered an error", e);
      return new ValidationResult()
          .withComponent("azure-credentials")
          .withStatus("warning")
          .withMessage(
              "Could not fully validate credentials: "
                  + e.getMessage()
                  + ". Credentials format appears valid.");
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

  private ValidationResult validatePublicClientId(String tenantId, String clientId) {
    return validateClientIdViaTokenEndpoint(tenantId, clientId, "azure-public-client-id", "public");
  }

  private ValidationResult validateClientIdViaTokenEndpoint(
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
          // Client ID doesn't exist
          return new ValidationResult()
              .withComponent(componentName)
              .withStatus("failed")
              .withMessage("Azure client ID not found. Please verify the client ID is correct.");
        } else if ("unsupported_grant_type".equals(error) || "invalid_grant".equals(error)) {
          // Client ID exists but grant type is invalid (expected)
          String clientTypeDesc = clientType.isEmpty() ? "" : clientType + " ";
          return new ValidationResult()
              .withComponent(componentName)
              .withStatus("success")
              .withMessage(
                  "Azure "
                      + clientTypeDesc
                      + "client ID validated successfully via token endpoint");
        } else {
          // Some other error, but client ID format was accepted
          return new ValidationResult()
              .withComponent(componentName)
              .withStatus("success")
              .withMessage(
                  "Azure "
                      + clientType
                      + " client ID appears to be valid (received: "
                      + error
                      + ")");
        }
      } catch (Exception parseError) {
        // If we can't parse the response, assume client ID is valid if we got a response
        if (responseCode == 400) {
          return new ValidationResult()
              .withComponent(componentName)
              .withStatus("success")
              .withMessage("Azure " + clientType + " client ID validated successfully");
        } else {
          return new ValidationResult()
              .withComponent(componentName)
              .withStatus("failed")
              .withMessage("Client ID validation failed. HTTP response: " + responseCode);
        }
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
      AuthenticationConfiguration authConfig, String tenantId) {
    try {
      List<String> publicKeyUrls = authConfig.getPublicKeyUrls();
      if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
        return new ValidationResult()
            .withComponent("azure-public-key-urls")
            .withStatus("failed")
            .withMessage("Public key URLs are required for Azure AD clients");
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
        return new ValidationResult()
            .withComponent("azure-public-key-urls")
            .withStatus("failed")
            .withMessage(
                "At least one public key URL must be the Azure JWKS endpoint: " + expectedJwksUrl);
      }

      // Validate all provided URLs
      for (String urlStr : publicKeyUrls) {
        try {
          ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(urlStr);

          if (response.getStatusCode() != 200) {
            return new ValidationResult()
                .withComponent("azure-public-key-urls")
                .withStatus("failed")
                .withMessage(
                    "Public key URL is not accessible. HTTP response: "
                        + response.getStatusCode()
                        + " for URL: "
                        + urlStr);
          }

          // Validate response is proper JWKS
          JsonNode jwks = JsonUtils.readTree(response.getBody());

          // For JWKS, should have 'keys' array
          if (!jwks.has("keys")) {
            return new ValidationResult()
                .withComponent("azure-public-key-urls")
                .withStatus("failed")
                .withMessage("Invalid JWKS format. Expected JSON with 'keys' array at: " + urlStr);
          }

          // Validate keys array is not empty
          if (jwks.get("keys").size() == 0) {
            return new ValidationResult()
                .withComponent("azure-public-key-urls")
                .withStatus("failed")
                .withMessage("JWKS endpoint returned empty keys array: " + urlStr);
          }

        } catch (Exception e) {
          return new ValidationResult()
              .withComponent("azure-public-key-urls")
              .withStatus("failed")
              .withMessage("Invalid public key URL '" + urlStr + "': " + e.getMessage());
        }
      }

      return new ValidationResult()
          .withComponent("azure-public-key-urls")
          .withStatus("success")
          .withMessage(
              "Azure public key URLs are valid and accessible. Found expected JWKS endpoint: "
                  + expectedJwksUrl);
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("azure-public-key-urls")
          .withStatus("failed")
          .withMessage("Public key URL validation failed: " + e.getMessage());
    }
  }
}
