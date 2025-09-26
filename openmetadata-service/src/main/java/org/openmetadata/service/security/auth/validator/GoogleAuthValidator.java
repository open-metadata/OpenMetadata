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
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder;
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

  public FieldError validateGoogleConfiguration(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {

      return switch (authConfig.getClientType()) {
        case PUBLIC -> validateGooglePublicClient(authConfig);
        case CONFIDENTIAL -> validateGoogleConfidentialClient(authConfig, oidcConfig);
      };
    } catch (Exception e) {
      LOG.error("Google OAuth validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Google OAuth validation failed: " + e.getMessage());
    }
  }

  private FieldError validateGooglePublicClient(AuthenticationConfiguration authConfig) {
    try {
      if (!nullOrEmpty(authConfig.getAuthority())
          && !GOOGLE_ACCOUNTS_BASE.equals(authConfig.getAuthority())) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_AUTHORITY,
            "Google authority must be exactly: "
                + GOOGLE_ACCOUNTS_BASE
                + " but got: "
                + authConfig.getAuthority());
      }

      FieldError publicKeyCheck = validatePublicKeyUrls(authConfig.getPublicKeyUrls());
      if (publicKeyCheck != null) return publicKeyCheck;

      FieldError clientIdCheck = validateClientId(authConfig.getClientId());
      if (clientIdCheck != null) return clientIdCheck;

      // Return null for success (no error)
      return null;
    } catch (Exception e) {
      LOG.error("Google public client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Google public client validation failed: " + e.getMessage());
    }
  }

  private FieldError validateGoogleConfidentialClient(
      AuthenticationConfiguration authConfig, OidcClientConfig oidcConfig) {
    try {
      String discoveryUri = oidcConfig.getDiscoveryUri();
      if (nullOrEmpty(discoveryUri)) {
        discoveryUri = GOOGLE_ACCOUNTS_BASE + OPENID_CONFIG_PATH;
      }

      if (!nullOrEmpty(oidcConfig.getDiscoveryUri())) {
        String expectedDiscoveryUri = GOOGLE_ACCOUNTS_BASE + OPENID_CONFIG_PATH;
        if (!expectedDiscoveryUri.equals(oidcConfig.getDiscoveryUri())) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_DISCOVERY_URI,
              "Google discovery URI must be exactly: "
                  + expectedDiscoveryUri
                  + " but got: "
                  + oidcConfig.getDiscoveryUri());
        }
      }

      // Validate against OIDC discovery document
      FieldError discoveryCheck =
          discoveryValidator.validateAgainstDiscovery(discoveryUri, authConfig, oidcConfig);
      if (discoveryCheck != null) {
        return discoveryCheck;
      }

      FieldError publicKeyCheck = validatePublicKeyUrls(authConfig.getPublicKeyUrls());
      if (publicKeyCheck != null) return publicKeyCheck;

      // Get prompt from the main auth config's oidcConfiguration
      String prompt = oidcConfig.getPrompt();
      String scope = oidcConfig.getScope();
      String accessType = "online";

      // Validate prompt parameter for Google
      if (!nullOrEmpty(prompt)) {
        // Google only supports: consent, select_account, or empty
        // Google does NOT support 'none' (even though it's in OpenID Connect spec)
        if ("none".equalsIgnoreCase(prompt)) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_PROMPT,
              "Google OAuth does not support prompt='none'. Valid values are: 'consent', 'select_account', or leave it empty.");
        }
        if (!"consent".equalsIgnoreCase(prompt) && !"select_account".equalsIgnoreCase(prompt)) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_PROMPT,
              "Invalid prompt value for Google OAuth: '"
                  + prompt
                  + "'. Valid values are: 'consent', 'select_account', or leave it empty.");
        }
      }

      FieldError credentialsCheck =
          validateGoogleCredentials(
              oidcConfig.getId(),
              oidcConfig.getSecret(),
              oidcConfig.getCallbackUrl(),
              accessType,
              prompt,
              scope);
      if (credentialsCheck != null) return credentialsCheck;
      return null;
    } catch (Exception e) {
      LOG.error("Google confidential client validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "", "Google confidential client validation failed: " + e.getMessage());
    }
  }

  private FieldError validatePublicKeyUrls(List<String> publicKeyUrls) {
    if (publicKeyUrls != null && !publicKeyUrls.isEmpty()) {
      boolean hasCorrectUrl = publicKeyUrls.stream().anyMatch(EXPECTED_JWKS_URL::equals);
      if (!hasCorrectUrl) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.AUTH_PUBLIC_KEY_URLS,
            "PublicKeyUrl validation failed");
      }
    }
    return null;
  }

  // Reusable helper
  private FieldError validateClientId(String clientId) {
    if (nullOrEmpty(clientId) || !clientId.endsWith(CLIENT_ID_SUFFIX)) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.AUTH_CLIENT_ID, "Invalid client Id");
    }
    return null;
  }

  //  private FieldError validateGoogleCredentials(
  //      String clientId, String clientSecret, String redirectUri) {
  //    return validateGoogleCredentials(clientId, clientSecret, redirectUri, null, null, null);
  //  }

  private FieldError validateGoogleCredentials(
      String clientId,
      String clientSecret,
      String redirectUri,
      String accessType,
      String prompt,
      String scope) {
    if (nullOrEmpty(clientId) || nullOrEmpty(clientSecret)) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
          "Client ID and Client Secret are required for confidential clients");
    }

    //    String actualRedirectUri = nullOrEmpty(redirectUri) ? DEFAULT_REDIRECT_URI : redirectUri;
    //    // Use provided access type or default to "online"
    //    String actualAccessType = nullOrEmpty(accessType) ? "online" : accessType;
    //    // Use provided scope or default to standard OpenID Connect scopes
    //    String actualScope = nullOrEmpty(scope) ? "openid email profile" : scope;

    try {
      String authUrl =
          generateAuthorizationUrl(clientId, clientSecret, redirectUri, accessType, prompt, scope);
      if (authUrl == null || authUrl.isEmpty()) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
            "Client ID and Client Secret are required for confidential clients");
      }

      return validateAuthorizationUrl(authUrl, clientId, clientSecret);
    } catch (IllegalArgumentException e) {
      LOG.error("Invalid Google OAuth credentials: {}", e.getMessage());
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID, "Invalid credentials");
    } catch (Exception e) {
      LOG.error("Error validating Google credentials", e);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID, "Exception occured while validation");
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

    // Don't use setApprovalPrompt as it sets the deprecated 'approval_prompt' parameter
    // We'll add the modern 'prompt' parameter directly to the URL
    GoogleAuthorizationCodeFlow flow = flowBuilder.build();

    // Build the authorization URL
    com.google.api.client.auth.oauth2.AuthorizationCodeRequestUrl authorizationUrl =
        flow.newAuthorizationUrl().setRedirectUri(redirectUri);

    // Add the modern 'prompt' parameter if specified
    if (!nullOrEmpty(prompt)) {
      authorizationUrl.set("prompt", prompt);
    }

    return authorizationUrl.build();
  }

  private FieldError validateAuthorizationUrl(
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
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
              "Unable to validate Google OAuth credentials. No Location header in redirect.");
        }
        return analyzeRedirectLocation(locationHeader, clientId, clientSecret);
      } else {
        LOG.warn("Unexpected status code from Google OAuth: {}", statusCode);
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
            "Unable to validate Google OAuth credentials. Exception occured.");
      }
    } catch (Exception httpEx) {
      LOG.error("HTTP request to Google OAuth failed", httpEx);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
          "Unable to validate Google OAuth credentials.");
    }
  }

  private FieldError analyzeRedirectLocation(
      String locationHeader, String clientId, String clientSecret) {
    LocationAnalysis analysis = analyzeLocationHeader(locationHeader);

    // Check for specific error types in the location header - prioritize prompt errors
    if (locationHeader.contains("Invalid parameter value for prompt")
        || locationHeader.contains("Invalid parameter value for approval_prompt")) {
      LOG.error("Invalid prompt parameter detected in redirect: {}", locationHeader);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_PROMPT,
          "Invalid prompt parameter. Google OAuth only accepts: 'none', 'consent', 'select_account', or leave it empty. Current value appears to be invalid.");
    }

    if (analysis.hasInvalidRequest) {
      if (locationHeader.contains("invalid_request")) {
        LOG.error("Invalid request parameters detected in redirect: {}", locationHeader);
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
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
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
          "Unable to validate Google OAuth credentials.");
    }

    // Check for redirect URI mismatch - this should be a failure
    if (analysis.hasRedirectUriMismatch) {

      LOG.error("Redirect URI mismatch detected: {}", locationHeader);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CALLBACK_URL,
          "Redirect URI mismatch. Please verify the redirect URI is correctly configured in Google Cloud Console.");
    }

    if (analysis.hasInvalidRequest && !analysis.hasInvalidClient) {
      // Check if the invalid_request is due to prompt parameter
      if (locationHeader.contains("Invalid parameter value for prompt")
          || locationHeader.contains("Invalid parameter value for approval_prompt")) {
        LOG.error("Invalid prompt parameter value detected: {}", locationHeader);
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_PROMPT, "Invalid prompt");
      }
      LOG.debug(
          "Valid client detected with invalid_request error (likely due to validation context)");
      return validateClientSecret(clientId, clientSecret);
    }

    // Check for interaction_required error (used by other OIDC providers with prompt=none)
    // Note: Google doesn't support prompt=none, so immediate_failed is an actual error for Google
    if (locationHeader.contains("error=interaction_required")
        || locationHeader.contains("error=login_required")
        || locationHeader.contains("error=consent_required")) {
      LOG.debug(
          "Interaction/login/consent required error detected, may be valid for other providers");
      return validateClientSecret(clientId, clientSecret);
    }

    // immediate_failed indicates invalid prompt parameter for Google
    if (locationHeader.contains("error=immediate_failed")) {
      LOG.error("Google returned immediate_failed error - likely invalid prompt parameter");
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_PROMPT,
          "Invalid prompt parameter. Google does not support 'none'. Use 'consent', 'select_account', or leave it empty.");
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
    return ValidationErrorBuilder.createFieldError(
        ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
        "Unable to validate google client credentials");
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

  private FieldError createInvalidClientIdResult() {
    return ValidationErrorBuilder.createFieldError(
        ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_ID,
        "Invalid Google OAuth credentials. Client ID not recognized by Google.");
  }

  private FieldError validateClientSecret(String clientId, String clientSecret) {
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
          return null;
        } else if (responseBody.contains("invalid_client")
            || responseBody.contains("unauthorized_client")) {
          // Invalid client secret
          LOG.error("Invalid client secret detected");
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, "Invalid Google client secret");
        }
      } else if (statusCode == 401) {
        LOG.error("Authentication failed at token endpoint");
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
            "Invalid Google OAuth client secret.");
      }

      LOG.warn("Unexpected response from token endpoint: {}", statusCode);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET,
          "Unable to validate client secret.");

    } catch (Exception e) {
      LOG.error("Error validating client secret", e);
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.OIDC_CLIENT_SECRET, "Error validating client secret");
    }
  }
}
