package org.openmetadata.mcp;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpTransportContextExtractor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.service.security.JwtFilter;

public class AuthEnrichedMcpContextExtractor
    implements McpTransportContextExtractor<HttpServletRequest> {
  public static final String AUTHORIZATION_HEADER = "Authorization";

  @Override
  public McpTransportContext extract(HttpServletRequest request) {
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(
        AUTHORIZATION_HEADER, JwtFilter.extractToken(request.getHeader(AUTHORIZATION_HEADER)));
    return McpTransportContext.create(contextData);
  }
}
