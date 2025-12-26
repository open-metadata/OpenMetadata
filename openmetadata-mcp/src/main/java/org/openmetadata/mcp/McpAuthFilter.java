package org.openmetadata.mcp;

import static org.openmetadata.service.socket.SocketAddressFilter.validatePrefixedTokenRequest;

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
import org.openmetadata.service.security.JwtFilter;

/**
 * Authentication filter for MCP endpoints.
 *
 * <p>This filter validates JWT tokens for all MCP requests to ensure only authenticated users can
 * access MCP features. It uses the same JWT validation as the rest of OpenMetadata.
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

    try {
      // Extract Authorization header
      String tokenWithType = httpServletRequest.getHeader("Authorization");

      if (tokenWithType == null || tokenWithType.isEmpty()) {
        sendError(
            httpServletResponse,
            "Authentication required. Please provide a valid JWT token in the Authorization header.",
            HttpServletResponse.SC_UNAUTHORIZED);
        return;
      }

      // Validate JWT token using OpenMetadata's standard validation
      validatePrefixedTokenRequest(jwtFilter, tokenWithType);

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
    }
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
