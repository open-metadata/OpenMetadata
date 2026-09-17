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

import com.google.common.annotations.VisibleForTesting;
import com.google.common.net.InetAddresses;
import jakarta.ws.rs.BadRequestException;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;

/**
 * Decides which outbound URLs the server will dial on a user's behalf. The host is resolved and
 * every address behind it is classified, so the decision is made about the address the connection
 * will actually use rather than about how the host happens to be spelled.
 */
@Slf4j
public class OutboundUrlPolicy {
  @FunctionalInterface
  public interface HostResolver {
    InetAddress[] resolve(String host) throws UnknownHostException;
  }

  private static final List<String> ALLOWED_SCHEMES = List.of("http", "https");
  private static final OutboundUrlPolicy DEFAULT = new OutboundUrlPolicy(InetAddress::getAllByName);

  private static volatile OutboundUrlPolicy instance = DEFAULT;

  private final HostResolver resolver;

  public OutboundUrlPolicy(HostResolver resolver) {
    this.resolver = resolver;
  }

  public static OutboundUrlPolicy getInstance() {
    return instance;
  }

  /**
   * Lets a test point the policy at a stub resolver. A test that needs a real HTTP endpoint has to
   * bind it to this machine, and the policy would otherwise refuse the request under test.
   */
  @VisibleForTesting
  public static void setInstance(OutboundUrlPolicy policy) {
    instance = policy == null ? DEFAULT : policy;
  }

  @VisibleForTesting
  public static void resetInstance() {
    instance = DEFAULT;
  }

  /**
   * Write path. A host that does not resolve is accepted, because configuring a receiver whose DNS
   * is not up yet is legitimate and the connect-time check is what guards the request.
   */
  public void checkForSave(String urlString) {
    String rejection = evaluate(urlString, false);
    if (rejection != null) {
      throw new BadRequestException(rejection);
    }
  }

  /** Connect path. The request is about to leave, so a host that does not resolve is rejected. */
  public void checkForConnect(URI uri) {
    String rejection = evaluate(uri == null ? null : uri.toString(), true);
    if (rejection != null) {
      LOG.warn("Outbound request blocked: {}", rejection);
      throw new OutboundUrlBlockedException(rejection);
    }
  }

  /**
   * True when the URL leads somewhere only this network can reach. Used to decide what may be
   * reflected back to the caller, not whether to send: an internal receiver is still delivered to.
   */
  public boolean isInternalTarget(String urlString) {
    URL url = urlString == null ? null : parse(urlString);
    if (url == null || url.getHost() == null || url.getHost().trim().isEmpty()) {
      return false;
    }
    try {
      return Arrays.stream(resolver.resolve(url.getHost().toLowerCase()))
          .anyMatch(address -> isLocalAddress(address) || isPrivateAddress(address));
    } catch (UnknownHostException e) {
      return false;
    }
  }

  private String evaluate(String urlString, boolean rejectUnresolvable) {
    if (urlString == null || urlString.trim().isEmpty()) {
      return "URL cannot be empty";
    }
    URL url = parse(urlString);
    if (url == null) {
      return "Invalid URL format";
    }
    String scheme = url.getProtocol().toLowerCase();
    if (!ALLOWED_SCHEMES.contains(scheme)) {
      return "URL scheme not allowed: " + scheme;
    }
    String host = url.getHost();
    if (host == null || host.trim().isEmpty()) {
      return "URL must have a valid host";
    }
    return hostRejection(host.toLowerCase(), rejectUnresolvable);
  }

  private String hostRejection(String host, boolean rejectUnresolvable) {
    InetAddress[] addresses;
    try {
      addresses = resolver.resolve(host);
    } catch (UnknownHostException e) {
      return rejectUnresolvable ? String.format("%s cannot be resolved", host) : null;
    }
    boolean literal = InetAddresses.isInetAddress(stripBrackets(host));
    return Arrays.stream(addresses)
        .map(address -> addressRejection(host, address, literal))
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  /**
   * A host written as an address keeps the rule it has always had: an internal address is refused
   * outright. A host written as a name is refused only when it leads back to this machine, so a
   * receiver that lives on the cluster network and is addressed by its name keeps working.
   */
  private static String addressRejection(String host, InetAddress address, boolean literal) {
    if (isLocalAddress(address)) {
      return String.format("%s resolves to a loopback or link-local address", host);
    }
    if (literal && isPrivateAddress(address)) {
      return "URL targeting private/internal network not allowed";
    }
    return null;
  }

  /**
   * The unspecified address is included with loopback: connecting to 0.0.0.0 or :: reaches the local
   * host, so leaving it out would reopen the case this rejects.
   */
  private static boolean isLocalAddress(InetAddress address) {
    return address.isLoopbackAddress()
        || address.isLinkLocalAddress()
        || address.isAnyLocalAddress();
  }

  private static boolean isPrivateAddress(InetAddress address) {
    return address.isSiteLocalAddress() || isUniqueLocal(address);
  }

  /** fc00::/7, which isSiteLocalAddress does not cover: it only knows the deprecated fec0::/10. */
  private static boolean isUniqueLocal(InetAddress address) {
    return address instanceof Inet6Address && (address.getAddress()[0] & 0xFE) == 0xFC;
  }

  private static String stripBrackets(String host) {
    return host.startsWith("[") && host.endsWith("]") ? host.substring(1, host.length() - 1) : host;
  }

  private static URL parse(String urlString) {
    try {
      return new URI(urlString).toURL();
    } catch (URISyntaxException | MalformedURLException | IllegalArgumentException e) {
      return parseLegacy(urlString);
    }
  }

  private static URL parseLegacy(String urlString) {
    try {
      return new URL(urlString);
    } catch (MalformedURLException e) {
      return null;
    }
  }
}
