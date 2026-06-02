package org.openmetadata.it.server;

import java.net.URI;
import java.util.Objects;
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
   * org.openmetadata.it.search.SearchClient} routes index introspection through the server's
   * {@code /v1/test-support/search} passthrough instead of {@code searchHost:searchPort}.
   */
  public boolean isExternal() {
    return external;
  }

  public URI baseUrl() {
    return baseUrl;
  }

  public OpenMetadataClient sdk() {
    return sdkClient;
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
