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

  /**
   * Context key carrying the resolved client name (Claude Desktop / Cursor / VS Code / etc.)
   * derived from the User-Agent header. Stamped on every {@link
   * org.openmetadata.schema.entity.app.mcp.McpToolCallUsage} row so the Billing > MCP page can
   * group by client. Kept as a constant on this class so producer + consumer share the spelling.
   */
  public static final String CLIENT_NAME = "Mcp-Client-Name";

  private static final String USER_AGENT_HEADER = "User-Agent";

  @Override
  public McpTransportContext extract(HttpServletRequest request) {
    String token = JwtFilter.extractToken(request.getHeader(AUTHORIZATION_HEADER));
    String clientName = resolveClientName(request.getHeader(USER_AGENT_HEADER));
    Map<String, Object> values = new HashMap<>();
    values.put(AUTHORIZATION_HEADER, token != null ? token : "");
    if (clientName != null) {
      values.put(CLIENT_NAME, clientName);
    }
    return McpTransportContext.create(values);
  }

  /**
   * Heuristic: pick the leading product token from {@code User-Agent} and tidy it into the form
   * the design uses (Claude Desktop, Cursor, VS Code, CLI). MCP clients all set distinctive UAs
   * — this covers the common ones explicitly and falls back to the raw product token so a new
   * client at least shows up in the breakdown.
   */
  static String resolveClientName(String userAgent) {
    if (userAgent == null || userAgent.isBlank()) {
      return null;
    }
    String ua = userAgent.toLowerCase(java.util.Locale.ROOT);
    if (ua.contains("claude") && ua.contains("desktop")) {
      return "Claude Desktop";
    }
    if (ua.contains("claude") && (ua.contains("code") || ua.contains("cli"))) {
      return "Claude CLI";
    }
    if (ua.contains("cursor")) {
      return "Cursor";
    }
    if (ua.contains("vscode") || ua.contains("vs code") || ua.contains("visual studio code")) {
      return "VS Code";
    }
    if (ua.contains("zed")) {
      return "Zed";
    }
    if (ua.contains("windsurf")) {
      return "Windsurf";
    }
    // Fallback — first product token of the User-Agent (the bit before the first slash or
    // space), capitalised. Avoids leaking version strings into the dashboard while still
    // surfacing unknown clients with a human-readable label.
    String head = userAgent.split("[\\s/]", 2)[0];
    if (head.isBlank()) {
      return null;
    }
    return head.substring(0, 1).toUpperCase(java.util.Locale.ROOT) + head.substring(1);
  }
}
