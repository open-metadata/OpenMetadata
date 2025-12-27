package org.openmetadata.mcp;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Filter to handle OAuth well-known endpoints at the root level.
 * Redirects requests to the appropriate MCP servlet endpoint.
 */
public class OAuthWellKnownFilter implements Filter {

  @Override
  public void doFilter(
      ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
      throws IOException, ServletException {

    HttpServletRequest request = (HttpServletRequest) servletRequest;
    HttpServletResponse response = (HttpServletResponse) servletResponse;
    String path = request.getRequestURI();

    // Handle OAuth Authorization Server metadata discovery per RFC 8414
    if (path.equals("/.well-known/oauth-authorization-server/mcp")
        || path.equals("/.well-known/oauth-authorization-server")) {
      // Forward to the MCP servlet's metadata endpoint
      request
          .getRequestDispatcher("/mcp/.well-known/oauth-authorization-server")
          .forward(request, response);
      return;
    }

    if (path.equals("/.well-known/oauth-protected-resource/mcp")
        || path.equals("/.well-known/oauth-protected-resource")) {
      // Forward to the MCP servlet's metadata endpoint
      request
          .getRequestDispatcher("/mcp/.well-known/oauth-protected-resource")
          .forward(request, response);
      return;
    }

    // Handle OpenID Connect discovery (optional, but some clients try this)
    if (path.equals("/.well-known/openid-configuration/mcp")
        || path.equals("/.well-known/openid-configuration")) {
      // Forward to the MCP servlet's metadata endpoint (same as OAuth)
      request
          .getRequestDispatcher("/mcp/.well-known/oauth-authorization-server")
          .forward(request, response);
      return;
    }

    // Handle OAuth endpoints at root level (forward to /mcp prefix)
    if (path.equals("/register")) {
      request.getRequestDispatcher("/mcp/register").forward(request, response);
      return;
    }

    if (path.equals("/authorize")) {
      request.getRequestDispatcher("/mcp/authorize").forward(request, response);
      return;
    }

    if (path.equals("/token")) {
      request.getRequestDispatcher("/mcp/token").forward(request, response);
      return;
    }

    if (path.equals("/revoke")) {
      request.getRequestDispatcher("/mcp/revoke").forward(request, response);
      return;
    }

    // Continue with the filter chain for other requests
    filterChain.doFilter(servletRequest, servletResponse);
  }
}
