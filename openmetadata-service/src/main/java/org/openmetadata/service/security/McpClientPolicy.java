/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security;

import com.google.common.net.InetAddresses;
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
  private static final String LOCALHOST = "localhost";
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
    if (isLoopback(normalizedHost)) {
      if (!Boolean.TRUE.equals(configuration.getAllowLoopbackRedirects())) {
        throw new IllegalArgumentException("Loopback redirects are disabled");
      }
    } else {
      validateRemoteHost(normalizedHost, scheme);
    }
  }

  private static boolean isLoopback(final String host) {
    final String bare = host.startsWith("[") ? host.substring(1, host.length() - 1) : host;
    if (InetAddresses.isInetAddress(bare)) {
      return InetAddresses.forString(bare).isLoopbackAddress();
    }
    final String name = bare.endsWith(".") ? bare.substring(0, bare.length() - 1) : bare;
    final String lastLabel = name.substring(name.lastIndexOf('.') + 1);
    // Browsers interpret noncanonical numeric hosts as IP addresses; never classify them as DNS
    // names.
    if (lastLabel.matches("[0-9]+|0x[0-9a-f]+") || bare.contains(":")) {
      throw new IllegalArgumentException("Redirect URI must use a canonical IP address");
    }
    return LOCALHOST.equals(name) || name.endsWith("." + LOCALHOST);
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
