package org.openmetadata.it.search;

import java.time.Duration;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Restores the shared embedded search cluster to a known-good baseline before each
 * server-global search IT.
 *
 * <p>The {@code tests/search/*IT} classes mutate cluster-wide state — full reindex with
 * {@code recreateIndex=true}, alias swaps, and pausing the engine container via {@link
 * EsOutageInjector}. They run serially in the {@code search-it} profile against one reused
 * server, so a test that drops indices or leaves the engine paused would otherwise cascade
 * {@code index_not_found} / read-timeout failures across every test that follows. This
 * extension makes each test order-independent by re-establishing the baseline up front:
 * resume the engine if it was paused, and rebuild all indices if they are missing.
 */
public final class SearchClusterResetExtension implements BeforeEachCallback {

  private static final Logger LOG = LoggerFactory.getLogger(SearchClusterResetExtension.class);
  private static final String PROBE_INDEX = "table_search_index";
  private static final Duration REBUILD_TIMEOUT = Duration.ofMinutes(5);

  @Override
  public void beforeEach(final ExtensionContext context) {
    final ServerHandle server = OssTestServer.defaultHandle();
    resumeEngineIfPaused();
    rebuildIndicesIfMissing(server);
  }

  private void resumeEngineIfPaused() {
    try {
      EsOutageInjector.unpause();
    } catch (final RuntimeException e) {
      LOG.debug("Search engine resume was a no-op (not paused / not embedded): {}", e.toString());
    }
  }

  private void rebuildIndicesIfMissing(final ServerHandle server) {
    if (!indexPresent(server)) {
      LOG.info(
          "Search baseline missing ('{}' absent) — rebuilding all indices before test",
          PROBE_INDEX);
      ReindexHelpers.triggerSearchIndexAndWait(server, REBUILD_TIMEOUT);
    }
  }

  private boolean indexPresent(final ServerHandle server) {
    boolean present;
    try {
      present = new SearchAssertions(server).indexExists(PROBE_INDEX);
    } catch (final RuntimeException e) {
      present = false;
    }
    return present;
  }
}
