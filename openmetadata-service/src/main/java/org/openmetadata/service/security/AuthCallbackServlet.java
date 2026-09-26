package org.openmetadata.service.security;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.auth.TestLoginRoundTrip;
import org.openmetadata.service.security.auth.TestLoginSessionCache;

@WebServlet("/callback")
@Slf4j
public class AuthCallbackServlet extends HttpServlet {

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    // A Test Login reuses this registered redirect URI. Route it before any live login handling, so
    // a test can never provision a user, mint a token, or start a session.
    Optional<String> testSessionId =
        TestLoginSessionCache.sessionIdFromMarker(req.getParameter("state"));
    if (testSessionId.isPresent()) {
      TestLoginRoundTrip.getInstance()
          .completeOidcCallback(testSessionId.get(), callbackParameters(req));
      TestLoginCallbackPage.render(resp);
      return;
    }

    // Check if this is an MCP OAuth callback (pac4j state matches a pending MCP auth request).
    // MCP uses /mcp/callback with DB-backed state restoration, but SSO providers redirect to
    // /callback (the registered redirect URI). Forward to /mcp/callback so McpCallbackServlet
    // can handle it with proper state restoration from DB.
    String state = req.getParameter("state");
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

    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler(req.getServletContext());
    handler.handleCallback(req, resp);
  }

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
    // SAML uses POST for callback with SAMLResponse
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler(req.getServletContext());
    handler.handleCallback(req, resp);
  }

  private static Map<String, List<String>> callbackParameters(HttpServletRequest req) {
    Map<String, List<String>> parameters = new HashMap<>();
    req.getParameterMap().forEach((name, values) -> parameters.put(name, Arrays.asList(values)));
    return parameters;
  }
}
