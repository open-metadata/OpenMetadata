package org.openmetadata.mcp;

import static org.openmetadata.service.socket.SocketAddressFilter.validatePrefixedTokenRequest;

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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.JwtFilter;

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
    if (ApplicationContext.getInstance().getAppIfExists("McpApplication") == null) {
      sendError(
          httpServletResponse,
          "McpApplication is not installed please install it to use MCP features.");
      return;
    }

    try {
      String tokenWithType = httpServletRequest.getHeader("Authorization");

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

      // Complete token validation (uses validatePrefixedTokenRequest which will validate again,
      // but this is consistent with existing patterns in SocketAddressFilter)
      validatePrefixedTokenRequest(jwtFilter, tokenWithType);

      // Continue with the filter chain
      filterChain.doFilter(servletRequest, servletResponse);
    } finally {
      // Always clear the impersonation context after request processing
      ImpersonationContext.clear();
    }
  }

  private void sendError(HttpServletResponse response, String errorMessage) throws IOException {
    Map<String, Object> error = new HashMap<>();
    error.put("error", errorMessage);
    String errorJson = JsonUtils.pojoToJson(error);
    response.setContentType("application/json");
    response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    response.getWriter().write(errorJson);
  }
}
