package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class AzureAuthValidator {

  private static final String AZURE_LOGIN_BASE = "https://login.microsoftonline.com";
  private static final String GRAPH_API_BASE = "https://graph.microsoft.com";
  private static final String TOKEN_ENDPOINT_V2 = "/oauth2/v2.0/token";
  private static final String OPENID_CONFIG_PATH = "/.well-known/openid-configuration";

  public ValidationResult validateAzureConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      // Step 1: Validate basic configuration
      ValidationResult basicValidation = validateBasicConfig(authConfig, oidcConfig);
      if ("failed".equals(basicValidation.getStatus())) {
        return basicValidation;
      }

      String tenantId = extractTenantId(authConfig.getAuthority());

      // Step 2: Validate tenant exists via discovery endpoint
      ValidationResult tenantValidation = validateTenantExists(tenantId);
      if ("failed".equals(tenantValidation.getStatus())) {
        return tenantValidation;
      }

      // Step 3: Validate client credentials based on client type
      ValidationResult credentialsValidation =
          validateClientBasedOnType(authConfig, oidcConfig, tenantId);
      if ("failed".equals(credentialsValidation.getStatus())) {
        return credentialsValidation;
      }

      return new ValidationResult()
          .withComponent("azure")
          .withStatus("success")
          .withMessage(
              "Azure AD configuration validated successfully. Tenant and credentials are valid.");
    } catch (Exception e) {
      LOG.error("Azure AD validation failed", e);
      return new ValidationResult()
          .withComponent("azure")
          .withStatus("failed")
          .withMessage("Azure AD validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateBasicConfig(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      // Validate authority URL
      String authority = authConfig.getAuthority();
      if (nullOrEmpty(authority)) {
        throw new IllegalArgumentException("Azure authority URL is required");
      }

      if (!authority.contains("login.microsoftonline.com")) {
        throw new IllegalArgumentException(
            "Azure authority must use login.microsoftonline.com domain");
      }

      // Validate client ID format (should be GUID)
      String clientId = authConfig.getClientId();
      if (nullOrEmpty(clientId)) {
        throw new IllegalArgumentException("Client ID is required");
      }

      if (!isValidGuid(clientId)) {
        throw new IllegalArgumentException(
            "Invalid Azure client ID format. Must be a valid GUID (e.g., 12345678-1234-1234-1234-123456789012)");
      }

      return new ValidationResult()
          .withComponent("azure-basic")
          .withStatus("success")
          .withMessage("Basic Azure configuration is valid");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("azure-basic")
          .withStatus("failed")
          .withMessage(e.getMessage());
    }
  }

  private ValidationResult validateTenantExists(String tenantId) {
    try {
      String discoveryUrl = AZURE_LOGIN_BASE + "/" + tenantId + OPENID_CONFIG_PATH;
      URL url = new URL(discoveryUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);

      int responseCode = conn.getResponseCode();
      if (responseCode == 404) {
        return new ValidationResult()
            .withComponent("azure-tenant")
            .withStatus("failed")
            .withMessage(
                "Azure tenant '"
                    + tenantId
                    + "' not found. Please verify the tenant ID is correct.");
      } else if (responseCode != 200) {
        return new ValidationResult()
            .withComponent("azure-tenant")
            .withStatus("failed")
            .withMessage("Failed to validate tenant. HTTP response: " + responseCode);
      }

      // Parse and validate the discovery document
      try (BufferedReader reader =
          new BufferedReader(
              new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
          response.append(line);
        }

        JsonNode discoveryDoc = JsonUtils.readTree(response.toString());
        if (!discoveryDoc.has("issuer") || !discoveryDoc.has("token_endpoint")) {
          throw new IllegalArgumentException("Invalid discovery document format");
        }
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
      // Attempt to get a token using client credentials grant
      String tokenUrl = AZURE_LOGIN_BASE + "/" + tenantId + TOKEN_ENDPOINT_V2;
      URL url = new URL(tokenUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
      conn.setDoOutput(true);
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);

      // Build request body
      String requestBody =
          String.format(
              "client_id=%s&client_secret=%s&scope=https://graph.microsoft.com/.default&grant_type=client_credentials",
              clientId, clientSecret);

      try (OutputStream os = conn.getOutputStream()) {
        byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
        os.write(input, 0, input.length);
      }

      int responseCode = conn.getResponseCode();
      if (responseCode == 200) {
        // Successfully obtained token
        return new ValidationResult()
            .withComponent("azure-credentials")
            .withStatus("success")
            .withMessage("Azure client credentials validated successfully");
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
        }
      }
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("azure-credentials")
          .withStatus("failed")
          .withMessage("Credentials validation failed: " + e.getMessage());
    }
  }

  private String extractTenantId(String authority) {
    // Extract tenant ID from authority URL
    // Format: https://login.microsoftonline.com/{tenant-id}
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

  private ValidationResult validateClientBasedOnType(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig, String tenantId) {
    try {
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();
      String clientId = authConfig.getClientId();

      if ("public".equals(clientType)) {
        // Public clients don't have secrets, just validate format
        return new ValidationResult()
            .withComponent("azure-public-client")
            .withStatus("success")
            .withMessage(
                "Azure public client validated successfully. Note: Full validation requires user authentication flow.");
      } else if ("confidential".equals(clientType)) {
        // Confidential clients must have secrets
        if (oidcConfig == null || nullOrEmpty(oidcConfig.getSecret())) {
          throw new IllegalArgumentException(
              "Client secret is required for confidential Azure AD clients");
        }
        return validateClientCredentials(tenantId, clientId, oidcConfig.getSecret());
      } else {
        return new ValidationResult()
            .withComponent("azure-client-type")
            .withStatus("failed")
            .withMessage("Unknown client type: " + authConfig.getClientType());
      }
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("azure-client-type")
          .withStatus("failed")
          .withMessage("Client type validation failed: " + e.getMessage());
    }
  }
}
