package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.common.net.InetAddresses;
import jakarta.ws.rs.BadRequestException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The resolver is injected so these never touch DNS. Real lookups would make the suite depend on
 * the network of whoever runs it, and on hosts the project does not control.
 */
class OutboundUrlPolicyTest {
  private static final Map<String, String> DNS =
      Map.ofEntries(
          Map.entry("receiver.example.com", "93.184.216.34"),
          Map.entry("fd123.okta.com", "93.184.216.34"),
          Map.entry("fcdomain.com", "93.184.216.34"),
          Map.entry("fe80-test.com", "93.184.216.34"),
          Map.entry("n8n.internal", "10.20.0.5"),
          Map.entry("elasticsearch", "172.18.0.2"),
          Map.entry("receiver.tailnet.ts.net", "100.101.102.103"),
          Map.entry("local.test", "127.0.0.1"),
          Map.entry("metadata.internal", "169.254.169.254"),
          Map.entry("metadata.alibaba", "100.100.100.200"),
          Map.entry("metadata.aws.v6", "fd00:ec2::254"),
          Map.entry("nat64.example.com", "64:ff9b::a9fe:a9fe"));

  private final OutboundUrlPolicy policy = new OutboundUrlPolicy(OutboundUrlPolicyTest::resolve);

  private static InetAddress[] resolve(String host) throws UnknownHostException {
    String address = DNS.get(host);
    if (address != null) {
      return InetAddress.getAllByName(address);
    }
    String bare = host.startsWith("[") ? host.substring(1, host.length() - 1) : host;
    if (InetAddresses.isInetAddress(bare)) {
      return InetAddress.getAllByName(host);
    }
    throw new UnknownHostException(host);
  }

  @Test
  void publicHostnameIsAllowed() {
    assertDoesNotThrow(() -> policy.checkForSave("https://receiver.example.com/hook"));
  }

  @Test
  void hostnameStartingLikeAnIpv6PrefixIsAllowed() {
    // The old text pattern rejected these outright; they are ordinary public hosts.
    assertDoesNotThrow(() -> policy.checkForSave("https://fd123.okta.com/.well-known/config"));
    assertDoesNotThrow(() -> policy.checkForSave("https://fcdomain.com/api"));
    assertDoesNotThrow(() -> policy.checkForSave("https://fe80-test.com/api"));
  }

  @Test
  void hostnameOnTheClusterNetworkIsAllowed() {
    // Reaching a receiver on the same network is supported, and is why the block stays narrow.
    assertDoesNotThrow(() -> policy.checkForSave("http://n8n.internal:5678/webhook"));
    assertDoesNotThrow(() -> policy.checkForSave("http://elasticsearch:9200/"));
  }

  @Test
  void hostnameResolvingToThisMachineIsAllowed() {
    // The operator can reach their own machine, and local development depends on being able to
    // point an alert at a receiver running beside the server.
    assertDoesNotThrow(() -> policy.checkForSave("http://local.test:8585/api"));
  }

  @Test
  void hostnameResolvingToLinkLocalIsRejected() {
    assertThrows(
        BadRequestException.class,
        () -> policy.checkForSave("http://metadata.internal/computeMetadata/v1/"));
  }

  @Test
  void hostnameResolvingToAMetadataServiceIsRejected() {
    // These hand out the workload's own identity, which is what the operator cannot reach either.
    assertThrows(
        BadRequestException.class, () -> policy.checkForSave("http://metadata.alibaba/latest/"));
    assertThrows(
        BadRequestException.class, () -> policy.checkForSave("http://metadata.aws.v6/latest/"));
  }

  @Test
  void nat64AddressWrappingLinkLocalIsRejected() {
    assertThrows(
        BadRequestException.class, () -> policy.checkForSave("http://nat64.example.com/hook"));
  }

  @Test
  void carrierGradeNatIsNotRefusedAsARange() {
    // 100.64.0.0/10 is also where Tailscale puts tailnet addresses; only the metadata address in
    // that range is refused.
    assertDoesNotThrow(() -> policy.checkForSave("https://receiver.tailnet.ts.net/hook"));
  }

  @Test
  void unresolvableHostIsAcceptedOnSaveAndRejectedOnConnect() {
    // A receiver whose DNS is not up yet is a normal thing to configure; by dispatch it is not.
    assertDoesNotThrow(() -> policy.checkForSave("https://not-yet-in-dns.example.com/hook"));
    assertThrows(
        OutboundUrlBlockedException.class,
        () -> policy.checkForConnect(URI.create("https://not-yet-in-dns.example.com/hook")));
  }

  @Test
  void connectPathReportsAPolicyRejection() {
    assertThrows(
        OutboundUrlBlockedException.class,
        () -> policy.checkForConnect(URI.create("http://metadata.internal/computeMetadata/v1/")));
  }

  @Test
  void addressWrittenDirectlyKeepsItsExistingRule() {
    // Unchanged from the regex it replaces: an internal address written as one is still refused.
    assertThrows(BadRequestException.class, () -> policy.checkForSave("http://10.0.0.1"));
    assertThrows(BadRequestException.class, () -> policy.checkForSave("http://192.168.1.1:3000"));
    assertThrows(BadRequestException.class, () -> policy.checkForSave("http://[fd00::1]"));
  }
}
