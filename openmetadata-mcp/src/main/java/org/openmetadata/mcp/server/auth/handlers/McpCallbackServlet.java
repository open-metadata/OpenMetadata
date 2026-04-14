package org.openmetadata.mcp.server.auth.handlers;

import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;

import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.oauth2.sdk.id.State;
import com.nimbusds.oauth2.sdk.pkce.CodeVerifier;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import jakarta.servlet.http.HttpSession;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.validators.IdTokenValidator;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.credentials.OidcCredentials;

/**
 * Unified MCP callback servlet that handles SSO provider callbacks for MCP OAuth flow.
 *
 * <p>Always registered at /mcp/callback regardless of the authentication provider configured at
 * startup. At request time, checks whether SSO is available and either processes the SSO callback or
 * returns a clear error message. This follows the same pattern as the regular auth servlets (e.g.,
 * AuthCallbackServlet) which are always registered and dispatch at runtime.
 *
 * <p><b>IMPORTANT: Two Different OAuth Flows with Two Different State Parameters</b>
 *
 * <p>There are TWO separate OAuth flows happening:
 *
 * <ol>
 *   <li><b>Flow 1: Claude Desktop ↔ OpenMetadata (MCP OAuth)</b>
 *       <ul>
 *         <li>Client sends state parameter (e.g., random_state_123)
 *         <li>Stored as "mcp.state" in session
 *         <li>Used when redirecting BACK to client with authorization code
 *       </ul>
 *   <li><b>Flow 2: OpenMetadata ↔ Google (SSO OAuth)</b>
 *       <ul>
 *         <li>Pac4j generates NEW state parameter (e.g., 9880e10e42)
 *         <li>Google returns this state in callback
 *         <li>Validated by AuthenticationCodeFlowHandler.handleCallback()
 *       </ul>
 * </ol>
 */
@Slf4j
public class McpCallbackServlet extends HttpServlet {

  private final UserSSOOAuthProvider userSSOProvider;
  private final McpPendingAuthRequestRepository pendingAuthRepository;
  private volatile IdTokenValidator idTokenValidator;
  private volatile AuthenticationCodeFlowHandler validatorBuiltFrom;

  public McpCallbackServlet(UserSSOOAuthProvider userSSOProvider) {
    this.userSSOProvider = userSSOProvider;
    this.pendingAuthRepository = new McpPendingAuthRequestRepository();
    LOG.info("Initialized McpCallbackServlet (runtime SSO dispatch)");
  }

  private AuthenticationCodeFlowHandler resolveSsoHandler() {
    try {
      var authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
      if (authConfig == null
          || authConfig.getProvider() == null
          || authConfig.getProvider() == AuthProvider.BASIC
          || authConfig.getProvider() == AuthProvider.LDAP) {
        return null;
      }
      return AuthenticationCodeFlowHandler.getInstance();
    } catch (Exception e) {
      LOG.warn("SSO handler not available: {}", e.getMessage());
      return null;
    }
  }

  private String resolveBaseUrl() {
    try {
      MCPConfiguration mcpConfig = SecurityConfigurationManager.getCurrentMcpConfig();
      if (mcpConfig != null && mcpConfig.getBaseUrl() != null) {
        return mcpConfig.getBaseUrl();
      }
    } catch (Exception e) {
      LOG.warn("Failed to get base URL from MCP config", e);
    }
    try {
      SystemRepository systemRepository = Entity.getSystemRepository();
      if (systemRepository != null) {
        Settings settings = systemRepository.getOMBaseUrlConfigInternal();
        if (settings != null && settings.getConfigValue() != null) {
          OpenMetadataBaseUrlConfiguration urlConfig =
              (OpenMetadataBaseUrlConfiguration) settings.getConfigValue();
          if (urlConfig != null && urlConfig.getOpenMetadataUrl() != null) {
            return urlConfig.getOpenMetadataUrl();
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Could not get base URL from system settings", e);
    }

    LOG.error(
        "No base URL configured in MCP settings or system settings. "
            + "Falling back to http://localhost:8585 — this is only suitable for local development. "
            + "Configure a proper base URL for production deployments.");
    return "http://localhost:8585";
  }

  private Map<String, String> getClaimsMapping() {
    try {
      var authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
      if (authConfig != null && authConfig.getJwtPrincipalClaimsMapping() != null) {
        Map<String, String> mapping = new TreeMap<>();
        for (String claimPair : authConfig.getJwtPrincipalClaimsMapping()) {
          String[] parts = claimPair.split(":");
          if (parts.length == 2) {
            mapping.put(parts[0], parts[1]);
          }
        }
        return mapping;
      }
    } catch (Exception e) {
      LOG.warn("Failed to get claims mapping from config: {}", e.getMessage());
    }
    return Map.of();
  }

  private String[] getClaimsOrder() {
    try {
      var authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
      if (authConfig != null && authConfig.getJwtPrincipalClaims() != null) {
        return authConfig.getJwtPrincipalClaims().toArray(new String[0]);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get claims order from config: {}", e.getMessage());
    }
    return new String[] {"email", "preferred_username", "sub"};
  }

  private String getPrincipalDomain() {
    try {
      var authzConfig = SecurityConfigurationManager.getCurrentAuthzConfig();
      if (authzConfig != null && authzConfig.getPrincipalDomain() != null) {
        return authzConfig.getPrincipalDomain();
      }
      LOG.debug("Principal domain not configured, using empty string");
    } catch (Exception e) {
      LOG.warn("Failed to get principal domain from config: {}", e.getMessage());
    }
    return "";
  }

  private IdTokenValidator getIdTokenValidator(AuthenticationCodeFlowHandler ssoHandler) {
    if (idTokenValidator != null && validatorBuiltFrom == ssoHandler) {
      return idTokenValidator;
    }
    synchronized (this) {
      if (idTokenValidator == null || validatorBuiltFrom != ssoHandler) {
        idTokenValidator = createIdTokenValidator(ssoHandler);
        validatorBuiltFrom = ssoHandler;
      }
      return idTokenValidator;
    }
  }

  private IdTokenValidator createIdTokenValidator(AuthenticationCodeFlowHandler ssoHandler) {
    var authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
    if (authConfig == null) {
      throw new IllegalStateException(
          "Authentication configuration not initialized. Cannot validate ID tokens.");
    }

    String expectedIssuer;
    try {
      expectedIssuer =
          ssoHandler.getClient().getConfiguration().getProviderMetadata().getIssuer().getValue();
    } catch (Exception e) {
      LOG.warn(
          "Could not extract issuer from OIDC provider metadata, will use default: {}",
          e.getMessage());
      expectedIssuer = authConfig.getAuthority();
    }

    String expectedAudience = null;
    try {
      expectedAudience = ssoHandler.getClient().getConfiguration().getClientId();
      LOG.debug("ID token audience validation enabled for client ID: {}", expectedAudience);
    } catch (Exception e) {
      LOG.warn(
          "Could not extract SSO client ID for audience validation, skipping: {}", e.getMessage());
    }

    return new IdTokenValidator(authConfig.getPublicKeyUrls(), expectedIssuer, expectedAudience);
  }

  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    AuthenticationCodeFlowHandler ssoHandler = resolveSsoHandler();
    if (ssoHandler == null) {
      LOG.warn(
          "MCP SSO callback hit but SSO was not configured at server startup. "
              + "The authentication provider may have been changed after the server started.");
      response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
      response.setContentType("text/html; charset=UTF-8");
      response
          .getWriter()
          .write(
              "<html><body>"
                  + "<h1>MCP SSO Not Available</h1>"
                  + "<p>The authentication provider was changed after the server started. "
                  + "Please restart the server for MCP SSO authentication to take effect.</p>"
                  + "</body></html>");
      return;
    }

    try {
      LOG.info("Handling SSO callback for MCP OAuth");

      String pac4jState = request.getParameter("state");
      String idTokenParam = request.getParameter("id_token");
      LOG.debug(
          "Received SSO callback with pac4j state: {}, id_token present: {}",
          pac4jState,
          idTokenParam != null);

      if ((pac4jState == null || pac4jState.isEmpty()) && idTokenParam != null) {
        LOG.info("Handling direct ID token flow (user already authenticated)");
        handleDirectIdTokenFlow(request, response, idTokenParam, ssoHandler);
        return;
      }

      if (pac4jState == null || pac4jState.isEmpty()) {
        LOG.warn("SSO callback without state parameter and no id_token");
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST, "Invalid MCP OAuth callback - missing state");
        return;
      }

      McpPendingAuthRequest pendingRequest = pendingAuthRepository.findByPac4jState(pac4jState);
      if (pendingRequest == null) {
        LOG.warn(
            "No pending auth request found for pac4j state (hash={})",
            Integer.toHexString(pac4jState.hashCode()));
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Invalid MCP OAuth callback - state not found or expired");
        return;
      }

      LOG.debug("Found pending auth request: {}", pendingRequest.authRequestId());

      HttpSession session = request.getSession(true);
      String clientName = ssoHandler.getClient().getName();
      LOG.debug("Restoring pac4j session attributes for client: {}", clientName);

      OidcClient oidcClient = ssoHandler.getClient();
      if (pendingRequest.pac4jState() != null) {
        State stateObj = new State(pendingRequest.pac4jState());
        session.setAttribute(oidcClient.getStateSessionAttributeName(), stateObj);
        LOG.debug("Restored pac4j state for client {}", clientName);
      }
      if (pendingRequest.pac4jNonce() != null) {
        session.setAttribute(
            oidcClient.getNonceSessionAttributeName(), pendingRequest.pac4jNonce());
        LOG.debug("Restored pac4j nonce for client {}", clientName);
      }
      if (pendingRequest.pac4jCodeVerifier() != null) {
        CodeVerifier verifierObj = new CodeVerifier(pendingRequest.pac4jCodeVerifier());
        session.setAttribute(oidcClient.getCodeVerifierSessionAttributeName(), verifierObj);
        LOG.debug("Restored pac4j code verifier for client {}", clientName);
      }

      String ssoCallbackUrl = ssoHandler.getClient().getCallbackUrl();
      session.setAttribute(AuthenticationCodeFlowHandler.SESSION_SSO_CALLBACK_URL, ssoCallbackUrl);
      String baseUrl = resolveBaseUrl();
      session.setAttribute(
          AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI, baseUrl + "/mcp/callback");
      LOG.debug("Set session SSO callback URL to: {}", ssoCallbackUrl);

      BufferedServletResponseWrapper callbackResponse =
          new BufferedServletResponseWrapper(response);
      ssoHandler.handleCallback(request, callbackResponse);

      if (callbackResponse.getStatusCode() >= HttpServletResponse.SC_BAD_REQUEST) {
        String errorBody = callbackResponse.getCapturedBody();
        LOG.error(
            "SSO token exchange failed with HTTP {}: {}",
            callbackResponse.getStatusCode(),
            errorBody);
        throw new IllegalStateException(
            "SSO provider token exchange failed (HTTP "
                + callbackResponse.getStatusCode()
                + "): "
                + errorBody);
      }

      OidcCredentials credentials = (OidcCredentials) session.getAttribute(OIDC_CREDENTIAL_PROFILE);
      if (credentials == null || credentials.getIdToken() == null) {
        throw new IllegalStateException("No OIDC credentials found in session after SSO callback");
      }

      JWT idToken = credentials.getIdToken();

      JWTClaimsSet claimsSet;
      try {
        claimsSet = getIdTokenValidator(ssoHandler).validateAndDecode(idToken.serialize());
        LOG.debug("ID token signature validated successfully in standard SSO flow");
      } catch (IdTokenValidator.IdTokenValidationException e) {
        LOG.error(
            "SECURITY ALERT: ID token validation failed in standard SSO flow. Reason: {}. IP: {}",
            e.getMessage(),
            request.getRemoteAddr());
        throw new IllegalStateException(
            "ID token validation failed: " + e.getMessage() + ". Please restart authentication.",
            e);
      }

      Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
      claims.putAll(claimsSet.getClaims());

      String userName =
          findUserNameFromClaims(getClaimsMapping(), List.of(getClaimsOrder()), claims);
      String email =
          findEmailFromClaims(
              getClaimsMapping(), List.of(getClaimsOrder()), claims, getPrincipalDomain());

      if (userName == null || userName.trim().isEmpty()) {
        LOG.error(
            "Could not extract username from SSO claims. Available claims: {}", claims.keySet());
        throw new IllegalStateException(
            "SSO provider did not provide required user information (username). "
                + "Please contact your administrator.");
      }

      LOG.debug("Extracted user identity from SSO callback");

      processBufferedCallbackResponse(
          response,
          wrappedResponse ->
              userSSOProvider.handleSSOCallbackWithDbState(
                  request,
                  wrappedResponse,
                  userName,
                  email,
                  "mcp:" + pendingRequest.authRequestId()));

      LOG.info("MCP OAuth SSO callback completed successfully");

    } catch (Exception e) {
      LOG.error("SSO callback handling failed", e);
      if (!response.isCommitted()) {
        try {
          response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
          response.setContentType("text/html; charset=UTF-8");
          response
              .getWriter()
              .write(
                  "<html><body><h1>Authentication Failed</h1>"
                      + "<p>An internal error occurred while processing authentication. "
                      + "Please try again or contact your administrator.</p></body></html>");
        } catch (Exception writeEx) {
          LOG.error("Failed to write error response", writeEx);
        }
      }
    }
  }

  private void handleDirectIdTokenFlow(
      HttpServletRequest request,
      HttpServletResponse response,
      String idTokenString,
      AuthenticationCodeFlowHandler ssoHandler)
      throws Exception {

    HttpSession session = request.getSession(false);
    if (session == null) {
      throw new IllegalStateException("No session found for direct ID token flow");
    }

    String authRequestId = (String) session.getAttribute("mcp.auth.request.id");
    if (authRequestId == null) {
      throw new IllegalStateException("No auth request ID found in session");
    }

    LOG.debug("Found auth request ID in session: {}", authRequestId);

    McpPendingAuthRequest pendingRequest = pendingAuthRepository.findByAuthRequestId(authRequestId);
    if (pendingRequest == null) {
      throw new IllegalStateException(
          "Pending auth request not found or expired: " + authRequestId);
    }

    JWTClaimsSet claimsSet;
    try {
      claimsSet = getIdTokenValidator(ssoHandler).validateAndDecode(idTokenString);
      LOG.debug("ID token signature validated successfully for auth request: {}", authRequestId);
    } catch (IdTokenValidator.IdTokenValidationException e) {
      LOG.error(
          "SECURITY ALERT: ID token validation failed for auth request: {}. Reason: {}. IP: {}",
          authRequestId,
          e.getMessage(),
          request.getRemoteAddr());
      throw new IllegalStateException(
          "ID token validation failed: " + e.getMessage() + ". Please restart authentication.", e);
    }

    Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(claimsSet.getClaims());

    String userName = findUserNameFromClaims(getClaimsMapping(), List.of(getClaimsOrder()), claims);
    String email =
        findEmailFromClaims(
            getClaimsMapping(), List.of(getClaimsOrder()), claims, getPrincipalDomain());

    if (userName == null || userName.trim().isEmpty()) {
      LOG.error(
          "Could not extract username from SSO claims. Available claims: {}", claims.keySet());
      throw new IllegalStateException(
          "SSO provider did not provide required user information (username). "
              + "Please contact your administrator.");
    }

    if (email == null || email.trim().isEmpty()) {
      LOG.warn("Could not extract email from SSO claims. Available claims: {}", claims.keySet());
    }

    LOG.debug("Extracted user identity from direct ID token flow");

    session.removeAttribute("mcp.auth.request.id");

    processBufferedCallbackResponse(
        response,
        wrappedResponse ->
            userSSOProvider.handleSSOCallbackWithDbState(
                request, wrappedResponse, userName, email, "mcp:" + authRequestId));

    LOG.info("MCP OAuth direct ID token flow completed successfully");
  }

  private void processBufferedCallbackResponse(
      HttpServletResponse response, BufferedResponseAction action) throws Exception {
    BufferedServletResponseWrapper bufferedResponse = new BufferedServletResponseWrapper(response);
    action.execute(bufferedResponse);
    bufferedResponse.commitTo(response);
  }

  @FunctionalInterface
  private interface BufferedResponseAction {
    void execute(HttpServletResponse response) throws Exception;
  }

  private static final class BufferedServletResponseWrapper extends HttpServletResponseWrapper {
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private final ServletOutputStream outputStream = new BufferedServletOutputStream(buffer);
    private PrintWriter writer;
    private Integer statusCode = HttpServletResponse.SC_OK;
    private String contentType;
    private String characterEncoding = StandardCharsets.UTF_8.name();
    private String redirectLocation;
    private boolean committed;
    private boolean outputStreamRequested;
    private boolean writerRequested;

    BufferedServletResponseWrapper(HttpServletResponse response) {
      super(response);
    }

    int getStatusCode() {
      return statusCode;
    }

    String getCapturedBody() throws IOException {
      flushBuffer();
      return buffer.toString(StandardCharsets.UTF_8);
    }

    void commitTo(HttpServletResponse response) throws IOException {
      flushBuffer();
      if (redirectLocation != null) {
        response.sendRedirect(redirectLocation);
        return;
      }

      response.setStatus(statusCode);
      if (characterEncoding != null) {
        response.setCharacterEncoding(characterEncoding);
      }
      if (contentType != null) {
        response.setContentType(contentType);
      }
      if (buffer.size() > 0) {
        response.getOutputStream().write(buffer.toByteArray());
      }
      response.flushBuffer();
    }

    @Override
    public void setStatus(int sc) {
      statusCode = sc;
    }

    @Override
    public void sendError(int sc) {
      statusCode = sc;
      committed = true;
    }

    @Override
    public void sendError(int sc, String msg) throws IOException {
      statusCode = sc;
      committed = true;
      if (msg != null) {
        writeToBuffer(msg);
      }
    }

    @Override
    public void sendRedirect(String location) {
      redirectLocation = location;
      committed = true;
    }

    @Override
    public void setContentType(String type) {
      contentType = type;
    }

    @Override
    public String getContentType() {
      return contentType;
    }

    @Override
    public void setCharacterEncoding(String charset) {
      if (!writerRequested) {
        characterEncoding = charset;
      }
    }

    @Override
    public String getCharacterEncoding() {
      return characterEncoding;
    }

    @Override
    public ServletOutputStream getOutputStream() {
      if (writerRequested) {
        throw new IllegalStateException("getWriter() has already been called on this response");
      }
      outputStreamRequested = true;
      return outputStream;
    }

    @Override
    public PrintWriter getWriter() {
      if (outputStreamRequested) {
        throw new IllegalStateException(
            "getOutputStream() has already been called on this response");
      }
      if (writer == null) {
        writer =
            new PrintWriter(
                new OutputStreamWriter(
                    buffer,
                    Charset.forName(
                        characterEncoding != null
                            ? characterEncoding
                            : StandardCharsets.UTF_8.name())),
                true);
      }
      writerRequested = true;
      return writer;
    }

    @Override
    public void flushBuffer() throws IOException {
      if (writer != null) {
        writer.flush();
      }
      if (outputStreamRequested) {
        outputStream.flush();
      }
      committed = true;
    }

    @Override
    public boolean isCommitted() {
      return committed;
    }

    private void writeToBuffer(String value) throws IOException {
      if (writer != null) {
        writer.flush();
      }
      buffer.write(
          value.getBytes(
              Charset.forName(
                  characterEncoding != null ? characterEncoding : StandardCharsets.UTF_8.name())));
    }
  }

  private static final class BufferedServletOutputStream extends ServletOutputStream {
    private final ByteArrayOutputStream buffer;

    private BufferedServletOutputStream(ByteArrayOutputStream buffer) {
      this.buffer = buffer;
    }

    @Override
    public void write(int b) {
      buffer.write(b);
    }

    @Override
    public boolean isReady() {
      return true;
    }

    @Override
    public void setWriteListener(WriteListener writeListener) {}
  }
}
