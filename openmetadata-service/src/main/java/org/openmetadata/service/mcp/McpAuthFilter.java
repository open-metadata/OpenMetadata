package org.openmetadata.service.mcp;

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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.ApplicationContext;
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
    }

    String tokenWithType = httpServletRequest.getHeader("Authorization");
    validatePrefixedTokenRequest(jwtFilter, tokenWithType);

    // Continue with the filter chain
    filterChain.doFilter(servletRequest, servletResponse);
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
