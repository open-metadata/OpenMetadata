package org.openmetadata.it.server;

import java.net.URI;
import java.util.Objects;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Connection details for a running OpenMetadata (or Collate) server under test.
 *
 * <p>The harness is intentionally agnostic about whether the server is booted
 * in-JVM by Testcontainers (embedded mode) or reached over the network from a
 * pre-running stack (external mode, Phase 3+). Tests construct a {@code ServerHandle}
 * once in {@code @BeforeAll} and pass it to helpers.
 */
public final class ServerHandle {

  private final URI baseUrl;
  private final OpenMetadataClient sdkClient;
  private final String searchHost;
  private final int searchPort;
  private final String searchScheme;
  private final boolean external;

  public ServerHandle(
      final URI baseUrl,
      final OpenMetadataClient sdkClient,
      final String searchHost,
      final int searchPort,
      final String searchScheme) {
    this(baseUrl, sdkClient, searchHost, searchPort, searchScheme, false);
  }

  public ServerHandle(
      final URI baseUrl,
      final OpenMetadataClient sdkClient,
      final String searchHost,
      final int searchPort,
      final String searchScheme,
      final boolean external) {
    this.baseUrl = Objects.requireNonNull(baseUrl, "baseUrl");
    this.sdkClient = Objects.requireNonNull(sdkClient, "sdkClient");
    this.searchHost = Objects.requireNonNull(searchHost, "searchHost");
    this.searchPort = searchPort;
    this.searchScheme = Objects.requireNonNull(searchScheme, "searchScheme");
    this.external = external;
  }

  /**
   * Whether this server is reached over the network (external mode) rather than booted in-JVM. In
   * external mode the search engine isn't directly reachable, so {@link
   * org.openmetadata.it.search.SearchClient} routes index introspection through the server's typed
   * {@code /v1/search/operations} endpoints instead of {@code searchHost:searchPort}.
   */
  public boolean isExternal() {
    return external;
  }

  public URI baseUrl() {
    return baseUrl;
  }

  /**
   * The SDK client for API calls. In external mode, where a long-running suite can outlive the
   * login token's TTL, this delegates to {@link SdkClients#adminClient()} — the refresh-aware
   * client that {@code ExternalTokenRefresher} rebuilds on each re-login. The boot client captured
   * at construction carries the original token and would 401 once it expires, so we never hand it
   * out while an admin-token override is in effect. Embedded mode (24h harness token) and a
   * standalone {@link org.openmetadata.it.server.ExternalServer} with no override keep the boot
   * client.
   */
  public OpenMetadataClient sdk() {
    final OpenMetadataClient current;
    if (external && SdkClients.hasAdminOverride()) {
      current = SdkClients.adminClient();
    } else {
      current = sdkClient;
    }
    return current;
  }

  public String searchHost() {
    return searchHost;
  }

  public int searchPort() {
    return searchPort;
  }

  public String searchScheme() {
    return searchScheme;
  }
}
