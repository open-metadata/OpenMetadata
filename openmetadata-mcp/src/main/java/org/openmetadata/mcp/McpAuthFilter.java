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
          HttpServletResponse.SC_SERVICE_UNAVAILABLE,
          "McpApplication is not installed please install it to use MCP features.");
      return;
    }

    try {
      String tokenWithType = httpServletRequest.getHeader("Authorization");

      // Validate token once and extract claims
      String token = JwtFilter.extractToken(tokenWithType);
      Map<String, Claim> claims = jwtFilter.validateJwtAndGetClaims(token);

      checkForUsernameAndImpersonationValidation(token, claims, jwtFilter);

      // Continue with the filter chain
      filterChain.doFilter(servletRequest, servletResponse);
    } catch (Exception e) {
      sendError(httpServletResponse, HttpServletResponse.SC_UNAUTHORIZED, e.getMessage());
    } finally {
      // Clear any impersonation context set during JWT validation on this (Jetty) thread.
      // MCP bot impersonation is set and cleared on the Reactor boundedElastic thread
      // inside McpServer.getTool() — that cleanup is independent of this one.
      ImpersonationContext.clear();
    }
  }

  private void sendError(HttpServletResponse response, int statusCode, String errorMessage)
      throws IOException {
    Map<String, Object> error = new HashMap<>();
    error.put("error", errorMessage);
    String errorJson = JsonUtils.pojoToJson(error);
    response.setContentType("application/json");
    response.setStatus(statusCode);
    response.getWriter().write(errorJson);
  }
}
