package org.openmetadata.mcp;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;

/**
 * Filter to handle OAuth well-known endpoints at the root level. Directly delegates to the MCP
 * transport provider's metadata handlers instead of forwarding, because the asset servlet's SPA
 * routing intercepts forwarded requests.
 */
@Slf4j
public class OAuthWellKnownFilter implements Filter {

  private final OAuthHttpStatelessServerTransportProvider transport;

  public OAuthWellKnownFilter(OAuthHttpStatelessServerTransportProvider transport) {
    this.transport = transport;
  }

  @Override
  public void doFilter(
      ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
      throws IOException, ServletException {

    HttpServletRequest request = (HttpServletRequest) servletRequest;
    HttpServletResponse response = (HttpServletResponse) servletResponse;
    String path = request.getRequestURI();

    if (path.equals("/.well-known/oauth-authorization-server")
        || path.equals("/.well-known/oauth-authorization-server/mcp")
        || path.equals("/.well-known/openid-configuration")
        || path.equals("/.well-known/openid-configuration/mcp")) {
      LOG.debug("Serving OAuth authorization server metadata for: {}", path);
      transport.handleMetadata(request, response);
      return;
    }

    if (path.equals("/.well-known/oauth-protected-resource")
        || path.equals("/.well-known/oauth-protected-resource/mcp")) {
      LOG.debug("Serving OAuth protected resource metadata for: {}", path);
      transport.handleProtectedResourceMetadata(request, response);
      return;
    }

    filterChain.doFilter(servletRequest, servletResponse);
  }
}
