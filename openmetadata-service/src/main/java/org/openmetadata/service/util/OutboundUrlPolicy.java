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
import java.util.ArrayList;
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

  /**
   * Metadata services that hand out the workload's own identity and that the JDK predicates do not
   * classify. Listed by address rather than by range on purpose: 100.64.0.0/10 is also where
   * Tailscale puts tailnet addresses, and refusing the range would break receivers reached that way.
   */
  private static final List<InetAddress> METADATA_ADDRESSES =
      metadataAddresses("100.100.100.200", "fd00:ec2::254");

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
    if (isLocalAddress(address) || isMetadataAddress(address) || isNat64Local(address)) {
      return String.format("%s resolves to a loopback, link-local or metadata address", host);
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

  private static boolean isMetadataAddress(InetAddress address) {
    return METADATA_ADDRESSES.contains(address);
  }

  /** 64:ff9b::/96 can carry a loopback or metadata IPv4 address inside a public-looking IPv6 one. */
  private static boolean isNat64Local(InetAddress address) {
    byte[] bytes = address.getAddress();
    if (!(address instanceof Inet6Address) || bytes[0] != 0 || bytes[1] != 0x64) {
      return false;
    }
    if (bytes[2] != (byte) 0xff || bytes[3] != (byte) 0x9b) {
      return false;
    }
    for (int i = 4; i < 12; i++) {
      if (bytes[i] != 0) {
        return false;
      }
    }
    return embeddedIsLocal(Arrays.copyOfRange(bytes, 12, 16));
  }

  private static boolean embeddedIsLocal(byte[] ipv4) {
    try {
      InetAddress embedded = InetAddress.getByAddress(ipv4);
      return isLocalAddress(embedded) || isMetadataAddress(embedded);
    } catch (UnknownHostException e) {
      return false;
    }
  }

  private static List<InetAddress> metadataAddresses(String... literals) {
    List<InetAddress> addresses = new ArrayList<>();
    for (String literal : literals) {
      try {
        addresses.add(InetAddress.getByName(literal));
      } catch (UnknownHostException e) {
        LOG.warn("Could not parse metadata address {}", literal);
      }
    }
    return List.copyOf(addresses);
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
