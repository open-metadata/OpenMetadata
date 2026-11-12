package org.openmetadata.service.security;

import java.net.URI;
import java.util.Collection;
import java.util.Locale;
import java.util.Set;
import org.openmetadata.schema.api.configuration.MCPConfiguration;

/** Registration and authorization share the same operator-controlled redirect boundary. */
public final class McpClientPolicy {
  private static final Set<String> FORBIDDEN_SCHEMES =
      Set.of(
          "javascript",
          "data",
          "file",
          "blob",
          "vbscript",
          "ftp",
          "ftps",
          "ws",
          "wss",
          "mailto",
          "tel");
  private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "[::1]");
  private static final String HTTPS = "https";
  private static final String HTTP = "http";
  private static final int MAX_REDIRECT_LENGTH = 2048;
  private final MCPConfiguration configuration;

  public McpClientPolicy(final MCPConfiguration configuration) {
    this.configuration = configuration == null ? new MCPConfiguration() : configuration;
  }

  public boolean registrationEnabled() {
    return Boolean.TRUE.equals(configuration.getDynamicClientRegistrationEnabled());
  }

  public void validateRedirect(final URI uri) {
    if (uri == null
        || uri.toString().length() > MAX_REDIRECT_LENGTH
        || uri.getScheme() == null
        || uri.getRawFragment() != null
        || uri.getRawUserInfo() != null) {
      throw new IllegalArgumentException("Invalid redirect URI");
    }
    final String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
    if (FORBIDDEN_SCHEMES.contains(scheme)) {
      throw new IllegalArgumentException("Redirect URI scheme is not permitted");
    }
    if (HTTPS.equals(scheme) || HTTP.equals(scheme)) {
      validateWebRedirect(uri, scheme);
    } else if (!Boolean.TRUE.equals(configuration.getAllowNativeRedirects())) {
      throw new IllegalArgumentException("Native application redirects are disabled");
    }
  }

  private void validateWebRedirect(final URI uri, final String scheme) {
    final String host = uri.getHost();
    if (host == null || host.isBlank() || uri.getPort() > 65535 || uri.getPort() == 0) {
      throw new IllegalArgumentException("Redirect URI must have a valid host and port");
    }
    final String normalizedHost = host.toLowerCase(Locale.ROOT);
    if (LOOPBACK_HOSTS.contains(normalizedHost)) {
      if (!Boolean.TRUE.equals(configuration.getAllowLoopbackRedirects())) {
        throw new IllegalArgumentException("Loopback redirects are disabled");
      }
    } else {
      validateRemoteHost(normalizedHost, scheme);
    }
  }

  private void validateRemoteHost(final String host, final String scheme) {
    final Collection<String> allowed = configuration.getAllowedRedirectHosts();
    if (!HTTPS.equals(scheme)
        || (allowed != null
            && !allowed.isEmpty()
            && allowed.stream().noneMatch(host::equalsIgnoreCase))) {
      throw new IllegalArgumentException("Redirect host is not permitted by MCP policy");
    }
  }
}
