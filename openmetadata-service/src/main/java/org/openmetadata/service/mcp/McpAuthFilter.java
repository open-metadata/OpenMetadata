package org.openmetadata.service.mcp;

import static org.openmetadata.service.socket.SocketAddressFilter.validatePrefixedTokenRequest;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
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
    String tokenWithType = httpServletRequest.getHeader("Authorization");
    validatePrefixedTokenRequest(jwtFilter, tokenWithType);

    // Continue with the filter chain
    filterChain.doFilter(servletRequest, servletResponse);
  }
}
