package org.openmetadata.service.security;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.auth.TestLoginHandler;
import org.openmetadata.service.security.auth.TestSamlHandler;

@WebServlet("/callback")
@Slf4j
public class AuthCallbackServlet extends HttpServlet {

  private static final String OIDC_TEST_LOGIN_PREFIX = "test-login:";

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    // Check if this is an MCP OAuth callback (pac4j state matches a pending MCP auth request).
    // MCP uses /mcp/callback with DB-backed state restoration, but SSO providers redirect to
    // /callback (the registered redirect URI). Forward to /mcp/callback so McpCallbackServlet
    // can handle it with proper state restoration from DB.
    String state = req.getParameter("state");

    // Check if this is an OIDC Test Login callback (state prefixed with "test-login:")
    if (state != null && state.startsWith(OIDC_TEST_LOGIN_PREFIX)) {
      handleOidcTestLogin(req, resp);
      return;
    }

    if (AuthenticationCodeFlowHandler.isMcpState(state)) {
      try {
        LOG.debug("Forwarding MCP OAuth callback to /mcp/callback");
        req.getRequestDispatcher("/mcp/callback").forward(req, resp);
        return;
      } catch (Exception e) {
        LOG.error("Failed to forward MCP callback", e);
        try {
          resp.sendError(
              HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Failed to process MCP callback");
        } catch (Exception writeEx) {
          LOG.error("Failed to write error response", writeEx);
        }
        return;
      }
    }

    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleCallback(req, resp);
  }

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
    // SAML uses POST for callback with SAMLResponse. Test Login SAML prefixes
    // RelayState with "saml-test-login:" so we can route to the test handler.
    String relayState = req.getParameter("RelayState");
    if (relayState != null && relayState.startsWith(TestSamlHandler.RELAY_STATE_PREFIX)) {
      handleSamlTestLogin(req, resp);
      return;
    }
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleCallback(req, resp);
  }

  private void handleOidcTestLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      LOG.debug("Handling OIDC Test Login callback");
      writeResponse(resp, TestLoginHandler.handleCallback(req));
    } catch (Exception e) {
      LOG.error("Failed to handle OIDC Test Login callback", e);
      sendInternalError(resp, "Failed to process Test Login");
    }
  }

  private void handleSamlTestLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      LOG.debug("Handling SAML Test Login callback");
      writeResponse(resp, TestSamlHandler.handleCallback(req));
    } catch (Exception e) {
      LOG.error("Failed to handle SAML Test Login callback", e);
      sendInternalError(resp, "Failed to process SAML Test Login");
    }
  }

  private void writeResponse(HttpServletResponse resp, Response response) throws Exception {
    resp.setContentType(
        response.getMediaType() != null ? response.getMediaType().toString() : "text/html");
    resp.setStatus(response.getStatus());
    resp.getWriter().write(response.getEntity().toString());
  }

  private void sendInternalError(HttpServletResponse resp, String message) {
    try {
      resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, message);
    } catch (Exception writeEx) {
      LOG.error("Failed to write error response", writeEx);
    }
  }
}
