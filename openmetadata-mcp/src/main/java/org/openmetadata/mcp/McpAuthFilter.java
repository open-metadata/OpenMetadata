package org.openmetadata.mcp;

import static org.openmetadata.service.socket.SocketAddressFilter.checkForUsernameAndImpersonationValidation;

import com.auth0.jwt.interfaces.Claim;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.JwtFilter;

/**
 * Authentication filter for MCP endpoints.
 *
 * <p>This filter validates JWT tokens for all MCP requests to ensure only authenticated users can
 * access MCP features. Supports OAuth endpoints and user impersonation.
 */
@Slf4j
public class McpAuthFilter implements Filter {
  private final JwtFilter jwtFilter;

  public McpAuthFilter(JwtFilter filter) {
    this.jwtFilter = filter;
  }

  @Override
  public void doFilter(
      ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
      throws IOException, ServletException {
    HttpServletRequest httpServletRequest = (HttpServletRequest) servletRequest;
    HttpServletResponse httpServletResponse = (HttpServletResponse) servletResponse;

    String requestPath = httpServletRequest.getRequestURI();
    String method = httpServletRequest.getMethod();

    // Allow CORS preflight OPTIONS requests without authentication
    if ("OPTIONS".equalsIgnoreCase(method)) {
      LOG.debug("Allowing OPTIONS preflight request without authentication: {}", requestPath);
      filterChain.doFilter(servletRequest, servletResponse);
      return;
    }

    // Allow OAuth endpoints without authentication
    if (isOAuthEndpoint(requestPath)) {
      LOG.debug("Allowing OAuth endpoint without authentication: {}", requestPath);
      filterChain.doFilter(servletRequest, servletResponse);
      return;
    }

    // Check if MCP application is installed
    if (ApplicationContext.getInstance().getAppIfExists("McpApplication") == null) {
      sendError(
          httpServletResponse,
          "McpApplication is not installed. Please install it to use MCP features.",
          HttpServletResponse.SC_SERVICE_UNAVAILABLE);
      return;
    }

    try {
      String tokenWithType = httpServletRequest.getHeader("Authorization");

      if (tokenWithType == null || tokenWithType.isEmpty()) {
        sendError(
            httpServletResponse,
            "Authentication required. Please provide a valid JWT token in the Authorization header.",
            HttpServletResponse.SC_UNAUTHORIZED);
        return;
      }

      // Validate token once and extract claims
      String token = JwtFilter.extractToken(tokenWithType);
      Map<String, Claim> claims = jwtFilter.validateJwtAndGetClaims(token);

      // Extract impersonatedBy claim if present
      String impersonatedBy =
          claims.containsKey(JwtFilter.IMPERSONATED_USER_CLAIM)
              ? claims.get(JwtFilter.IMPERSONATED_USER_CLAIM).asString()
              : null;

      // Set impersonatedBy in thread-local context for MCP tools to use
      if (impersonatedBy != null) {
        ImpersonationContext.setImpersonatedBy(impersonatedBy);
      }

      checkForUsernameAndImpersonationValidation(token, claims, jwtFilter);

      LOG.debug("MCP request authenticated successfully");

      // Continue with the filter chain
      filterChain.doFilter(servletRequest, servletResponse);
    } catch (Exception e) {
      LOG.error("MCP authentication failed", e);
      String message = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
      sendError(
          httpServletResponse,
          "Authentication failed: " + message,
          HttpServletResponse.SC_UNAUTHORIZED);
    } finally {
      // Always clear the impersonation context after request processing
      ImpersonationContext.clear();
    }
  }

  /**
   * Check if the request path is an OAuth endpoint that should be publicly accessible.
   * OAuth discovery and flow endpoints must be accessible without authentication.
   */
  private boolean isOAuthEndpoint(String path) {
    return path.endsWith("/.well-known/oauth-authorization-server")
        || path.endsWith("/.well-known/oauth-protected-resource")
        || path.endsWith("/.well-known/openid-configuration")
        || path.endsWith("/register")
        || path.endsWith("/authorize")
        || path.endsWith("/token")
        || path.endsWith("/revoke");
  }

  private void sendError(HttpServletResponse response, String errorMessage, int statusCode)
      throws IOException {
    Map<String, Object> error = new HashMap<>();
    error.put("error", errorMessage);
    String errorJson = JsonUtils.pojoToJson(error);
    response.setContentType("application/json");
    response.setStatus(statusCode);
    response.getWriter().write(errorJson);
  }
}
