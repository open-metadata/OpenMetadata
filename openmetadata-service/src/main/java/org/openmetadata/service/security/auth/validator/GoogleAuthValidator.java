package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.jackson2.JacksonFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.ValidationResult;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class GoogleAuthValidator {

  private static final String GOOGLE_ACCOUNTS_BASE = "https://accounts.google.com";
  private static final String OPENID_CONFIG_PATH = "/.well-known/openid-configuration";
  private static final String EXPECTED_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
  private static final String CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";
  private static final JsonFactory JSON_FACTORY = JacksonFactory.getDefaultInstance();
  private static final String DEFAULT_REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
  private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
  private static final String GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
  private final OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();

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
      String discoveryUri = oidcConfig.getDiscoveryUri();
      if (nullOrEmpty(discoveryUri)) {
        discoveryUri = GOOGLE_ACCOUNTS_BASE + OPENID_CONFIG_PATH;
      }

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

      // Validate against OIDC discovery document
      ValidationResult discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);
      if (!"success".equals(discoveryCheck.getStatus())) {
        return discoveryCheck;
      }

      ValidationResult publicKeyCheck = validatePublicKeyUrls(authConfig.getPublicKeyUrls());
      if (!"success".equals(publicKeyCheck.getStatus())) return publicKeyCheck;

      // Get prompt from the main auth config's oidcConfiguration
      String prompt = oidcConfig.getPrompt();
      String scope = oidcConfig.getScope();
      String accessType = "online";

      ValidationResult credentialsCheck =
          validateGoogleCredentials(
              oidcConfig.getId(),
              oidcConfig.getSecret(),
              oidcConfig.getCallbackUrl(),
              accessType,
              prompt,
              scope);
      if (!"success".equals(credentialsCheck.getStatus())) return credentialsCheck;

      return new ValidationResult()
          .withComponent("google-confidential")
          .withStatus("success")
          .withMessage(
              "Google confidential client validated successfully. Configuration validated against discovery document, and credentials are valid.");
    } catch (Exception e) {
      LOG.error("Google confidential client validation failed", e);
      return new ValidationResult()
          .withComponent("google-confidential")
          .withStatus("failed")
          .withMessage("Google confidential client validation failed: " + e.getMessage());
    }
  }

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

  private ValidationResult validateGoogleCredentials(
      String clientId, String clientSecret, String redirectUri) {
    return validateGoogleCredentials(clientId, clientSecret, redirectUri, null, null, null);
  }

  private ValidationResult validateGoogleCredentials(
      String clientId,
      String clientSecret,
      String redirectUri,
      String accessType,
      String prompt,
      String scope) {
    if (nullOrEmpty(clientId) || nullOrEmpty(clientSecret)) {
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage("Client ID and Client Secret are required for confidential clients");
    }

    //    String actualRedirectUri = nullOrEmpty(redirectUri) ? DEFAULT_REDIRECT_URI : redirectUri;
    //    // Use provided access type or default to "online"
    //    String actualAccessType = nullOrEmpty(accessType) ? "online" : accessType;
    //    // Use provided scope or default to standard OpenID Connect scopes
    //    String actualScope = nullOrEmpty(scope) ? "openid email profile" : scope;

    // Google deprecated 'approval_prompt' in favor of 'prompt' parameter
    // Valid values: none, consent, select_account, or not set
    //    String actualPrompt = prompt; // Don't default to "consent" as it's invalid for
    // approval_prompt

    if ("none".equalsIgnoreCase(prompt)) {
      LOG.warn("Prompt is set to 'none' which may cause interaction_required errors during login");
    }

    try {
      String authUrl =
          generateAuthorizationUrl(clientId, clientSecret, redirectUri, accessType, prompt, scope);
      if (authUrl == null || authUrl.isEmpty()) {
        return new ValidationResult()
            .withComponent("google-credentials")
            .withStatus("failed")
            .withMessage("Failed to generate Google OAuth authorization URL");
      }

      return validateAuthorizationUrl(authUrl, clientId, clientSecret);
    } catch (IllegalArgumentException e) {
      LOG.error("Invalid Google OAuth credentials: {}", e.getMessage());
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage(
              "Invalid Google OAuth credentials. Please verify your Client ID and Client Secret are correct.");
    } catch (Exception e) {
      LOG.error("Error validating Google credentials", e);
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage("Failed to validate Google credentials: " + e.getMessage());
    }
  }

  private String generateAuthorizationUrl(String clientId, String clientSecret, String redirectUri)
      throws Exception {
    return generateAuthorizationUrl(
        clientId, clientSecret, redirectUri, "online", null, "openid email profile");
  }

  private String generateAuthorizationUrl(
      String clientId,
      String clientSecret,
      String redirectUri,
      String accessType,
      String prompt,
      String scope)
      throws Exception {
    HttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();

    GoogleClientSecrets clientSecrets = new GoogleClientSecrets();
    GoogleClientSecrets.Details details = new GoogleClientSecrets.Details();
    details.setClientId(clientId);
    details.setClientSecret(clientSecret);
    clientSecrets.setWeb(details);

    // Parse scopes from the space-separated string
    List<String> scopes = new ArrayList<>();
    if (!nullOrEmpty(scope)) {
      String[] scopeArray = scope.split(" ");
      scopes.addAll(Arrays.asList(scopeArray));
    }

    GoogleAuthorizationCodeFlow.Builder flowBuilder =
        new GoogleAuthorizationCodeFlow.Builder(httpTransport, JSON_FACTORY, clientSecrets, scopes)
            .setAccessType(accessType);

    // Google deprecated 'approval_prompt' and now uses URL parameter 'prompt'
    // The GoogleAuthorizationCodeFlow still uses setApprovalPrompt but it maps to 'prompt' in the
    // URL
    // Valid values for modern Google OAuth: none, consent, select_account
    if (!nullOrEmpty(prompt)) {
      flowBuilder.setApprovalPrompt(prompt);
    }
    GoogleAuthorizationCodeFlow flow = flowBuilder.build();
    return flow.newAuthorizationUrl().setRedirectUri(redirectUri).build();
  }

  private ValidationResult validateAuthorizationUrl(
      String authUrl, String clientId, String clientSecret) {
    LOG.debug("Generated Google OAuth authorization URL for validation: {}", authUrl);

    try {
      ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.getNoRedirect(authUrl);
      int statusCode = response.getStatusCode();
      String locationHeader = response.getLocationHeader();

      LOG.debug("Google OAuth validation response status: {}", statusCode);
      LOG.debug("Location header: {}", locationHeader);

      if (statusCode == 302 || statusCode == 303) {
        if (locationHeader == null) {
          LOG.warn("Redirect response without Location header");
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("failed")
              .withMessage(
                  "Unable to validate Google OAuth credentials. No redirect location provided.");
        }
        return analyzeRedirectLocation(locationHeader, clientId, clientSecret);
      } else {
        LOG.warn("Unexpected status code from Google OAuth: {}", statusCode);
        return new ValidationResult()
            .withComponent("google-credentials")
            .withStatus("failed")
            .withMessage(
                "Unable to validate Google OAuth credentials. Unexpected response status: "
                    + statusCode);
      }
    } catch (Exception httpEx) {
      LOG.error("HTTP request to Google OAuth failed", httpEx);
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage("Failed to connect to Google OAuth service: " + httpEx.getMessage());
    }
  }

  private ValidationResult analyzeRedirectLocation(
      String locationHeader, String clientId, String clientSecret) {
    LocationAnalysis analysis = analyzeLocationHeader(locationHeader);

    // Check for specific error types in the location header - prioritize prompt errors
    if (locationHeader.contains("approval_prompt") || locationHeader.contains("prompt")) {
      LOG.error("Invalid prompt parameter detected in redirect: {}", locationHeader);
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage(
              "Invalid prompt parameter. Google OAuth only accepts: 'none', 'consent', 'select_account', or leave it empty. Current value appears to be invalid.");
    }

    if (analysis.hasInvalidRequest) {
      // Check if it's actually an invalid_request due to bad parameters
      if (locationHeader.contains("invalid_request")) {
        LOG.error("Invalid request parameters detected in redirect: {}", locationHeader);
        return new ValidationResult()
            .withComponent("google-credentials")
            .withStatus("failed")
            .withMessage(
                "Invalid request parameters. Please check your OAuth configuration (client ID, redirect URI, prompt value, etc.).");
      }
    }

    // Check if this is an OAuth error page (indicates invalid credentials)
    if (analysis.hasOAuthError && analysis.hasAuthError) {
      LOG.error("OAuth error detected in redirect, invalid credentials: {}", locationHeader);
      return createInvalidClientIdResult();
    }

    if (analysis.hasInvalidClient || analysis.hasUnauthorizedClient) {
      LOG.error("Invalid client detected in redirect: {}", locationHeader);
      return createInvalidClientIdResult();
    }

    if (analysis.hasServerError) {
      LOG.error("Google server error during validation");
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage("Google server error. Please try again later.");
    }

    // Check for redirect URI mismatch - this should be a failure
    if (analysis.hasRedirectUriMismatch) {
      LOG.error("Redirect URI mismatch detected: {}", locationHeader);
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage(
              "Redirect URI mismatch. Please verify the redirect URI is correctly configured in Google Cloud Console.");
    }

    if (analysis.hasInvalidRequest && !analysis.hasInvalidClient) {
      // Check if the invalid_request is due to prompt parameter
      if (locationHeader.contains("Invalid parameter value for approval_prompt")
          || locationHeader.contains("invalid_request")
          || locationHeader.contains("prompt")
          || locationHeader.contains("approval_prompt")) {
        LOG.error("Invalid request parameters detected: {}", locationHeader);

        // More specific error messages based on the error type
        if (locationHeader.contains("approval_prompt") || locationHeader.contains("prompt")) {
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("failed")
              .withMessage(
                  "Invalid prompt parameter. Google OAuth only accepts: 'none', 'consent', 'select_account', or leave it empty.");
        } else {
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("failed")
              .withMessage(
                  "Invalid request parameters. Please check your OAuth configuration (client ID, redirect URI, prompt value, etc.).");
        }
      }
      LOG.debug(
          "Valid client detected with invalid_request error (likely due to validation context)");
      return validateClientSecret(clientId, clientSecret);
    }

    if (analysis.hasAccountsGoogle && analysis.hasSignInFlow) {
      LOG.debug("Redirect to Google sign-in flow, client is valid");
      return validateClientSecret(clientId, clientSecret);
    }

    if (analysis.hasAccountsGoogle && !analysis.hasOAuthError) {
      LOG.debug("Redirect to Google accounts without error, client ID is valid");
      return validateClientSecret(clientId, clientSecret);
    }

    LOG.warn("Unexpected redirect location: {}", locationHeader);
    return new ValidationResult()
        .withComponent("google-credentials")
        .withStatus("failed")
        .withMessage("Unable to validate Google OAuth credentials. Unexpected redirect.");
  }

  private static class LocationAnalysis {
    final boolean hasOAuthError;
    final boolean hasAuthError;
    final boolean hasInvalidClient;
    final boolean hasUnauthorizedClient;
    final boolean hasInvalidRequest;
    final boolean hasRedirectUriMismatch;
    final boolean hasServerError;
    final boolean hasAccountsGoogle;
    final boolean hasSignInFlow;

    LocationAnalysis(
        boolean hasOAuthError,
        boolean hasAuthError,
        boolean hasInvalidClient,
        boolean hasUnauthorizedClient,
        boolean hasInvalidRequest,
        boolean hasRedirectUriMismatch,
        boolean hasServerError,
        boolean hasAccountsGoogle,
        boolean hasSignInFlow) {
      this.hasOAuthError = hasOAuthError;
      this.hasAuthError = hasAuthError;
      this.hasInvalidClient = hasInvalidClient;
      this.hasUnauthorizedClient = hasUnauthorizedClient;
      this.hasInvalidRequest = hasInvalidRequest;
      this.hasRedirectUriMismatch = hasRedirectUriMismatch;
      this.hasServerError = hasServerError;
      this.hasAccountsGoogle = hasAccountsGoogle;
      this.hasSignInFlow = hasSignInFlow;
    }
  }

  private LocationAnalysis analyzeLocationHeader(String locationHeader) {
    return new LocationAnalysis(
        locationHeader.contains("/signin/oauth/error"),
        locationHeader.contains("authError="),
        locationHeader.contains("error=invalid_client")
            || locationHeader.contains("pbnZhbGlkX2NsaWVudB")
            || locationHeader.contains("Cg5pbnZhbGlkX2NsaWVudB"),
        locationHeader.contains("error=unauthorized_client"),
        locationHeader.contains("error=invalid_request"),
        locationHeader.contains("error=redirect_uri_mismatch"),
        locationHeader.contains("error=server_error"),
        locationHeader.contains("accounts.google.com"),
        locationHeader.contains("/signin/oauth/consent")
            || locationHeader.contains("/signin/oauth/identifier")
            || locationHeader.contains("/signin/v2/identifier"));
  }

  private ValidationResult createInvalidClientIdResult() {
    return new ValidationResult()
        .withComponent("google-credentials")
        .withStatus("failed")
        .withMessage("Invalid Google OAuth credentials. Client ID not recognized by Google.");
  }

  private ValidationResult validateClientSecret(String clientId, String clientSecret) {
    try {
      LOG.debug("Validating client secret using token endpoint");

      String formData =
          "grant_type=authorization_code"
              + "&code=invalid_authorization_code_for_validation"
              + "&client_id="
              + java.net.URLEncoder.encode(clientId, "UTF-8")
              + "&client_secret="
              + java.net.URLEncoder.encode(clientSecret, "UTF-8")
              + "&redirect_uri="
              + java.net.URLEncoder.encode(DEFAULT_REDIRECT_URI, "UTF-8");

      ValidationHttpUtil.HttpResponseData response =
          ValidationHttpUtil.postForm(GOOGLE_TOKEN_URL, formData);

      String responseBody = response.getBody();
      int statusCode = response.getStatusCode();

      LOG.debug("Token endpoint validation response: status={}, body={}", statusCode, responseBody);

      if (statusCode == 400) {
        if (responseBody.contains("invalid_grant")) {
          // This is expected - the code is invalid but the client credentials are valid
          LOG.debug("Client secret validated successfully (invalid_grant response as expected)");
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("success")
              .withMessage(
                  "Google OAuth credentials validated successfully. Both Client ID and Client Secret are valid.");
        } else if (responseBody.contains("invalid_client")) {
          // Invalid client secret
          LOG.error("Invalid client secret detected");
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("failed")
              .withMessage(
                  "Invalid Google OAuth Client Secret. The Client ID is valid but the Client Secret is incorrect.");
        } else if (responseBody.contains("unauthorized_client")) {
          LOG.error("Unauthorized client detected");
          return new ValidationResult()
              .withComponent("google-credentials")
              .withStatus("failed")
              .withMessage(
                  "Unauthorized Google OAuth client. Please verify your client configuration.");
        }
      } else if (statusCode == 401) {
        LOG.error("Authentication failed at token endpoint");
        return new ValidationResult()
            .withComponent("google-credentials")
            .withStatus("failed")
            .withMessage(
                "Invalid Google OAuth Client Secret. Authentication failed at token endpoint.");
      }

      // Unexpected response
      LOG.warn("Unexpected response from token endpoint: {}", statusCode);
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage(
              "Unable to validate Client Secret. Unexpected response from Google token endpoint.");

    } catch (Exception e) {
      LOG.error("Error validating client secret", e);
      return new ValidationResult()
          .withComponent("google-credentials")
          .withStatus("failed")
          .withMessage("Failed to validate Client Secret: " + e.getMessage());
    }
  }
}
