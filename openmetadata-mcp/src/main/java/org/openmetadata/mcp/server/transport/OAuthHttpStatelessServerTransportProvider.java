package org.openmetadata.mcp.server.transport;

import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.getHttpSession;
import static org.openmetadata.service.socket.SocketAddressFilter.validatePrefixedTokenRequest;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.server.McpTransportContextExtractor;
import io.modelcontextprotocol.spec.McpError;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletionException;
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
import org.openmetadata.mcp.server.auth.handlers.MetadataHandler;
import org.openmetadata.mcp.server.auth.handlers.ProtectedResourceMetadataHandler;
import org.openmetadata.mcp.server.auth.handlers.RegistrationHandler;
import org.openmetadata.mcp.server.auth.handlers.RevocationHandler;
import org.openmetadata.mcp.server.auth.handlers.TokenHandler;
import org.openmetadata.mcp.server.auth.middleware.AuthContext;
import org.openmetadata.mcp.server.auth.middleware.BearerAuthenticator;
import org.openmetadata.mcp.server.auth.middleware.ClientAuthenticator;
import org.openmetadata.mcp.server.auth.ratelimit.SimpleRateLimiter;
import org.openmetadata.mcp.server.auth.settings.ClientRegistrationOptions;
import org.openmetadata.mcp.server.auth.settings.RevocationOptions;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Extended transport provider that handles both MCP messages and OAuth routes. This class
 * integrates OAuth authentication routes directly into the transport layer It also adds
 * authentication middleware to validate requests for SSE and message endpoints.
 */
public class OAuthHttpStatelessServerTransportProvider extends HttpServletStatelessServerTransport {

  /** Logger for this class */
  private static final Logger logger =
      LoggerFactory.getLogger(OAuthHttpStatelessServerTransportProvider.class);

  private final MetadataHandler metadataHandler;

  private final ProtectedResourceMetadataHandler protectedResourceMetadataHandler;

  private final AuthorizationHandler authorizationHandler;

  private final TokenHandler tokenHandler;

  private final RegistrationHandler registrationHandler;

  private final RevocationHandler revocationHandler;

  private final ClientAuthenticator clientAuthenticator;

  private final BearerAuthenticator bearerAuthenticator;

  private final ObjectMapper objectMapper;

  private final URI resourceMetadataUrl;

  private final JwtFilter jwtFilter;

  private final List<String> allowedOrigins;

  private final OAuthAuthorizationServerProvider authProvider;

  private final SimpleRateLimiter authorizationRateLimiter;

  private final SimpleRateLimiter tokenRateLimiter;

  /**
   * Creates a new OAuthHttpServletSseServerTransportProvider.
   * @param objectMapper The JSON object mapper
   * @param baseUrl The base URL of the server
   * @param mcpEndpoint The MCP endpoint path
   * @param contextExtractor The context extractor
   * @param authProvider The OAuth authorization server provider
   * @param registrationOptions The client registration options
   * @param revocationOptions The token revocation options
   * @param allowedOrigins List of allowed origins for CORS
   */
  public OAuthHttpStatelessServerTransportProvider(
      ObjectMapper objectMapper,
      String baseUrl,
      String mcpEndpoint,
      McpTransportContextExtractor<HttpServletRequest> contextExtractor,
      OAuthAuthorizationServerProvider authProvider,
      ClientRegistrationOptions registrationOptions,
      RevocationOptions revocationOptions,
      List<String> allowedOrigins) {
    super(objectMapper, mcpEndpoint, contextExtractor);
    this.objectMapper = objectMapper;
    this.authProvider = authProvider;
    logger.info(
        "Initializing OAuthHttpServletSseServerTransportProvider with base URL: " + baseUrl);

    // Create authenticators with audience validation
    this.clientAuthenticator = new ClientAuthenticator(authProvider);
    this.bearerAuthenticator = new BearerAuthenticator(authProvider, baseUrl);

    // Create Authorization Server metadata (RFC 8414)
    // Endpoints are relative to /mcp prefix since servlet is mounted there
    OAuthMetadata metadata = new OAuthMetadata();
    metadata.setIssuer(URI.create(baseUrl + mcpEndpoint));
    metadata.setAuthorizationEndpoint(URI.create(baseUrl + mcpEndpoint + "/authorize"));
    metadata.setTokenEndpoint(URI.create(baseUrl + mcpEndpoint + "/token"));
    metadata.setScopesSupported(
        List.of("openid", "profile", "email", "offline_access", "api://apiId/.default"));
    metadata.setResponseTypesSupported(java.util.Arrays.asList("code"));
    metadata.setGrantTypesSupported(java.util.Arrays.asList("authorization_code", "refresh_token"));
    metadata.setTokenEndpointAuthMethodsSupported(java.util.Arrays.asList("client_secret_post"));
    metadata.setCodeChallengeMethodsSupported(java.util.Arrays.asList("S256"));

    if (registrationOptions.isEnabled()) {
      metadata.setRegistrationEndpoint(URI.create(baseUrl + mcpEndpoint + "/register"));
    }

    if (revocationOptions.isEnabled()) {
      metadata.setRevocationEndpoint(URI.create(baseUrl + mcpEndpoint + "/revoke"));
      metadata.setRevocationEndpointAuthMethodsSupported(
          java.util.Arrays.asList("client_secret_post"));
    }

    // Create Protected Resource metadata (RFC 9728) - MCP requirement
    this.resourceMetadataUrl =
        URI.create(baseUrl + mcpEndpoint + "/.well-known/oauth-protected-resource");
    ProtectedResourceMetadata protectedResourceMetadata = new ProtectedResourceMetadata();
    protectedResourceMetadata.setResource(URI.create(baseUrl));
    protectedResourceMetadata.setAuthorizationServers(
        java.util.Arrays.asList(URI.create(baseUrl + mcpEndpoint)));
    protectedResourceMetadata.setScopesSupported(registrationOptions.getValidScopes());
    protectedResourceMetadata.setResourceDocumentation(URI.create(baseUrl + "/docs"));

    // Create handlers
    this.metadataHandler = new MetadataHandler(metadata);
    this.protectedResourceMetadataHandler =
        new ProtectedResourceMetadataHandler(protectedResourceMetadata);
    this.authorizationHandler = new AuthorizationHandler(authProvider);
    this.tokenHandler = new TokenHandler(authProvider, clientAuthenticator);
    this.registrationHandler =
        registrationOptions.isEnabled()
            ? new RegistrationHandler(authProvider, registrationOptions)
            : null;
    this.revocationHandler =
        revocationOptions.isEnabled()
            ? new RevocationHandler(authProvider, clientAuthenticator)
            : null;

    this.jwtFilter =
        new JwtFilter(
            SecurityConfigurationManager.getCurrentAuthConfig(),
            SecurityConfigurationManager.getCurrentAuthzConfig());

    this.allowedOrigins = allowedOrigins;

    this.authorizationRateLimiter = new SimpleRateLimiter(10, 60);
    this.tokenRateLimiter = new SimpleRateLimiter(5, 60);

    logger.info("OAuthHttpServletSseServerTransportProvider initialized with base URL: " + baseUrl);
    logger.info("CORS allowed origins: " + allowedOrigins);
    logger.info("Rate limiting enabled: authorization (10 req/min), token (5 req/min)");
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
      // Set specific origin (not wildcard) for security
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
      response.setHeader("Access-Control-Max-Age", "3600");
      logger.debug("CORS headers set for allowed origin: " + origin);
    } else {
      // Log rejected origin attempts
      if (origin != null) {
        logger.warn("CORS request rejected from unauthorized origin: " + origin);
      } else {
        logger.debug("CORS request without Origin header");
      }
    }
  }

  @Override
  public void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    logger.info("Handling OAuth GET request: " + request.getRequestURI());
    try {
      String path = request.getRequestURI();

      // Handle OAuth GET routes
      if (path.endsWith("/.well-known/oauth-authorization-server")) {
        handleMetadataRequest(request, response);
      } else if (path.endsWith("/.well-known/oauth-protected-resource")) {
        handleProtectedResourceMetadataRequest(request, response);
      } else if (path.endsWith("/authorize")) {
        HttpSession session = getHttpSession(request, true);
        handleAuthorizeRequest(request, response);
      } else {
        // Handle other GET requests using the parent class
        super.doGet(request, response);
      }
    } finally {
      // Clear thread-local auth context after request is processed
      AuthContext.clearCurrent();
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
      // Clear auth context in case of failure
      AuthContext.clearCurrent();
      // Extract the root cause message
      String message = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
      sendAuthErrorWithChallenge(response, message, HttpServletResponse.SC_UNAUTHORIZED);
      return false;
    }
  }

  /**
   * Sends an authentication error response with WWW-Authenticate header (MCP requirement).
   * @param response The HTTP response
   * @param message The error message
   * @param statusCode The HTTP status code
   * @param scope The required scope
   */
  private void sendAuthErrorWithChallenge(
      HttpServletResponse response, String message, int statusCode) throws IOException {

    // Build WWW-Authenticate header per RFC 6750 and MCP spec
    StringBuilder challenge = new StringBuilder("Bearer");
    challenge.append(" resource_metadata=\"").append(resourceMetadataUrl).append("\"");

    challenge
        .append(", scope=\"")
        .append(
            "openid profile email offline_access api://0a957c01-29f8-4fce-a1dc-3b9f12447b60/.default")
        .append("\"");

    if (statusCode == HttpServletResponse.SC_FORBIDDEN) {
      challenge.append(", error=\"insufficient_scope\"");
    }

    response.setHeader("WWW-Authenticate", challenge.toString());
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.setStatus(statusCode);

    McpError error = new McpError(message);
    String jsonError = getObjectMapper().writeValueAsString(error);

    PrintWriter writer = response.getWriter();
    writer.write(jsonError);
    writer.flush();
  }

  @Override
  protected void doOptions(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    logger.info("Handling CORS preflight request: " + request.getRequestURI());

    // Set CORS headers for preflight request with origin validation
    setCorsHeaders(request, response);
    response.setStatus(HttpServletResponse.SC_OK);
  }

  @Override
  public void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    logger.info("Handling OAuth POST request: " + request.getRequestURI());
    try {
      String path = request.getRequestURI();

      // Handle OAuth POST routes
      if (path.endsWith("/token")) {
        handleTokenRequest(request, response);
      } else if (path.endsWith("/register") && registrationHandler != null) {
        handleRegisterRequest(request, response);
      } else if (path.endsWith("/revoke") && revocationHandler != null) {
        handleRevokeRequest(request, response);
      } else if (path.endsWith("/authorize")) {
        handleAuthorizeRequest(request, response);
      } else {
        // Handle other POST requests using the parent class
        super.doPost(request, response);
      }
    } finally {
      // Clear thread-local auth context after request is processed
      AuthContext.clearCurrent();
    }
  }

  private void handleMetadataRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    try {
      OAuthMetadata metadata = metadataHandler.handle().join();
      response.setContentType("application/json");
      setCorsHeaders(request, response);
      response.setStatus(200);
      getObjectMapper().writeValue(response.getOutputStream(), metadata);
    } catch (CompletionException ex) {
      response.setStatus(500);
    }
  }

  private void handleProtectedResourceMetadataRequest(
      HttpServletRequest request, HttpServletResponse response) throws IOException {
    try {
      ProtectedResourceMetadata metadata = protectedResourceMetadataHandler.handle().join();
      response.setContentType("application/json");
      setCorsHeaders(request, response);
      response.setStatus(200);
      getObjectMapper().writeValue(response.getOutputStream(), metadata);
    } catch (CompletionException ex) {
      response.setStatus(500);
    }
  }

  // NOTE: Basic rate limiting implemented using SimpleRateLimiter (in-memory sliding window).
  // For production deployments with multiple servers, consider migrating to a distributed
  // rate limiting solution using Redis (Bucket4j + Redis) or database-backed state.
  // See: https://datatracker.ietf.org/doc/html/rfc6749#section-10.11

  private void handleAuthorizeRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    String clientIp = request.getRemoteAddr();
    if (!authorizationRateLimiter.allowRequest(clientIp)) {
      response.setStatus(429);
      response.setContentType("application/json");
      response
          .getWriter()
          .write("{\"error\":\"too_many_requests\",\"error_description\":\"Rate limit exceeded\"}");
      return;
    }

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
      logger.info("Authorization request params (sanitized): " + sanitizeParamsForLogging(params));
      String redirectUrl = authorizationHandler.handle(params).join().getRedirectUrl();
      response.setHeader("Location", redirectUrl);
      response.setHeader("Cache-Control", "no-store");
      setCorsHeaders(request, response);
      response.sendRedirect(redirectUrl);
    } catch (Exception ex) {
      logger.error("Authorization request failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(400);

      Map<String, String> error = new HashMap<>();
      error.put("error", "invalid_request");
      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
      error.put(
          "error_description",
          cause.getMessage() != null ? cause.getMessage() : ex.getClass().getSimpleName());
      getObjectMapper().writeValue(response.getOutputStream(), error);
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

    String clientId = params.get("client_id");
    if (clientId != null && !tokenRateLimiter.allowRequest(clientId)) {
      response.setStatus(429);
      response.setContentType("application/json");
      response
          .getWriter()
          .write("{\"error\":\"too_many_requests\",\"error_description\":\"Rate limit exceeded\"}");
      return;
    }

    logger.info("Token request params (sanitized): " + sanitizeParamsForLogging(params));

    try {
      String grantType = params.get("grant_type");
      OAuthToken token = null;

      if ("authorization_code".equals(grantType)) {
        // Handle authorization code exchange
        String code = params.get("code");
        String redirectUri = params.get("redirect_uri");
        String codeVerifier = params.get("code_verifier");

        if (code == null || code.isEmpty()) {
          throw new TokenException("invalid_request", "code parameter is required");
        }

        OAuthClientInformation client = authProvider.getClient(clientId).join();
        if (client == null) {
          throw new TokenException("invalid_client", "Client not found: " + clientId);
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

        // Validate redirect_uri if it was provided during authorization
        if (storedCode.getRedirectUri() != null && redirectUri != null) {
          if (!storedCode.getRedirectUri().toString().equals(redirectUri)) {
            throw new TokenException(
                "invalid_grant", "redirect_uri does not match authorization request");
          }
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
        // Handle refresh token
        clientId = params.get("client_id");
        OAuthClientInformation client = authProvider.getClient(clientId).join();

        if (client == null) {
          throw new TokenException("invalid_client", "Client not found: " + clientId);
        }

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(params.get("refresh_token"));
        refreshToken.setClientId(clientId);

        // Parse scopes if provided
        String scopeParam = params.get("scope");
        List<String> scopes =
            scopeParam != null ? java.util.Arrays.asList(scopeParam.split(" ")) : null;

        token = authProvider.exchangeRefreshToken(client, refreshToken, scopes).join();

      } else {
        throw new TokenException(
            "unsupported_grant_type", "Grant type not supported: " + grantType);
      }

      response.setContentType("application/json");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      setCorsHeaders(request, response);
      response.setStatus(200);
      getObjectMapper().writeValue(response.getOutputStream(), token);
    } catch (Exception ex) {
      logger.error("Token request failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(400);

      Map<String, String> error = new HashMap<>();
      error.put("error", "invalid_grant");
      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
      error.put(
          "error_description",
          cause.getMessage() != null ? cause.getMessage() : ex.getClass().getSimpleName());
      getObjectMapper().writeValue(response.getOutputStream(), error);
    }
  }

  private void handleRegisterRequest(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    // Read request body
    BufferedReader reader = request.getReader();
    StringBuilder body = new StringBuilder();
    String line;
    while ((line = reader.readLine()) != null) {
      body.append(line);
    }

    try {
      logger.info("Client registration request body: " + body.toString());
      OAuthClientMetadata clientMetadata =
          getObjectMapper().readValue(body.toString(), OAuthClientMetadata.class);

      Object clientInfo = registrationHandler.handle(clientMetadata).join();
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(201); // Created
      getObjectMapper().writeValue(response.getOutputStream(), clientInfo);
    } catch (Exception ex) {
      logger.error("Client registration failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(400);

      // Send error response with details
      Map<String, String> error = new HashMap<>();
      error.put("error", "invalid_client_metadata");
      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
      error.put(
          "error_description",
          cause.getMessage() != null ? cause.getMessage() : ex.getClass().getSimpleName());
      getObjectMapper().writeValue(response.getOutputStream(), error);
    }
  }

  private void handleRevokeRequest(HttpServletRequest request, HttpServletResponse response)
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
      logger.info("Revocation request params (sanitized): " + sanitizeParamsForLogging(params));
      revocationHandler.handle(params).join();
      setCorsHeaders(request, response);
      response.setStatus(200);
    } catch (Exception ex) {
      logger.error("Revocation request failed", ex);
      setCorsHeaders(request, response);
      response.setContentType("application/json");
      response.setStatus(400);

      Map<String, String> error = new HashMap<>();
      error.put("error", "invalid_request");
      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
      error.put(
          "error_description",
          cause.getMessage() != null ? cause.getMessage() : ex.getClass().getSimpleName());
      getObjectMapper().writeValue(response.getOutputStream(), error);
    }
  }
}
