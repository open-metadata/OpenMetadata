package org.openmetadata.mcp.server.auth.handlers;

import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE;
import static org.openmetadata.service.security.SecurityUtil.buildPrincipalClaimsMapping;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;

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
import org.openmetadata.mcp.server.auth.util.UriUtils;
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

  // Error messages used in sendError() calls — kept as constants so callers that
  // match on the message text see a stable contract and typos are caught at compile time.
  static final String ERR_MISSING_STATE = "Invalid MCP OAuth callback - missing state";
  static final String ERR_STATE_NOT_FOUND =
      "Invalid MCP OAuth callback - state not found or expired";

  private final UserSSOOAuthProvider userSSOProvider;
  private final McpPendingAuthRequestRepository pendingAuthRepository;
  private volatile IdTokenValidator idTokenValidator;
  private volatile AuthenticationCodeFlowHandler validatorBuiltFrom;

  public McpCallbackServlet(UserSSOOAuthProvider userSSOProvider) {
    this.userSSOProvider = userSSOProvider;
    this.pendingAuthRepository = new McpPendingAuthRequestRepository();
    LOG.info("Initialized McpCallbackServlet (runtime SSO dispatch)");
  }

  McpCallbackServlet(
      UserSSOOAuthProvider userSSOProvider, McpPendingAuthRequestRepository pendingAuthRepository) {
    this.userSSOProvider = userSSOProvider;
    this.pendingAuthRepository = pendingAuthRepository;
  }

  protected AuthenticationCodeFlowHandler resolveSsoHandler() {
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
        return buildPrincipalClaimsMapping(authConfig.getJwtPrincipalClaimsMapping());
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
      // pac4j 6 removed getProviderMetadata(); metadata now loads lazily via the resolver, which
      // must be initialized first because OM builds the OidcClient without calling client.init().
      ssoHandler.getClient().getConfiguration().ensuresMetadataResolverInitialized();
      expectedIssuer =
          ssoHandler
              .getClient()
              .getConfiguration()
              .getOpMetadataResolver()
              .load()
              .getIssuer()
              .getValue();
    } catch (Exception e) {
      expectedIssuer = authConfig.getAuthority();
      LOG.warn(
          "Could not extract issuer from OIDC provider metadata, using default: {}",
          expectedIssuer,
          e);
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
      LOG.debug(
          "MCP callback request: method={}, queryString={}, refererPresent={}",
          request.getMethod(),
          request.getQueryString() != null
              ? request.getQueryString().replaceAll("(id_token|code|token)=[^&]*", "$1=[REDACTED]")
              : "none",
          request.getHeader("Referer") != null);
      LOG.debug("Received SSO callback with pac4j state: {}", pac4jState);

      if (pac4jState == null || pac4jState.isEmpty()) {
        // Every MCP OIDC login runs the authorization-code flow (handleLogin), so its callback
        // carries the state of a pending request; one without it outlived that request.
        LOG.warn("MCP OAuth callback arrived with no state query param");
        response.sendError(HttpServletResponse.SC_BAD_REQUEST, ERR_MISSING_STATE);
        return;
      }

      McpPendingAuthRequest pendingRequest = pendingAuthRepository.findByPac4jState(pac4jState);
      if (pendingRequest == null) {
        LOG.warn(
            "No pending auth request found for pac4j state (hash={})",
            Integer.toHexString(pac4jState.hashCode()));
        response.sendError(HttpServletResponse.SC_BAD_REQUEST, ERR_STATE_NOT_FOUND);
        return;
      }

      LOG.debug("Found pending auth request: {}", pendingRequest.authRequestId());

      // If the IdP returned an OAuth error callback (e.g. login_required, access_denied,
      // server_error), relay it back to the MCP client's redirect_uri with
      // error/error_description/state=<mcp_state> (per RFC 6749 §4.1.2.1 and the MCP spec)
      // instead of invoking the web-SSO handleCallback path. handleCallback is written for the
      // browser web-SSO flow and only buffers (and silently drops, on this forwarded MCP path)
      // the IdP error response — which previously left the MCP client with no error and the
      // user staring at an opaque 500 "Authentication Failed" page. Short-circuiting here
      // avoids the buffered-response ambiguity entirely.
      String idpError = request.getParameter("error");
      if (idpError != null && !idpError.isEmpty()) {
        String errorDescription = request.getParameter("error_description");
        LOG.warn(
            "IdP returned OAuth error for MCP callback (pac4j state hash={}, error={}); "
                + "relaying to MCP client redirect_uri",
            Integer.toHexString(pac4jState.hashCode()),
            idpError);
        processBufferedCallbackResponse(
            response,
            wrappedResponse ->
                userSSOProvider.handleSSOErrorCallback(
                    wrappedResponse, pendingRequest.authRequestId(), idpError, errorDescription));
        LOG.info("Relayed IdP OAuth error to MCP client");
        return;
      }

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
      String baseUrl = UriUtils.withoutTrailingSlash(resolveBaseUrl());
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

      OidcCredentials credentials = (OidcCredentials) request.getAttribute(OIDC_CREDENTIAL_PROFILE);
      if (credentials == null || credentials.getIdToken() == null) {
        throw new IllegalStateException("No OIDC credentials found on request after SSO callback");
      }

      // pac4j 6 stores the id token as a serialized String; use it directly for validation.
      String idTokenString = credentials.getIdToken();

      JWTClaimsSet claimsSet;
      try {
        claimsSet = getIdTokenValidator(ssoHandler).validateAndDecode(idTokenString);
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
      // The servlet spec's sendRedirect implicitly sets a 302 (SC_FOUND) status; record it so
      // status-aware consumers (e.g. the >=400 guard in McpCallbackServlet.doGet and any
      // future caller inspecting statusCode) see the redirect instead of a misleading 200.
      statusCode = HttpServletResponse.SC_FOUND;
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
