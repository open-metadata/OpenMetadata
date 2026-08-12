package org.openmetadata.mcp;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpTransportContextExtractor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
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

  /**
   * Upper bound on the persisted client name. The value comes from a user-controlled
   * {@code User-Agent} header, so we cap it to prevent oversized strings or junk characters from
   * leaking into the {@code McpToolCallUsage} rows. Mirrors {@code maxLength} on the
   * {@code clientName} property in {@code mcpToolCallUsage.json}.
   */
  static final int MAX_CLIENT_NAME_LENGTH = 64;

  /**
   * Ordered list of (predicate, label) pairs used to classify a lower-cased User-Agent into a
   * human-readable client name. Order matters — VS Code is checked before Claude CLI so a UA
   * containing both {@code claude} and {@code code} substrings (e.g. a Claude extension hosted in
   * VS Code) is attributed to the host process rather than the standalone CLI.
   */
  private static final List<UaMatcher> UA_MATCHERS =
      List.of(
          new UaMatcher(ua -> ua.contains("claude") && ua.contains("desktop"), "Claude Desktop"),
          new UaMatcher(
              ua ->
                  ua.contains("vscode")
                      || ua.contains("vs code")
                      || ua.contains("visual studio code"),
              "VS Code"),
          new UaMatcher(
              ua ->
                  ua.contains("claude-cli")
                      || ua.contains("claude-code")
                      || ua.contains("claude cli")
                      || ua.contains("claude code"),
              "Claude CLI"),
          new UaMatcher(ua -> ua.contains("cursor"), "Cursor"),
          new UaMatcher(ua -> ua.contains("zed"), "Zed"),
          new UaMatcher(ua -> ua.contains("windsurf"), "Windsurf"));

  /** Pairing of a User-Agent substring predicate with the label shown in the dashboard. */
  private record UaMatcher(Predicate<String> matches, String label) {}

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
   * Heuristic: classify the {@code User-Agent} into the labels the dashboard uses (Claude Desktop,
   * Cursor, VS Code, Claude CLI, etc.). MCP clients all set distinctive UAs — the table at
   * {@link #UA_MATCHERS} covers the common ones explicitly and we fall back to the raw product
   * token so a new client still surfaces in the breakdown without a code change. The fallback
   * value (and every label) is sanitised before return so the persisted value is bounded.
   */
  static String resolveClientName(String userAgent) {
    String resolved = null;
    if (userAgent != null && !userAgent.isBlank()) {
      String ua = userAgent.toLowerCase(Locale.ROOT);
      resolved =
          UA_MATCHERS.stream()
              .filter(matcher -> matcher.matches().test(ua))
              .map(UaMatcher::label)
              .findFirst()
              .orElseGet(() -> fallbackProductToken(userAgent));
    }
    return sanitize(resolved);
  }

  /**
   * First product token of the User-Agent (the bit before the first slash or space), capitalised.
   * Avoids leaking version strings into the dashboard while still surfacing unknown clients with a
   * human-readable label. Returns {@code null} when no usable token is present.
   */
  private static String fallbackProductToken(String userAgent) {
    String head = userAgent.split("[\\s/]", 2)[0];
    String result = null;
    if (!head.isBlank()) {
      result = head.substring(0, 1).toUpperCase(Locale.ROOT) + head.substring(1);
    }
    return result;
  }

  /**
   * Trims whitespace, strips ISO control characters, and caps the value to
   * {@link #MAX_CLIENT_NAME_LENGTH} characters. The User-Agent header is attacker-controlled so
   * the persisted value must be sanitised before it reaches the database or the dashboard.
   */
  private static String sanitize(String value) {
    String result = null;
    if (value != null) {
      StringBuilder sb = new StringBuilder(value.length());
      value.codePoints().filter(cp -> !Character.isISOControl(cp)).forEach(sb::appendCodePoint);
      String stripped = sb.toString().trim();
      if (!stripped.isEmpty()) {
        result =
            stripped.length() > MAX_CLIENT_NAME_LENGTH
                ? stripped.substring(0, MAX_CLIENT_NAME_LENGTH)
                : stripped;
      }
    }
    return result;
  }
}
