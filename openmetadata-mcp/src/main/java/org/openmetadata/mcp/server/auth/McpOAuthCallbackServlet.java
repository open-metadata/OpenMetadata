package org.openmetadata.mcp.server.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.provider.OpenMetadataAuthProvider;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;

/**
 * Servlet that handles OAuth callback after successful OpenMetadata SSO authentication. This
 * servlet is called after the user successfully authenticates with OpenMetadata's configured IdP
 * (Google, Okta, Azure, SAML, etc.) and generates an authorization code to complete the MCP OAuth
 * flow.
 */
@Slf4j
public class McpOAuthCallbackServlet extends HttpServlet {
  public McpOAuthCallbackServlet(OpenMetadataAuthProvider authProvider) {}

  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    try {
      // Extract OAuth parameters
      AuthServeletHandlerRegistry.getHandler().handleCallback(request, response);
    } catch (Exception e) {
      LOG.error("Error in MCP OAuth callback", e);
      response.sendError(
          HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
          "Error processing OAuth callback: " + e.getMessage());
    }
  }
}
