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

package org.openmetadata.service.migration.utils.v210;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.openmetadata.schema.type.Webhook;

/**
 * The check 1.13 and 2.0 made of a webhook's endpoint when they built its destination, kept as it
 * was: an http or https URL with a host, and a host that, as written, does not start like an
 * internal address. The server's outbound policy has changed since, so only this rule can tell
 * which alerts those releases could not build.
 */
final class PreviousReleaseEndpointRule {
  private static final List<String> ALLOWED_SCHEMES = List.of("http", "https");
  private static final Pattern INTERNAL_HOST =
      Pattern.compile(
          "^(127\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.|169\\.254\\.|\\[?::1\\]?|\\[?[fF][cCdD][0-9a-fA-F]{0,2}:|\\[?[fF][eE][89abAB][0-9a-fA-F]:).*");

  private PreviousReleaseEndpointRule() {}

  /** Throws, saying why, when those releases refused the endpoint. */
  static void require(Webhook webhook) {
    if (webhook != null && webhook.getEndpoint() != null) {
      String host = hostOf(webhook.getEndpoint().toString());
      if (INTERNAL_HOST.matcher(host).matches()) {
        throw new IllegalArgumentException("URL targeting private/internal network not allowed");
      }
    }
  }

  private static String hostOf(String endpoint) {
    URL url = parse(endpoint);
    String scheme = url.getProtocol().toLowerCase(Locale.ROOT);
    if (!ALLOWED_SCHEMES.contains(scheme)) {
      throw new IllegalArgumentException("URL scheme not allowed: " + scheme);
    }
    String host = url.getHost();
    if (host == null || host.isBlank()) {
      throw new IllegalArgumentException("URL must have a valid host");
    }
    return host.toLowerCase(Locale.ROOT);
  }

  private static URL parse(String endpoint) {
    if (endpoint.isBlank()) {
      throw new IllegalArgumentException("URL cannot be empty");
    }
    try {
      return new URI(endpoint).toURL();
    } catch (URISyntaxException | MalformedURLException e) {
      return parseAsWritten(endpoint);
    }
  }

  private static URL parseAsWritten(String endpoint) {
    try {
      return new URL(endpoint);
    } catch (MalformedURLException e) {
      throw new IllegalArgumentException("Invalid URL format: " + e.getMessage());
    }
  }
}
