package org.openmetadata.mcp;

import io.modelcontextprotocol.server.McpTransportContext;
import io.modelcontextprotocol.server.McpTransportContextExtractor;
import jakarta.servlet.http.HttpServletRequest;
import org.openmetadata.service.security.JwtFilter;

public class AuthEnrichedMcpContextExtractor
    implements McpTransportContextExtractor<HttpServletRequest> {
  public static final String AUTHORIZATION_HEADER = "Authorization";

  @Override
  public McpTransportContext extract(
      HttpServletRequest request, McpTransportContext transportContext) {
    transportContext.put(
        AUTHORIZATION_HEADER, JwtFilter.extractToken(request.getHeader(AUTHORIZATION_HEADER)));
    return transportContext;
  }
}
