package org.openmetadata.it.tests.mcp;

import java.util.List;
import java.util.Map;

/**
 * How one MCP client registers and signs in, recorded from the client's documentation, published
 * metadata or source. The real applications cannot sign in without a person, so the tests replay
 * what is distinct about each: the registration body, the redirect URI, the protocol version and
 * whether it sends the RFC 8707 {@code resource} parameter.
 *
 * <p>Where a client does not publish the protocol version it sends, the row carries one the server
 * supports and says so in a comment.
 *
 * <p>A passing row proves the server accepts the recorded profile, not that today's release of the
 * application works. {@link #source()} and {@link #verifiedOn()} say where a row came from and when,
 * so it can be refreshed.
 */
public record McpClientProfile(
    String label,
    String userAgent,
    Map<String, Object> registration,
    String redirectUri,
    String protocolVersion,
    boolean sendsResource,
    String source,
    String verifiedOn) {

  private static final String VERIFIED_ON = "2026-11-19";
  private static final String PROTOCOL_2025_03_26 = "2025-03-26";
  private static final String PROTOCOL_2025_06_18 = "2025-06-18";
  private static final String PROTOCOL_2025_11_25 = "2025-11-25";
  private static final String CURSOR_LOOPBACK = "http://localhost:8787/callback";
  private static final String CURSOR_NATIVE = "cursor://anysphere.cursor-mcp/oauth/callback";
  private static final String CURSOR_SOURCE =
      "https://forum.cursor.com/t/cursor-mcp-dcr-still-omits-application-type-and-uses-a-non-rfc-8252-compliant-private-redirect-uri-3-14-27/167608";

  @Override
  public String toString() {
    return label;
  }

  public McpClientProfile withProtocolVersion(String version) {
    return new McpClientProfile(
        label, userAgent, registration, redirectUri, version, sendsResource, source, verifiedOn);
  }

  /** Every client that registers itself and signs in with the authorization-code flow. */
  public static List<McpClientProfile> oauthClients() {
    return List.of(
        new McpClientProfile(
            "Claude Code",
            "claude-code/2.1.328 (cli)",
            publicClient("Claude Code", List.of("http://localhost:53682/callback")),
            "http://localhost:53682/callback",
            PROTOCOL_2025_11_25,
            true,
            "https://code.claude.com/docs/en/mcp",
            VERIFIED_ON),
        new McpClientProfile(
            "Claude.ai",
            null,
            publicClient("Claude", List.of("https://claude.ai/api/mcp/auth_callback")),
            "https://claude.ai/api/mcp/auth_callback",
            PROTOCOL_2025_11_25,
            true,
            "https://claude.com/docs/connectors/building/authentication",
            VERIFIED_ON),
        cursor("Cursor", CURSOR_LOOPBACK),
        cursor("Cursor (app scheme)", CURSOR_NATIVE),
        new McpClientProfile(
            "VS Code",
            null,
            nativeClient(
                "Visual Studio Code",
                List.of(
                    "https://insiders.vscode.dev/redirect",
                    "https://vscode.dev/redirect",
                    "http://127.0.0.1/",
                    "http://127.0.0.1:33418/")),
            "http://127.0.0.1:33418/",
            PROTOCOL_2025_11_25,
            true,
            "https://github.com/microsoft/vscode/blob/main/src/vs/base/common/oauth.ts",
            VERIFIED_ON),
        // The protocol version ChatGPT sends is not published; this is one the server supports.
        new McpClientProfile(
            "ChatGPT",
            null,
            publicClient(
                "ChatGPT", List.of("https://chatgpt.com/connector_platform_oauth_redirect")),
            "https://chatgpt.com/connector_platform_oauth_redirect",
            PROTOCOL_2025_06_18,
            true,
            "https://developers.openai.com/apps-sdk/build/auth",
            VERIFIED_ON),
        // The protocol version Codex sends is not published; this is one the server supports.
        new McpClientProfile(
            "Codex CLI",
            null,
            nativeClient("Codex", List.of("http://127.0.0.1:53683/callback")),
            "http://127.0.0.1:53683/callback",
            PROTOCOL_2025_06_18,
            false,
            "https://github.com/openai/codex/blob/main/codex-rs/rmcp-client/src/oauth.rs",
            VERIFIED_ON),
        new McpClientProfile(
            "Gemini CLI",
            null,
            publicClient("Gemini CLI MCP Client", List.of("http://localhost:53684/oauth/callback")),
            "http://localhost:53684/oauth/callback",
            PROTOCOL_2025_11_25,
            true,
            "https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/mcp/oauth-provider.ts",
            VERIFIED_ON),
        new McpClientProfile(
            "mcp-remote",
            null,
            publicClient("MCP CLI Client", List.of("http://localhost:3334/oauth/callback")),
            "http://localhost:3334/oauth/callback",
            PROTOCOL_2025_03_26,
            false,
            "https://github.com/geelen/mcp-remote/blob/main/src/lib/node-oauth-client-provider.ts",
            VERIFIED_ON));
  }

  // Cursor registers all three callbacks at once and does not send application_type. The protocol
  // version it sends is not published; this is one the server supports.
  private static McpClientProfile cursor(String label, String redirectUri) {
    return new McpClientProfile(
        label,
        null,
        publicClient(
            "Cursor",
            List.of(
                CURSOR_NATIVE,
                "https://www.cursor.com/agents/mcp/oauth/callback",
                CURSOR_LOOPBACK)),
        redirectUri,
        PROTOCOL_2025_06_18,
        true,
        CURSOR_SOURCE,
        VERIFIED_ON);
  }

  private static Map<String, Object> publicClient(String name, List<String> redirectUris) {
    return Map.of(
        "client_name",
        name,
        "redirect_uris",
        redirectUris,
        "grant_types",
        List.of("authorization_code", "refresh_token"),
        "response_types",
        List.of("code"),
        "token_endpoint_auth_method",
        "none");
  }

  private static Map<String, Object> nativeClient(String name, List<String> redirectUris) {
    return Map.of(
        "client_name",
        name,
        "redirect_uris",
        redirectUris,
        "grant_types",
        List.of("authorization_code", "refresh_token"),
        "response_types",
        List.of("code"),
        "token_endpoint_auth_method",
        "none",
        "application_type",
        "native");
  }
}
