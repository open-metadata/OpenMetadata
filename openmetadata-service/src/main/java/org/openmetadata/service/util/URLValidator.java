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

package org.openmetadata.service.util;

import jakarta.ws.rs.BadRequestException;
import java.net.InetAddress;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;

/**
 * Utility class for validating URLs to prevent SSRF attacks.
 */
@Slf4j
public class URLValidator {
  private static final List<String> ALLOWED_SCHEMES = Arrays.asList("http", "https");
  private static final String PRIVATE_NETWORK_MESSAGE =
      "URL targeting private/internal network not allowed";
  private static final String ALLOW_INTERNAL = "OPENMETADATA_ALLOW_INTERNAL_URL_TARGETS";
  private static final Pattern PRIVATE_IP_PATTERN =
      Pattern.compile(
          "^(127\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.|169\\.254\\.|\\[?::1\\]?|\\[?[fF][cCdD][0-9a-fA-F]{0,2}:|\\[?[fF][eE][89abAB][0-9a-fA-F]:).*");

  public static void validateURL(String urlString) {
    if (urlString == null || urlString.trim().isEmpty()) {
      throw new BadRequestException("URL cannot be empty");
    }

    String host = getString(urlString);

    if (PRIVATE_IP_PATTERN.matcher(host).matches()) {
      throw new BadRequestException(PRIVATE_NETWORK_MESSAGE);
    }

    validateResolvedAddresses(host);
  }

  /**
   * The literal-form check above only sees the text of the host, so it misses every spelling that
   * resolves to an internal address without looking like one: {@code localhost}, a decimal/octal
   * IPv4 encoding such as {@code 2130706433}, or an attacker-controlled DNS name with a private A
   * record. Resolve the host and judge the addresses themselves. Every returned address is checked,
   * so a name publishing both a public and a private record is still rejected.
   *
   * <p>A host that does not resolve is left to the literal check alone. Rejecting it instead would
   * fail every legitimate endpoint the API node cannot resolve at config time (egress-proxied or
   * split-horizon DNS) and would break offline builds, while gaining nothing: a name that resolves
   * to nothing now but to an internal address at connect time is the DNS-rebinding case, which
   * needs address pinning at the HTTP client — not a stricter check here.
   */
  private static void validateResolvedAddresses(String host) {
    if (isResolutionCheckDisabled()) {
      LOG.debug(
          "Resolved-address SSRF check disabled by {}; allowing host {}", ALLOW_INTERNAL, host);
    } else if (Arrays.stream(resolve(host)).anyMatch(URLValidator::isInternalAddress)) {
      throw new BadRequestException(PRIVATE_NETWORK_MESSAGE);
    }
  }

  /**
   * Escape hatch for deployments that legitimately target an internal address — a notification
   * sidecar on loopback, or a webhook receiver only reachable on the cluster network. Defaults to
   * enforcing; the literal-form pattern above is unaffected either way, so a URL written as a
   * private IP stays blocked regardless of this setting.
   */
  private static boolean isResolutionCheckDisabled() {
    String value = System.getProperty(ALLOW_INTERNAL);
    if (value == null) {
      value = System.getenv(ALLOW_INTERNAL);
    }
    return Boolean.parseBoolean(value);
  }

  private static InetAddress[] resolve(String host) {
    InetAddress[] addresses;
    try {
      addresses = InetAddress.getAllByName(host);
    } catch (UnknownHostException e) {
      LOG.debug("Host {} did not resolve; relying on literal-form validation only", host);
      addresses = new InetAddress[0];
    }
    return addresses;
  }

  private static boolean isInternalAddress(InetAddress address) {
    return address.isLoopbackAddress()
        || address.isAnyLocalAddress()
        || address.isLinkLocalAddress()
        || address.isSiteLocalAddress()
        || address.isMulticastAddress()
        || isUniqueLocalIpv6(address);
  }

  /**
   * {@code InetAddress.isSiteLocalAddress()} only covers the deprecated {@code fec0::/10} range for
   * IPv6, so unique-local addresses ({@code fc00::/7}) — which include the AWS IMDS endpoint
   * {@code fd00:ec2::254} — need their own check.
   */
  private static boolean isUniqueLocalIpv6(InetAddress address) {
    byte[] octets = address.getAddress();
    return octets.length == 16 && (octets[0] & 0xFE) == 0xFC;
  }

  private static @NotNull String getString(String urlString) {
    URL url;
    try {
      URI uri = new URI(urlString);
      url = uri.toURL();
    } catch (URISyntaxException | MalformedURLException e) {
      try {
        url = new URL(urlString);
      } catch (MalformedURLException ex) {
        throw new BadRequestException("Invalid URL format: " + ex.getMessage());
      }
    }

    String protocol = url.getProtocol().toLowerCase();
    if (!ALLOWED_SCHEMES.contains(protocol)) {
      throw new BadRequestException("URL scheme not allowed: " + protocol);
    }

    String host = url.getHost();
    if (host == null || host.trim().isEmpty()) {
      throw new BadRequestException("URL must have a valid host");
    }

    return host.toLowerCase();
  }
}
