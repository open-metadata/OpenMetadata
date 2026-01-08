package org.openmetadata.mcp.server.auth.handlers;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.AuthorizationParams;
import org.openmetadata.mcp.auth.InvalidRedirectUriException;
import org.openmetadata.mcp.auth.InvalidScopeException;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.exception.AuthorizeException;
import org.openmetadata.mcp.server.auth.model.AuthorizationErrorResponse;
import org.openmetadata.mcp.server.auth.util.UriUtils;

/**
 * Handler for OAuth authorization requests.
 */
public class AuthorizationHandler {

  private final OAuthAuthorizationServerProvider provider;

  public AuthorizationHandler(OAuthAuthorizationServerProvider provider) {
    this.provider = provider;
  }

  /**
   * Handle an authorization request.
   * @param params The request parameters
   * @return A CompletableFuture that resolves to a response object containing either a
   * redirect URL or an error
   */
  public CompletableFuture<AuthorizationResponse> handle(Map<String, String> params) {
    String clientId = params.get("client_id");
    String redirectUriStr = params.get("redirect_uri");
    String responseType = params.get("response_type");
    String codeChallenge = params.get("code_challenge");
    String codeChallengeMethod = params.get("code_challenge_method");
    String state = params.get("state");
    String scope = params.get("scope");

    // Validate required parameters
    if (clientId == null || responseType == null || codeChallenge == null) {
      return CompletableFuture.completedFuture(
          createErrorResponse("invalid_request", "Missing required parameters", state, null));
    }

    // Validate response type
    if (!"code".equals(responseType)) {
      return CompletableFuture.completedFuture(
          createErrorResponse(
              "unsupported_response_type", "Only 'code' response type is supported", state, null));
    }

    // Validate code challenge method
    if (codeChallengeMethod != null && !"S256".equals(codeChallengeMethod)) {
      return CompletableFuture.completedFuture(
          createErrorResponse(
              "invalid_request", "Only 'S256' code challenge method is supported", state, null));
    }

    // Get client information
    return provider
        .getClient(clientId)
        .thenCompose(
            client -> {
              if (client == null) {
                return CompletableFuture.completedFuture(
                    createErrorResponse("invalid_request", "Client ID not found", state, null));
              }

              // Validate redirect URI
              URI redirectUri;
              try {
                URI tempUri = redirectUriStr != null ? URI.create(redirectUriStr) : null;
                redirectUri = client.validateRedirectUri(tempUri);
              } catch (InvalidRedirectUriException e) {
                return CompletableFuture.completedFuture(
                    createErrorResponse("invalid_request", e.getMessage(), state, null));
              }

              // Validate scope
              List<String> scopes;
              try {
                scopes = client.validateScope(scope);
              } catch (InvalidScopeException e) {
                return CompletableFuture.completedFuture(
                    createErrorResponse("invalid_scope", e.getMessage(), state, redirectUri));
              }

              // Setup authorization parameters
              AuthorizationParams authParams = new AuthorizationParams();
              authParams.setState(state);
              authParams.setScopes(scopes);
              authParams.setCodeChallenge(codeChallenge);
              authParams.setRedirectUri(redirectUri);
              authParams.setRedirectUriProvidedExplicitly(redirectUriStr != null);

              // Let the provider handle the authorization
              try {
                return provider
                    .authorize(client, authParams)
                    .thenApply(
                        result -> {
                          // Check if result is a full redirect URL (SSO flow) or an auth code
                          if (result.startsWith("http://") || result.startsWith("https://")) {
                            // SSO redirect URL - use directly
                            return new AuthorizationResponse(result, true, null);
                          } else if ("SSO_REDIRECT_INITIATED".equals(result)) {
                            // SSO redirect was already sent by provider - return empty response
                            return new AuthorizationResponse(null, false, null);
                          } else if ("LOGIN_FORM_DISPLAYED".equals(result)) {
                            // Basic Auth login form already rendered - return empty response
                            return new AuthorizationResponse(null, false, null);
                          } else if ("CODE_DISPLAYED".equals(result)) {
                            // Basic Auth code display already rendered - return empty response
                            return new AuthorizationResponse(null, false, null);
                          } else {
                            // Authorization code - construct callback URL
                            Map<String, String> queryParams = new java.util.HashMap<>();
                            queryParams.put("code", result);
                            if (authParams.getState() != null) {
                              queryParams.put("state", authParams.getState());
                            }
                            String callbackUrl =
                                UriUtils.constructRedirectUri(
                                    authParams.getRedirectUri().toString(), queryParams);
                            return new AuthorizationResponse(callbackUrl, true, null);
                          }
                        })
                    .exceptionally(
                        ex -> {
                          if (ex.getCause() instanceof AuthorizeException) {
                            AuthorizeException authEx = (AuthorizeException) ex.getCause();
                            return createErrorResponse(
                                authEx.getError(),
                                authEx.getErrorDescription(),
                                state,
                                redirectUri);
                          } else {
                            return createErrorResponse(
                                "server_error", "An unexpected error occurred", state, redirectUri);
                          }
                        });
              } catch (AuthorizeException e) {
                return CompletableFuture.completedFuture(
                    createErrorResponse(e.getError(), e.getErrorDescription(), state, redirectUri));
              }
            });
  }

  /**
   * Create an error response.
   * @param error The error code
   * @param errorDescription The error description
   * @param state The state parameter
   * @param redirectUri The redirect URI, or null if not available
   * @return An AuthorizationResponse containing the error
   */
  private AuthorizationResponse createErrorResponse(
      String error, String errorDescription, String state, URI redirectUri) {

    AuthorizationErrorResponse errorResponse =
        new AuthorizationErrorResponse(error, errorDescription, state);

    if (redirectUri != null) {
      // Redirect with error parameters
      String redirectUrl =
          UriUtils.constructRedirectUri(redirectUri.toString(), errorResponse.toQueryParams());

      return new AuthorizationResponse(redirectUrl, true, errorResponse);
    } else {
      // Direct error response
      return new AuthorizationResponse(null, false, errorResponse);
    }
  }

  /**
   * Response object for authorization requests.
   */
  public static class AuthorizationResponse {

    private final String redirectUrl;

    private final boolean isRedirect;

    private final AuthorizationErrorResponse error;

    public AuthorizationResponse(
        String redirectUrl, boolean isRedirect, AuthorizationErrorResponse error) {
      this.redirectUrl = redirectUrl;
      this.isRedirect = isRedirect;
      this.error = error;
    }

    public String getRedirectUrl() {
      return redirectUrl;
    }

    public boolean isRedirect() {
      return isRedirect;
    }

    public AuthorizationErrorResponse getError() {
      return error;
    }

    public boolean isSuccess() {
      return error == null;
    }
  }
}
