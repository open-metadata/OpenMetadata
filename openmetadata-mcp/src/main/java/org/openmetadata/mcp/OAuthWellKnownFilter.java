package org.openmetadata.mcp;

import static org.openmetadata.mcp.server.transport.HttpServletStatelessServerTransport.pathInContext;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;

/**
 * Filter to handle OAuth well-known endpoints at the root level. Directly delegates to the MCP
 * transport provider's metadata handlers instead of forwarding, because the asset servlet's SPA
 * routing intercepts forwarded requests.
 */
@Slf4j
public class OAuthWellKnownFilter implements Filter {

  static final Set<String> AUTHORIZATION_SERVER_PATHS =
      Set.of(
          "/.well-known/oauth-authorization-server",
          "/.well-known/oauth-authorization-server/mcp",
          "/.well-known/openid-configuration",
          "/.well-known/openid-configuration/mcp");

  static final Set<String> PROTECTED_RESOURCE_PATHS =
      Set.of("/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp");

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
    String path = pathInContext(request);

    if (isDiscoveryPath(path) && !McpAvailabilityFilter.isMcpAvailable()) {
      McpAvailabilityFilter.refuse(response);
      return;
    }

    if (AUTHORIZATION_SERVER_PATHS.contains(path)) {
      LOG.debug("Serving OAuth authorization server metadata for: {}", path);
      transport.handleMetadata(request, response);
      return;
    }

    if (PROTECTED_RESOURCE_PATHS.contains(path)) {
      LOG.debug("Serving OAuth protected resource metadata for: {}", path);
      transport.handleProtectedResourceMetadata(request, response);
      return;
    }

    filterChain.doFilter(servletRequest, servletResponse);
  }

  private static boolean isDiscoveryPath(String path) {
    return AUTHORIZATION_SERVER_PATHS.contains(path) || PROTECTED_RESOURCE_PATHS.contains(path);
  }
}
