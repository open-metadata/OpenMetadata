package org.openmetadata.mcp.server.transport;

import static org.openmetadata.service.socket.SocketAddressFilter.validatePrefixedTokenRequest;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.server.McpTransportContextExtractor;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletionException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.AuthorizationCode;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthClientMetadata;
import org.openmetadata.mcp.auth.OAuthMetadata;
import org.openmetadata.mcp.auth.OAuthToken;
import org.openmetadata.mcp.auth.ProtectedResourceMetadata;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.auth.exception.TokenException;
import org.openmetadata.mcp.server.auth.handlers.AuthorizationHandler;
import org.openmetadata.mcp.server.auth.handlers.RegistrationHandler;
import org.openmetadata.mcp.server.auth.handlers.RevocationHandler;
import org.openmetadata.mcp.server.auth.middleware.ClientAuthenticator;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Extended transport provider that handles both MCP messages and OAuth routes. This class
 * integrates OAuth authentication routes directly into the transport layer It also adds
 * authentication middleware to validate requests for SSE and message endpoints.
 * Implements ConfigurationChangeListener to dynamically update CORS origins without restart.
 */
@Slf4j
public class OAuthHttpStatelessServerTransportProvider extends HttpServletStatelessServerTransport
    implements SecurityConfigurationManager.ConfigurationChangeListener {

  private volatile OAuthMetadata oauthMetadata;

  private volatile ProtectedResourceMetadata protectedResourceMetadata;

  private final AuthorizationHandler authorizationHandler;

  private final RegistrationHandler registrationHandler;

  private final RevocationHandler revocationHandler;

  private final ClientAuthenticator clientAuthenticator;

  private final ObjectMapper objectMapper;

  private volatile URI resourceMetadataUrl;

  private final JwtFilter jwtFilter;

  private volatile List<String> allowedOrigins;

  private final OAuthAuthorizationServerProvider authProvider;

  private final String mcpEndpoint;

  private volatile org.openmetadata.mcp.server.auth.handlers.BasicAuthLoginServlet
      basicAuthLoginServlet;

  // In-memory rate limiters for registration and token endpoints.
  // These are per-JVM-instance; in clustered deployments the effective limit is N × limit per hour.
  // For multi-node production deployments, consider database-backed rate limiting.
  private static final int REGISTRATION_MAX_PER_HOUR = 10;
  private static final int TOKEN_MAX_PER_MINUTE = 30;
  private static final int MAX_RATE_LIMIT_ENTRIES = 10_000;
  private static final java.util.regex.Pattern IP_PATTERN =
      java.util.regex.Pattern.compile("[0-9a-fA-F.:]+");
  private final java.util.concurrent.ConcurrentHashMap<
          String, java.util.concurrent.atomic.AtomicInteger>
      registrationAttempts = new java.util.concurrent.ConcurrentHashMap<>();
  private volatile long registrationWindowStart = System.currentTimeMillis();
  private final java.util.concurrent.ConcurrentHashMap<
          String, java.util.concurrent.atomic.AtomicInteger>
      tokenAttempts = new java.util.concurrent.ConcurrentHashMap<>();
  private volatile long tokenWindowStart = System.currentTimeMillis();

  /**
   * Creates a new OAuthHttpServletSseServerTransportProvider.
   * @param objectMapper The JSON object mapper
   * @param baseUrl The base URL of the server
   * @param mcpEndpoint The MCP endpoint path
   * @param contextExtractor The context extractor
   * @param authProvider The OAuth authorization server provider
   * @param allowedOrigins List of allowed origins for CORS
   */
  public OAuthHttpStatelessServerTransportProvider(
      ObjectMapper objectMapper,
      String baseUrl,
      String mcpEndpoint,
      McpTransportContextExtractor<HttpServletRequest> contextExtractor,
      OAuthAuthorizationServerProvider authProvider,
      List<String> allowedOrigins) {
    super(objectMapper, mcpEndpoint, contextExtractor);
    this.objectMapper = objectMapper;
    this.authProvider = authProvider;
    this.mcpEndpoint = mcpEndpoint;
    LOG.info("Initializing OAuth transport with base URL: {}", baseUrl);

    this.clientAuthenticator = new ClientAuthenticator(authProvider);

    // Create Authorization Server metadata (RFC 8414)
    // Endpoints are relative to /mcp prefix since servlet is mounted there
    List<String> supportedScopes = getSupportedScopesForProvider();
    OAuthMetadata metadata = new OAuthMetadata();
    metadata.setIssuer(URI.create(baseUrl + mcpEndpoint));
    metadata.setAuthorizationEndpoint(URI.create(baseUrl + mcpEndpoint + "/authorize"));
    metadata.setTokenEndpoint(URI.create(baseUrl + mcpEndpoint + "/token"));
    metadata.setRegistrationEndpoint(URI.create(baseUrl + mcpEndpoint + "/register"));
    metadata.setScopesSupported(supportedScopes);
    metadata.setResponseTypesSupported(List.of("code"));
    metadata.setGrantTypesSupported(List.of("authorization_code", "refresh_token"));
    metadata.setTokenEndpointAuthMethodsSupported(List.of("client_secret_post"));
    metadata.setCodeChallengeMethodsSupported(List.of("S256"));
    metadata.setRevocationEndpoint(URI.create(baseUrl + mcpEndpoint + "/revoke"));
    metadata.setRevocationEndpointAuthMethodsSupported(List.of("client_secret_post"));

    // Create Protected Resource metadata (RFC 9728) - MCP requirement
    this.resourceMetadataUrl =
        URI.create(baseUrl + mcpEndpoint + "/.well-known/oauth-protected-resource");
    ProtectedResourceMetadata protectedResourceMetadata = new ProtectedResourceMetadata();
    protectedResourceMetadata.setResource(URI.create(baseUrl + mcpEndpoint));
    protectedResourceMetadata.setAuthorizationServers(List.of(URI.create(baseUrl + mcpEndpoint)));
    protectedResourceMetadata.setScopesSupported(supportedScopes);
    protectedResourceMetadata.setResourceDocumentation(URI.create(baseUrl + "/docs"));

    this.oauthMetadata = metadata;
    this.protectedResourceMetadata = protectedResourceMetadata;
    this.authorizationHandler = new AuthorizationHandler(authProvider);
    this.registrationHandler = new RegistrationHandler(new OAuthClientRepository());
    this.revocationHandler = new RevocationHandler(new OAuthTokenRepository());

    this.jwtFilter =
        new JwtFilter(
            SecurityConfigurationManager.getCurrentAuthConfig(),
            SecurityConfigurationManager.getCurrentAuthzConfig());

    this.allowedOrigins = allowedOrigins;

    // Register as configuration change listener for dynamic CORS updates
    SecurityConfigurationManager.getInstance().addConfigurationChangeListener(this);
    LOG.info(
        "OAuth transport initialized with base URL: {}, CORS origins: {}", baseUrl, allowedOrigins);
  }

  public void setBasicAuthLoginServlet(
      org.openmetadata.mcp.server.auth.handlers.BasicAuthLoginServlet servlet) {
    this.basicAuthLoginServlet = servlet;
  }

  /**
   * ConfigurationChangeListener implementation.
   * Called when configuration is reloaded, updates CORS origins dynamically without restart.
   */
  @Override
  public void onConfigurationChanged(
      org.openmetadata.schema.api.security.AuthenticationConfiguration authConfig,
      org.openmetadata.schema.api.security.AuthorizerConfiguration authzConfig,
      org.openmetadata.schema.api.configuration.MCPConfiguration mcpConfig) {
    if (mcpConfig != null) {
      if (mcpConfig.getAllowedOrigins() != null) {
        updateAllowedOrigins(mcpConfig.getAllowedOrigins());
        LOG.info(
            "Updated CORS origins from configuration reload: {}", mcpConfig.getAllowedOrigins());
      }
      if (mcpConfig.getBaseUrl() != null && !mcpConfig.getBaseUrl().isEmpty()) {
        rebuildMetadata(mcpConfig.getBaseUrl());
      }
    }
  }

  private void rebuildMetadata(String baseUrl) {
    LOG.info("Rebuilding OAuth metadata with new base URL: {}", baseUrl);
    List<String> supportedScopes = getSupportedScopesForProvider();

    OAuthMetadata newMetadata = new OAuthMetadata();
    newMetadata.setIssuer(URI.create(baseUrl + mcpEndpoint));
    newMetadata.setAuthorizationEndpoint(URI.create(baseUrl + mcpEndpoint + "/authorize"));
    newMetadata.setTokenEndpoint(URI.create(baseUrl + mcpEndpoint + "/token"));
    newMetadata.setRegistrationEndpoint(URI.create(baseUrl + mcpEndpoint + "/register"));
    newMetadata.setScopesSupported(supportedScopes);
    newMetadata.setResponseTypesSupported(List.of("code"));
    newMetadata.setGrantTypesSupported(List.of("authorization_code", "refresh_token"));
    newMetadata.setTokenEndpointAuthMethodsSupported(List.of("client_secret_post"));
    newMetadata.setCodeChallengeMethodsSupported(List.of("S256"));
    newMetadata.setRevocationEndpoint(URI.create(baseUrl + mcpEndpoint + "/revoke"));
    newMetadata.setRevocationEndpointAuthMethodsSupported(List.of("client_secret_post"));
    this.oauthMetadata = newMetadata;

    ProtectedResourceMetadata newResourceMetadata = new ProtectedResourceMetadata();
    newResourceMetadata.setResource(URI.create(baseUrl + mcpEndpoint));
    newResourceMetadata.setAuthorizationServers(List.of(URI.create(baseUrl + mcpEndpoint)));
    newResourceMetadata.setScopesSupported(supportedScopes);
    newResourceMetadata.setResourceDocumentation(URI.create(baseUrl + "/docs"));
    this.protectedResourceMetadata = newResourceMetadata;

    this.resourceMetadataUrl =
        URI.create(baseUrl + mcpEndpoint + "/.well-known/oauth-protected-resource");

    LOG.info("OAuth metadata rebuilt with base URL: {}", baseUrl);
  }

  /**
   * Updates the allowed origins configuration for CORS.
   * This method allows dynamic configuration updates without recreating the transport provider.
   * @param newAllowedOrigins The new list of allowed origins
   */
  public synchronized void updateAllowedOrigins(List<String> newAllowedOrigins) {
    if (newAllowedOrigins != null) {
      this.allowedOrigins = newAllowedOrigins;
      LOG.info("Updated CORS allowed origins: {}", newAllowedOrigins);
    }
  }

  /**
   * Gets the current allowed origins for CORS.
   * @return The list of allowed origins
   */
  public List<String> getAllowedOrigins() {
    return allowedOrigins;
  }

  /**
   * Gets the object mapper.
   * @return The object mapper
   */
  protected ObjectMapper getObjectMapper() {
    return objectMapper;
  }

  /**
   * Sanitizes request parameters by removing sensitive values for logging.
   * Removes tokens, secrets, codes, and verifiers to prevent credential leakage in logs.
   * @param params The original parameters map
   * @return A sanitized copy of the parameters safe for logging
   */
  private Map<String, String> sanitizeParamsForLogging(Map<String, String> params) {
    if (params == null) {
      return new HashMap<>();
    }

    Map<String, String> sanitized = new HashMap<>(params);

    // Remove all sensitive OAuth parameters
    sanitized.remove("client_secret");
    sanitized.remove("code");
    sanitized.remove("code_verifier");
    sanitized.remove("refresh_token");
    sanitized.remove("access_token");
    sanitized.remove("token");
    sanitized.remove("password");

    // Replace code_challenge with indicator (still safe to log)
    if (sanitized.containsKey("code_challenge")) {
      sanitized.put("code_challenge", "<present>");
    }

    return sanitized;
  }

  /**
   * Sets CORS headers with origin validation.
   * Only allows specific origins from the allowedOrigins list.
   * Rejects requests from origins not in the allowed list.
   * @param request The HTTP request
   * @param response The HTTP response
   */
  private void setCorsHeaders(HttpServletRequest request, HttpServletResponse response) {
    String origin = request.getHeader("Origin");

    if (origin != null && allowedOrigins.contains(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
      response.setHeader("Access-Control-Max-Age", "3600");
      response.setHeader("Vary", "Origin");
      LOG.debug("CORS headers set for allowed origin: {}", origin);
    } else {
      // Log rejected origin attempts
      if (origin != null) {
        LOG.warn("CORS request rejected from unauthorized origin: {}", origin);
      } else {
        LOG.debug("CORS request without Origin header");
      }
    }
  }

  @Override
  public void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    LOG.debug("Handling OAuth GET request: {}", request.getRequestURI());
    String path = request.getRequestURI();

    // Handle OAuth GET routes (exact path matching to prevent path confusion attacks)
    if (path.equals("/mcp/.well-known/oauth-authorization-server")) {
      handleMetadataRequest(request, response);
    } else if (path.equals("/mcp/.well-known/oauth-protected-resource")) {
      handleProtectedResourceMetadataRequest(request, response);
    } else if (path.equals("/mcp/authorize")) {
      handleAuthorizeRequest(request, response);
    } else if (path.equals("/mcp/login") && basicAuthLoginServlet != null) {
      basicAuthLoginServlet.doGet(request, response);
    } else {
      // Unknown GET path: base class returns 404 for sub-paths, 405 for /mcp exactly
      super.doGet(request, response);
    }
  }

  /**
   * Authenticates a request using the Bearer token in the Authorization header.
   * @param request The HTTP request
   * @param response The HTTP response
   * @return true if authentication succeeded, false otherwise
   */
  @Override
  protected boolean authenticateRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    String tokenWithType = request.getHeader("Authorization");

    try {
      validatePrefixedTokenRequest(jwtFilter, tokenWithType);
      return true;
    } catch (Exception e) {
      LOG.debug("Bearer token authentication failed", e);
      sendAuthErrorWithChallenge(
          response, "Invalid or expired token", HttpServletResponse.SC_UNAUTHORIZED);
      return false;
    }
  }

  /**
   * Returns supported OAuth scopes based on the configured auth provider.
   * Different providers support different scopes:
   * - Google: openid, profile, email (no offline_access in OAuth context)
   * - Okta/Auth0/Cognito: openid, profile, email, offline_access
   * - Azure: openid, profile, email, offline_access (Azure-specific scopes come from config)
   * - Basic/LDAP: openid, profile, email
   */
  private static List<String> getSupportedScopesForProvider() {
    try {
      AuthProvider provider = SecurityConfigurationManager.getCurrentAuthConfig().getProvider();
      if (provider == null) {
        return List.of("openid", "profile", "email");
      }
      return switch (provider) {
        case GOOGLE -> List.of("openid", "profile", "email");
        case OKTA, AUTH_0, AWS_COGNITO, CUSTOM_OIDC -> List.of(
            "openid", "profile", "email", "offline_access");
        case AZURE -> List.of("openid", "profile", "email", "offline_access");
        default -> List.of("openid", "profile", "email");
      };
    } catch (Exception e) {
      LOG.warn("Could not determine auth provider for scopes, using default", e);
      return List.of("openid", "profile", "email");
    }
  }

  /**
   * Sends an authentication error response with WWW-Authenticate header (MCP requirement).
   * @param response The HTTP response
   * @param message The error message
   * @param statusCode The HTTP status code
   */
  private void sendAuthErrorWithChallenge(
      HttpServletResponse response, String message, int statusCode) throws IOException {

    // Build WWW-Authenticate header per RFC 6750 and MCP spec
    StringBuilder challenge = new StringBuilder("Bearer");
    challenge.append(" resource_metadata=\"").append(resourceMetadataUrl).append("\"");

    // Use provider-aware scopes
    List<String> scopes = getSupportedScopesForProvider();
    challenge.append(", scope=\"").append(String.join(" ", scopes)).append("\"");

    if (statusCode == HttpServletResponse.SC_FORBIDDEN) {
      challenge.append(", error=\"insufficient_scope\"");
    }

    response.setHeader("WWW-Authenticate", challenge.toString());
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.setStatus(statusCode);

    McpError error = McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR).message(message).build();
    String jsonError = getObjectMapper().writeValueAsString(error);

    PrintWriter writer = response.getWriter();
    writer.write(jsonError);
    writer.flush();
  }

  @Override
  protected void doOptions(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    LOG.debug("Handling CORS preflight request: {}", request.getRequestURI());

    // Set CORS headers for preflight request with origin validation
    setCorsHeaders(request, response);
    response.setStatus(HttpServletResponse.SC_OK);
  }

  @Override
  public void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    LOG.debug("Handling OAuth POST request: {}", request.getRequestURI());
    String path = request.getRequestURI();

    // Handle OAuth POST routes (exact path matching to prevent path confusion attacks)
    if (path.equals("/mcp/token")) {
      handleTokenRequest(request, response);
    } else if (path.equals("/mcp/authorize")) {
      handleAuthorizeRequest(request, response);
    } else if (path.equals("/mcp/register")) {
      handleRegistrationRequest(request, response);
    } else if (path.equals("/mcp/revoke")) {
      handleRevocationRequest(request, response);
    } else if (path.equals("/mcp/login") && basicAuthLoginServlet != null) {
      basicAuthLoginServlet.doPost(request, response);
    } else {
      // Handle other POST requests using the parent class
      super.doPost(request, response);
    }
  }

  public void handleMetadata(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    handleMetadataRequest(request, response);
  }

  public void handleProtectedResourceMetadata(
      HttpServletRequest request, HttpServletResponse response) throws IOException {
    handleProtectedResourceMetadataRequest(request, response);
  }

  private void handleMetadataRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    response.setContentType("application/json");
    setCorsHeaders(request, response);
    response.setStatus(200);
    getObjectMapper().writeValue(response.getOutputStream(), oauthMetadata);
  }

  private void handleProtectedResourceMetadataRequest(
      HttpServletRequest request, HttpServletResponse response) throws IOException {
    response.setContentType("application/json");
    setCorsHeaders(request, response);
    response.setStatus(200);
    getObjectMapper().writeValue(response.getOutputStream(), protectedResourceMetadata);
  }

  private void handleAuthorizeRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    // Extract parameters
    Map<String, String> params = new HashMap<>();
    request
        .getParameterMap()
        .forEach(
            (key, values) -> {
              if (values.length > 0) {
                params.put(key, values[0]);
              }
            });

    try {
      LOG.info("Authorization request params (sanitized): " + sanitizeParamsForLogging(params));

      if (authProvider instanceof org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) {
        ((org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) authProvider)
            .setRequestContext(request, response);
      }

      AuthorizationHandler.AuthorizationResponse authResponse =
          authorizationHandler.handle(params).join();

      String redirectUrl = authResponse.getRedirectUrl();
      if (redirectUrl != null) {
        response.setHeader("Location", redirectUrl);
        response.setHeader("Cache-Control", "no-store");
        setCorsHeaders(request, response);
        response.sendRedirect(redirectUrl);
      } else {
        // No redirect URL — error case where redirect_uri is invalid or client is unknown.
        // Per RFC 6749, display the error to the user instead of redirecting.
        setCorsHeaders(request, response);
        response.setContentType("application/json");
        response.setStatus(400);
        Map<String, String> error = new HashMap<>();
        error.put("error", "invalid_request");
        error.put("error_description", "Authorization request failed");
        getObjectMapper().writeValue(response.getOutputStream(), error);
      }

    } catch (Exception ex) {
      LOG.error("Authorization request failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
      boolean isClientError =
          cause instanceof org.openmetadata.mcp.auth.exception.AuthorizeException;
      response.setStatus(
          isClientError
              ? HttpServletResponse.SC_BAD_REQUEST
              : HttpServletResponse.SC_INTERNAL_SERVER_ERROR);

      Map<String, String> error = new HashMap<>();
      error.put("error", isClientError ? "invalid_request" : "server_error");
      error.put(
          "error_description",
          isClientError
              ? (cause.getMessage() != null ? cause.getMessage() : "Invalid request")
              : "Internal server error during authorization");
      getObjectMapper().writeValue(response.getOutputStream(), error);
    } finally {
      if (authProvider instanceof org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) {
        ((org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) authProvider)
            .clearRequestContext();
      }
    }
  }

  private void handleTokenRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    // Extract parameters
    Map<String, String> params = new HashMap<>();
    request
        .getParameterMap()
        .forEach(
            (key, values) -> {
              if (values.length > 0) {
                params.put(key, values[0]);
              }
            });

    LOG.debug("Token request params (sanitized): {}", sanitizeParamsForLogging(params));

    String clientIp = getClientIp(request);
    if (isTokenRateLimited(clientIp)) {
      LOG.warn("Token endpoint rate limit exceeded for IP: {}", clientIp);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(429);
      Map<String, String> error = new HashMap<>();
      error.put("error", "too_many_requests");
      error.put("error_description", "Token request rate limit exceeded. Try again later.");
      getObjectMapper().writeValue(response.getOutputStream(), error);
      return;
    }

    if (authProvider instanceof org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) {
      ((org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) authProvider)
          .setRequestContext(request, response);
    }

    try {
      String grantType = params.get("grant_type");
      String clientId = params.get("client_id");
      String clientSecret = params.get("client_secret");
      OAuthToken token = null;

      // Authenticate the client before processing any grant type
      OAuthClientInformation client;
      try {
        client = clientAuthenticator.authenticate(clientId, clientSecret).join();
      } catch (Exception e) {
        LOG.warn("Client authentication failed for client_id: {}", clientId, e);
        throw new TokenException("invalid_client", "Client authentication failed");
      }

      if (grantType == null || grantType.isEmpty()) {
        throw new TokenException("invalid_request", "grant_type parameter is required");
      }

      if ("authorization_code".equals(grantType)) {
        // Handle authorization code exchange
        String code = params.get("code");
        String redirectUri = params.get("redirect_uri");
        String codeVerifier = params.get("code_verifier");

        if (code == null || code.isEmpty()) {
          throw new TokenException("invalid_request", "code parameter is required");
        }

        // Load the authorization code to validate client_id and redirect_uri
        AuthorizationCode storedCode = authProvider.loadAuthorizationCode(client, code).join();
        if (storedCode == null) {
          throw new TokenException("invalid_grant", "Invalid authorization code");
        }

        // Validate that the code was issued to this client
        if (!storedCode.getClientId().equals(clientId)) {
          throw new TokenException(
              "invalid_grant", "Authorization code was not issued to this client");
        }

        // Validate redirect_uri (RFC 6749 Section 4.1.3): redirect_uri is always stored
        // during authorization — reject if missing as a safety net
        if (storedCode.getRedirectUri() == null) {
          LOG.error(
              "SECURITY ALERT: Authorization code has no stored redirect_uri. "
                  + "This should never happen.");
          throw new TokenException(
              "server_error", "Authorization code has no associated redirect URI");
        }
        if (redirectUri == null) {
          throw new TokenException(
              "invalid_request",
              "redirect_uri is required when it was included in the authorization request");
        }
        if (!storedCode.getRedirectUri().toString().equals(redirectUri)) {
          throw new TokenException(
              "invalid_grant", "redirect_uri does not match authorization request");
        }

        AuthorizationCode authCode = new AuthorizationCode();
        authCode.setCode(code);
        authCode.setClientId(clientId);
        if (redirectUri != null) {
          authCode.setRedirectUri(URI.create(redirectUri));
        }
        authCode.setCodeVerifier(codeVerifier);

        token = authProvider.exchangeAuthorizationCode(client, authCode).join();

      } else if ("refresh_token".equals(grantType)) {
        String refreshTokenValue = params.get("refresh_token");
        if (refreshTokenValue == null || refreshTokenValue.isEmpty()) {
          throw new TokenException("invalid_request", "refresh_token parameter is required");
        }
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(refreshTokenValue);
        refreshToken.setClientId(clientId);

        String scopeParam = params.get("scope");
        List<String> scopes = scopeParam != null ? List.of(scopeParam.split(" ")) : null;

        token = authProvider.exchangeRefreshToken(client, refreshToken, scopes).join();

      } else {
        throw new TokenException(
            "unsupported_grant_type",
            "Only authorization_code and refresh_token grant types are supported");
      }

      response.setContentType("application/json");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      setCorsHeaders(request, response);
      response.setStatus(200);
      getObjectMapper().writeValue(response.getOutputStream(), token);
    } catch (CompletionException ex) {
      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
      LOG.error("Token request failed", cause);
      setCorsHeaders(request, response);
      response.setContentType("application/json");

      Map<String, String> error = new HashMap<>();
      if (cause instanceof TokenException tokenEx) {
        error.put("error", tokenEx.getError());
        error.put("error_description", tokenEx.getErrorDescription());
        // RFC 6749 Section 5.2: invalid_client → 401, server_error → 500, others → 400
        int status =
            "invalid_client".equals(tokenEx.getError())
                ? HttpServletResponse.SC_UNAUTHORIZED
                : "server_error".equals(tokenEx.getError())
                    ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR
                    : HttpServletResponse.SC_BAD_REQUEST;
        response.setStatus(status);
      } else {
        error.put("error", "server_error");
        error.put("error_description", "Internal server error during token exchange");
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
      }
      getObjectMapper().writeValue(response.getOutputStream(), error);
    } catch (TokenException ex) {
      LOG.error("Token request failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      int status =
          "invalid_client".equals(ex.getError())
              ? HttpServletResponse.SC_UNAUTHORIZED
              : "server_error".equals(ex.getError())
                  ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR
                  : HttpServletResponse.SC_BAD_REQUEST;
      response.setStatus(status);

      Map<String, String> error = new HashMap<>();
      error.put("error", ex.getError());
      error.put("error_description", ex.getErrorDescription());
      getObjectMapper().writeValue(response.getOutputStream(), error);
    } catch (Exception ex) {
      LOG.error("Token request failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);

      Map<String, String> error = new HashMap<>();
      error.put("error", "server_error");
      error.put("error_description", "Internal server error during token exchange");
      getObjectMapper().writeValue(response.getOutputStream(), error);
    } finally {
      if (authProvider instanceof org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) {
        ((org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider) authProvider)
            .clearRequestContext();
      }
    }
  }

  /**
   * Extract client IP, trusting X-Forwarded-For only when the direct connection is from a
   * loopback address (i.e. a local reverse proxy). This prevents external clients from spoofing
   * XFF to bypass rate limiting. In-memory counters are per-JVM — consider a shared rate limiter
   * (Redis or DB-backed) for multi-node deployments.
   */
  private String getClientIp(HttpServletRequest request) {
    String remoteAddr = request.getRemoteAddr();
    if (isLoopback(remoteAddr)) {
      String xff = request.getHeader("X-Forwarded-For");
      if (xff != null && !xff.isEmpty()) {
        String clientIp = xff.split(",")[0].trim();
        if (!clientIp.isEmpty()
            && clientIp.length() <= 45
            && IP_PATTERN.matcher(clientIp).matches()) {
          return clientIp;
        }
      }
    }
    return remoteAddr;
  }

  private static boolean isLoopback(String ip) {
    return "127.0.0.1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip) || "::1".equals(ip);
  }

  private boolean isRegistrationRateLimited(String clientIp) {
    long now = System.currentTimeMillis();
    synchronized (registrationAttempts) {
      if (now - registrationWindowStart > 3_600_000) {
        registrationAttempts.clear();
        registrationWindowStart = now;
      }
      if (registrationAttempts.size() >= MAX_RATE_LIMIT_ENTRIES) {
        return true;
      }
      java.util.concurrent.atomic.AtomicInteger count =
          registrationAttempts.computeIfAbsent(
              clientIp, k -> new java.util.concurrent.atomic.AtomicInteger(0));
      return count.incrementAndGet() > REGISTRATION_MAX_PER_HOUR;
    }
  }

  private boolean isTokenRateLimited(String clientIp) {
    long now = System.currentTimeMillis();
    synchronized (tokenAttempts) {
      if (now - tokenWindowStart > 60_000) {
        tokenAttempts.clear();
        tokenWindowStart = now;
      }
      if (tokenAttempts.size() >= MAX_RATE_LIMIT_ENTRIES) {
        return true;
      }
      java.util.concurrent.atomic.AtomicInteger count =
          tokenAttempts.computeIfAbsent(
              clientIp, k -> new java.util.concurrent.atomic.AtomicInteger(0));
      return count.incrementAndGet() > TOKEN_MAX_PER_MINUTE;
    }
  }

  private void handleRegistrationRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    try {
      String clientIp = getClientIp(request);
      if (isRegistrationRateLimited(clientIp)) {
        LOG.warn("Registration rate limit exceeded for IP: {}", clientIp);
        setCorsHeaders(request, response);
        response.setContentType("application/json");
        response.setStatus(429);
        Map<String, String> error = new HashMap<>();
        error.put("error", "too_many_requests");
        error.put("error_description", "Registration rate limit exceeded. Try again later.");
        getObjectMapper().writeValue(response.getOutputStream(), error);
        return;
      }

      LOG.info("Client registration request received");

      // Parse registration request
      OAuthClientMetadata metadata =
          getObjectMapper().readValue(request.getInputStream(), OAuthClientMetadata.class);

      // Register client
      OAuthClientInformation clientInfo = registrationHandler.handle(metadata).join();

      // Return client information per RFC 7591
      response.setContentType("application/json");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      setCorsHeaders(request, response);
      response.setStatus(201); // Created
      getObjectMapper().writeValue(response.getOutputStream(), clientInfo);

      LOG.info("Client registered successfully: {}", clientInfo.getClientId());

    } catch (CompletionException ex) {
      LOG.error("Client registration failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");

      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;

      // Extract RegistrationException from cause chain
      org.openmetadata.mcp.auth.exception.RegistrationException regEx = null;
      if (cause instanceof org.openmetadata.mcp.auth.exception.RegistrationException r) {
        regEx = r;
      } else if (cause.getCause()
          instanceof org.openmetadata.mcp.auth.exception.RegistrationException r) {
        regEx = r;
      }

      if (regEx != null) {
        int status =
            "server_error".equals(regEx.getError())
                ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR
                : HttpServletResponse.SC_BAD_REQUEST;
        response.setStatus(status);

        Map<String, String> error = new HashMap<>();
        error.put("error", regEx.getError());
        error.put("error_description", regEx.getErrorDescription());
        getObjectMapper().writeValue(response.getOutputStream(), error);
      } else {
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        Map<String, String> error = new HashMap<>();
        error.put("error", "server_error");
        error.put("error_description", "Client registration failed");
        getObjectMapper().writeValue(response.getOutputStream(), error);
      }
    } catch (Exception ex) {
      LOG.error("Unexpected error during client registration", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(500);

      Map<String, String> error = new HashMap<>();
      error.put("error", "server_error");
      error.put("error_description", "Internal server error during client registration");
      getObjectMapper().writeValue(response.getOutputStream(), error);
    }
  }

  private void handleRevocationRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    try {
      LOG.debug("Token revocation request received");

      Map<String, String> params = new HashMap<>();
      request
          .getParameterMap()
          .forEach(
              (key, values) -> {
                if (values.length > 0) {
                  params.put(key, values[0]);
                }
              });

      // Authenticate client before revocation (RFC 7009 Section 2.1)
      String clientId = params.get("client_id");
      String clientSecret = params.get("client_secret");
      try {
        clientAuthenticator.authenticate(clientId, clientSecret).join();
      } catch (Exception e) {
        LOG.warn("Client authentication failed for revocation request");
        setCorsHeaders(request, response);
        response.setContentType("application/json");
        response.setStatus(401);
        Map<String, String> error = new HashMap<>();
        error.put("error", "invalid_client");
        error.put("error_description", "Client authentication failed");
        getObjectMapper().writeValue(response.getOutputStream(), error);
        return;
      }

      String token = params.get("token");
      String tokenTypeHint = params.get("token_type_hint");

      if (token == null || token.trim().isEmpty()) {
        LOG.warn("Revocation request missing token parameter");
        setCorsHeaders(request, response);
        response.setContentType("application/json");
        response.setStatus(400);

        Map<String, String> error = new HashMap<>();
        error.put("error", "invalid_request");
        error.put("error_description", "token parameter is required");
        getObjectMapper().writeValue(response.getOutputStream(), error);
        return;
      }

      revocationHandler.revokeToken(token, tokenTypeHint).join();

      setCorsHeaders(request, response);
      response.setStatus(200);
      LOG.info("Token revocation completed successfully");

    } catch (CompletionException ex) {
      // Per RFC 7009, return 200 for "token not found" to prevent token guessing
      // But return 500 for actual server errors
      Throwable cause = ex.getCause();
      if (cause instanceof IllegalArgumentException) {
        // Token not found or invalid - this is OK per RFC 7009
        LOG.debug("Token revocation: token not found or invalid", ex);
        setCorsHeaders(request, response);
        response.setStatus(200);
      } else {
        // Actual server error
        LOG.error("Token revocation failed with server error", ex);
        setCorsHeaders(request, response);
        response.setContentType("application/json");
        response.setStatus(500);
        Map<String, String> error = new HashMap<>();
        error.put("error", "server_error");
        error.put("error_description", "Token revocation failed due to server error");
        getObjectMapper().writeValue(response.getOutputStream(), error);
      }
    } catch (Exception ex) {
      LOG.error("Unexpected error during token revocation", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(500);
      Map<String, String> error = new HashMap<>();
      error.put("error", "server_error");
      error.put("error_description", "Unexpected error during token revocation");
      getObjectMapper().writeValue(response.getOutputStream(), error);
    }
  }
}
