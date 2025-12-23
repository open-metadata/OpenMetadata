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
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientMetadata;
import org.openmetadata.mcp.auth.OAuthMetadata;
import org.openmetadata.mcp.auth.OAuthToken;
import org.openmetadata.mcp.auth.ProtectedResourceMetadata;
import org.openmetadata.mcp.server.auth.handlers.AuthorizationHandler;
import org.openmetadata.mcp.server.auth.handlers.MetadataHandler;
import org.openmetadata.mcp.server.auth.handlers.ProtectedResourceMetadataHandler;
import org.openmetadata.mcp.server.auth.handlers.RegistrationHandler;
import org.openmetadata.mcp.server.auth.handlers.RevocationHandler;
import org.openmetadata.mcp.server.auth.handlers.TokenHandler;
import org.openmetadata.mcp.server.auth.middleware.AuthContext;
import org.openmetadata.mcp.server.auth.middleware.BearerAuthenticator;
import org.openmetadata.mcp.server.auth.middleware.ClientAuthenticator;
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

  /**
   * Creates a new OAuthHttpServletSseServerTransportProvider.
   * @param objectMapper The JSON object mapper
   * @param baseUrl The base URL of the server
   * @param mcpEndpoint The MCP endpoint path
   * @param contextExtractor The context extractor
   * @param authProvider The OAuth authorization server provider
   * @param registrationOptions The client registration options
   * @param revocationOptions The token revocation options
   */
  public OAuthHttpStatelessServerTransportProvider(
      ObjectMapper objectMapper,
      String baseUrl,
      String mcpEndpoint,
      McpTransportContextExtractor<HttpServletRequest> contextExtractor,
      OAuthAuthorizationServerProvider authProvider,
      ClientRegistrationOptions registrationOptions,
      RevocationOptions revocationOptions) {
    super(objectMapper, mcpEndpoint, contextExtractor);
    this.objectMapper = objectMapper;
    logger.info(
        "Initializing OAuthHttpServletSseServerTransportProvider with base URL: " + baseUrl);

    // Create authenticators with audience validation
    this.clientAuthenticator = new ClientAuthenticator(authProvider);
    this.bearerAuthenticator = new BearerAuthenticator(authProvider, baseUrl);

    // Create Authorization Server metadata (RFC 8414)
    // Endpoints are relative to /mcp prefix since servlet is mounted there
    OAuthMetadata metadata = new OAuthMetadata();
    metadata.setIssuer(
        URI.create(baseUrl + "/mcp"));
    metadata.setAuthorizationEndpoint(
        URI.create(
            baseUrl + "/authorize"));
    metadata.setTokenEndpoint(
        URI.create(
            baseUrl + "/token"));
    metadata.setScopesSupported(
        List.of(
            "openid",
            "profile",
            "email",
            "offline_access",
            "api://apiId/.default"));
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

    logger.info("OAuthHttpServletSseServerTransportProvider initialized with base URL: " + baseUrl);
  }

  /**
   * Gets the object mapper.
   * @return The object mapper
   */
  protected ObjectMapper getObjectMapper() {
    return objectMapper;
  }

  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    logger.info("Handling OAuth GET request: " + request.getRequestURI());
    String path = request.getRequestURI();

    // Handle OAuth GET routes
    if (path.endsWith("/.well-known/oauth-authorization-server")) {
      handleMetadataRequest(request, response);
    } else if (path.endsWith("/authorize")) {
      HttpSession session = getHttpSession(request, true);
      handleAuthorizeRequest(request, response);
    } else {
      // Handle other GET requests using the parent class
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
      //      // Use the BearerAuthenticator to validate the token
      //      AccessToken token = bearerAuthenticator.authenticate(authHeader).join();
      //
      //      // Create auth context and store it in request attributes and thread-local
      //      AuthContext authContext = new AuthContext(token);
      //      request.setAttribute("authContext", authContext);
      //      AuthContext.setCurrent(authContext);

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

    // Set CORS headers for preflight request
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    response.setHeader("Access-Control-Max-Age", "3600");
    response.setStatus(HttpServletResponse.SC_OK);
  }

  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response)
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
      response.setHeader("Access-Control-Allow-Origin", "*"); // TODO: Don't do this
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
      // TODO: Don't do this
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setStatus(200);
      getObjectMapper().writeValue(response.getOutputStream(), metadata);
    } catch (CompletionException ex) {
      response.setStatus(500);
    }
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
      String redirectUrl = authorizationHandler.handle(params).join().getRedirectUrl();
      response.setHeader("Location", redirectUrl);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Access-Control-Allow-Origin", "*"); // TODO: Don't do this
      response.sendRedirect(redirectUrl);
    } catch (CompletionException ex) {
      response.setStatus(400);
    }
  }

  // private void handleAuthorizeRequest(HttpServletRequest request, HttpServletResponse
  // response) throws IOException {
  // if ("GET".equalsIgnoreCase(request.getMethod())) {
  // // Render consent page
  // String clientId = request.getParameter("client_id");
  // String redirectUri = request.getParameter("redirect_uri");
  // String scope = request.getParameter("scope");
  // String state = request.getParameter("state");
  // String codeChallenge = request.getParameter("code_challenge");
  // String codeChallengeMethod = request.getParameter("code_challenge_method");
  // String responseType = request.getParameter("response_type");

  // response.setContentType("text/html");
  // response.getWriter()
  // .write("<html><body>" + "<h1>Authorize Access</h1>" + "<p>Client <b>" + clientId
  // + "</b> is requesting access with scope: <b>" + scope + "</b></p>"
  // + "<form method='post' action='/authorize'>" + "<input type='hidden'
  // name='client_id' value='"
  // + clientId + "'/>" + "<input type='hidden' name='redirect_uri' value='" +
  // redirectUri + "'/>"
  // + "<input type='hidden' name='scope' value='" + scope + "'/>"
  // + "<input type='hidden' name='state' value='" + state + "'/>"
  // + "<input type='hidden' name='code_challenge' value='" + codeChallenge + "'/>"
  // + "<input type='hidden' name='code_challenge_method' value='" + codeChallengeMethod
  // + "'/>"
  // + "<input type='hidden' name='response_type' value='" + responseType + "'/>"
  // + "<button type='submit'>Authorize</button>" + "</form>" + "</body></html>");
  // }
  // else if ("POST".equalsIgnoreCase(request.getMethod())) {
  // // Extract parameters from form
  // Map<String, String> params = new HashMap<>();
  // request.getParameterMap().forEach((key, values) -> {
  // if (values.length > 0) {
  // params.put(key, values[0]);
  // }
  // });

  // try {
  // String redirectUrl = authorizationHandler.handle(params).join().getRedirectUrl();
  // response.setHeader("Location", redirectUrl);
  // response.setHeader("Cache-Control", "no-store");
  // response.setStatus(302); // Found
  // }
  // catch (CompletionException ex) {
  // response.setStatus(400);
  // }
  // }
  // }

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

    System.out.println("TOKEN REQUEST PARAMS: " + params);

    try {
      OAuthToken token = tokenHandler.handle(params).join();
      response.setContentType("application/json");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      // TODO: Don't do this
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setStatus(200);
      getObjectMapper().writeValue(response.getOutputStream(), token);
    } catch (CompletionException ex) {
      response.setStatus(400);
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
      OAuthClientMetadata clientMetadata =
          getObjectMapper().readValue(body.toString(), OAuthClientMetadata.class);

      Object clientInfo = registrationHandler.handle(clientMetadata).join();
      response.setHeader("Access-Control-Allow-Origin", "*"); // TODO: Don't do this
      response.setContentType("application/json");
      response.setStatus(201); // Created
      getObjectMapper().writeValue(response.getOutputStream(), clientInfo);
    } catch (CompletionException ex) {
      response.setStatus(400);
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
      revocationHandler.handle(params).join();
      response.setStatus(200);
    } catch (CompletionException ex) {
      response.setStatus(400);
    }
  }
}
