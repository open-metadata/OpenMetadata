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
  private static final Duration REBUILD_TIMEOUT = ReindexHelpers.reindexTimeout();

  @Override
  public void beforeEach(final ExtensionContext context) {
    final ServerHandle server = OssTestServer.defaultHandle();
    resumeEngineIfPaused();
    rebuildBaseline(server);
  }

  private void resumeEngineIfPaused() {
    try {
      EsOutageInjector.unpause();
    } catch (final RuntimeException e) {
      LOG.debug("Search engine resume was a no-op (not paused / not embedded): {}", e.toString());
    }
  }

  /**
   * Always recreate every index up front. A presence probe is unreliable here — a prior test can
   * leave an alias pointing at a dropped/staged index (still "present" but unqueryable), and a
   * non-recreate reindex won't rebuild a missing index or re-promote a swapped alias. A full
   * recreate restores a clean, queryable baseline regardless of the prior test's end state.
   *
   * <p>{@link ReindexHelpers#recreateAllAndWait} throws if the baseline never succeeds, so a
   * still-broken cluster fails the test fast with a clear cause rather than as a misleading
   * per-test assertion failure.
   */
  private void rebuildBaseline(final ServerHandle server) {
    LOG.info("Recreating all search indices to restore a clean baseline before test");
    ReindexHelpers.recreateAllAndWait(server, REBUILD_TIMEOUT);
  }
}
