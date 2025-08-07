package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;

@Slf4j
public class GoogleAuthValidator {

  private static final String GOOGLE_ACCOUNTS_BASE = "https://accounts.google.com";
  private static final String OPENID_CONFIG_PATH = "/.well-known/openid-configuration";
  private static final String EXPECTED_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
  private static final String CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

  public ValidationResult validateGoogleConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {

      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateGooglePublicClient(authConfig);
        case CONFIDENTIAL -> validateGoogleConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Google OAuth validation failed", e);
      return new ValidationResult()
          .withComponent("google")
          .withStatus("failed")
          .withMessage("Google OAuth validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateGooglePublicClient(AuthenticationConfiguration authConfig) {
    try {
      if (!nullOrEmpty(authConfig.getAuthority())
          && !GOOGLE_ACCOUNTS_BASE.equals(authConfig.getAuthority())) {
        return new ValidationResult()
            .withComponent("google-authority")
            .withStatus("failed")
            .withMessage(
                "Google authority must be exactly: "
                    + GOOGLE_ACCOUNTS_BASE
                    + " but got: "
                    + authConfig.getAuthority());
      }

      ValidationResult publicKeyCheck = validatePublicKeyUrls(authConfig.getPublicKeyUrls());
      if (!"success".equals(publicKeyCheck.getStatus())) return publicKeyCheck;

      ValidationResult clientIdCheck = validateClientId(authConfig.getClientId());
      if (!"success".equals(clientIdCheck.getStatus())) return clientIdCheck;

      return new ValidationResult()
          .withComponent("google-public")
          .withStatus("success")
          .withMessage(
              "Google public client validated successfully. Client ID format and configuration values are valid.");
    } catch (Exception e) {
      LOG.error("Google public client validation failed", e);
      return new ValidationResult()
          .withComponent("google-public")
          .withStatus("failed")
          .withMessage("Google public client validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateGoogleConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
        String expectedDiscoveryUri = GOOGLE_ACCOUNTS_BASE + OPENID_CONFIG_PATH;
        if (!expectedDiscoveryUri.equals(oidcConfig.getDiscoveryUri())) {
          return new ValidationResult()
              .withComponent("google-discovery-uri")
              .withStatus("failed")
              .withMessage(
                  "Google discovery URI must be exactly: "
                      + expectedDiscoveryUri
                      + " but got: "
                      + oidcConfig.getDiscoveryUri());
        }
      }

      ValidationResult publicKeyCheck = validatePublicKeyUrls(authConfig.getPublicKeyUrls());
      if (!"success".equals(publicKeyCheck.getStatus())) return publicKeyCheck;

      ValidationResult clientIdCheck = validateClientId(oidcConfig.getId());
      if (!"success".equals(clientIdCheck.getStatus())) return clientIdCheck;

      return new ValidationResult()
          .withComponent("google-confidential")
          .withStatus("success")
          .withMessage(
              "Google confidential client validated successfully. Configuration values and credentials format are valid.");
    } catch (Exception e) {
      LOG.error("Google confidential client validation failed", e);
      return new ValidationResult()
          .withComponent("google-confidential")
          .withStatus("failed")
          .withMessage("Google confidential client validation failed: " + e.getMessage());
    }
  }

  // Reusable helper
  private ValidationResult validatePublicKeyUrls(List<String> publicKeyUrls) {
    if (publicKeyUrls != null && !publicKeyUrls.isEmpty()) {
      boolean hasCorrectUrl = publicKeyUrls.stream().anyMatch(EXPECTED_JWKS_URL::equals);
      if (!hasCorrectUrl) {
        return new ValidationResult()
            .withComponent("google-public-key-urls")
            .withStatus("failed")
            .withMessage("Google public key URLs must contain: " + EXPECTED_JWKS_URL);
      }
    }
    return new ValidationResult().withStatus("success");
  }

  // Reusable helper
  private ValidationResult validateClientId(String clientId) {
    if (nullOrEmpty(clientId) || !clientId.endsWith(CLIENT_ID_SUFFIX)) {
      return new ValidationResult()
          .withComponent("google-client-id")
          .withStatus("failed")
          .withMessage(
              "Invalid Google client ID format. Expected format: {project-id}" + CLIENT_ID_SUFFIX);
    }
    return new ValidationResult().withStatus("success");
  }
}
