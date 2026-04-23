/*
 *  Copyright 2021 Collate
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

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;

/**
 * Validates post-authentication redirect URIs against an allowlist of trusted base URLs to
 * prevent open-redirect attacks that could leak freshly minted JWT access tokens to
 * attacker-controlled hosts.
 */
@Slf4j
public final class RedirectUriValidator {
  private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

  private RedirectUriValidator() {}

  /**
   * Returns true if {@code candidate} is safe to use as a post-login redirect target.
   *
   * <p>Accepted forms:
   *
   * <ul>
   *   <li>Null / empty — caller decides, returns false here so callers fall back to defaults.
   *   <li>Site-relative path starting with {@code /} (but not {@code //}).
   *   <li>Absolute http/https URI whose scheme + host + port match one of {@code allowedBaseUrls}.
   * </ul>
   */
  public static boolean isSafe(String candidate, String... allowedBaseUrls) {
    if (CommonUtil.nullOrEmpty(candidate)) {
      return false;
    }
    if (candidate.startsWith("/") && !candidate.startsWith("//")) {
      return true;
    }
    URI uri;
    try {
      uri = new URI(candidate);
    } catch (URISyntaxException e) {
      LOG.warn("Rejecting malformed redirect URI");
      return false;
    }
    String scheme = uri.getScheme();
    String host = uri.getHost();
    if (scheme == null
        || host == null
        || !ALLOWED_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))) {
      LOG.warn("Rejecting redirect URI with unsupported scheme or missing host");
      return false;
    }
    int candidatePort = effectivePort(scheme, uri.getPort());
    if (allowedBaseUrls == null) {
      LOG.warn("Rejecting redirect URI (no allowlist configured)");
      return false;
    }
    for (String base : allowedBaseUrls) {
      if (CommonUtil.nullOrEmpty(base)) {
        continue;
      }
      try {
        URI baseUri = new URI(base);
        if (baseUri.getHost() == null) {
          continue;
        }
        int basePort = effectivePort(baseUri.getScheme(), baseUri.getPort());
        if (scheme.equalsIgnoreCase(baseUri.getScheme())
            && host.equalsIgnoreCase(baseUri.getHost())
            && candidatePort == basePort) {
          return true;
        }
      } catch (URISyntaxException ignored) {
        // Try next base URL.
      }
    }
    LOG.warn("Rejecting redirect URI (host not in allowlist)");
    return false;
  }

  private static int effectivePort(String scheme, int port) {
    if (port != -1) {
      return port;
    }
    if (scheme == null) {
      return -1;
    }
    return switch (scheme.toLowerCase(Locale.ROOT)) {
      case "https" -> 443;
      case "http" -> 80;
      default -> -1;
    };
  }
}
