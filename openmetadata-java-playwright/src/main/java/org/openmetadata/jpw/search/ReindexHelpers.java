package org.openmetadata.jpw.search;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Drives the SearchIndexingApplication via the SDK and waits for run completion.
 *
 * <p>Triggering the app exercises the full reindex pipeline — {@code SearchIndexApp},
 * {@code ReindexingOrchestrator}, {@code BulkSink} — which is the surface most of the
 * EPIC #3731 fixes touch. Use this helper instead of the entity-level
 * {@code /v1/search/reindex} endpoint when a scenario must validate orchestrator behaviour.
 */
public final class ReindexHelpers {

  public static final String SEARCH_INDEX_APP = "SearchIndexingApplication";

  private static final Set<String> TERMINAL_STATUSES =
      Set.of("success", "failed", "completed", "stopped", "activeError");
  private static final Duration DEFAULT_TIMEOUT = Duration.ofMinutes(5);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  private ReindexHelpers() {}

  /** Triggers the named app via {@code POST /v1/apps/trigger/{name}}. */
  public static void triggerApp(final ServerHandle server, final String appName) {
    final HttpClient http = server.sdk().getHttpClient();
    http.execute(HttpMethod.POST, "/v1/apps/trigger/" + appName, null, Void.class);
  }

  /** Trigger SearchIndexingApplication and block until the latest run reaches a terminal state. */
  public static AppRunRecord triggerSearchIndexAndWait(final ServerHandle server) {
    return triggerSearchIndexAndWait(server, DEFAULT_TIMEOUT);
  }

  public static AppRunRecord triggerSearchIndexAndWait(
      final ServerHandle server, final Duration timeout) {
    waitForLatestRunTerminal(server, SEARCH_INDEX_APP, Duration.ofSeconds(30));
    final long triggeredAtMillis = System.currentTimeMillis();
    triggerApp(server, SEARCH_INDEX_APP);
    return waitForRunAfter(server, SEARCH_INDEX_APP, triggeredAtMillis, timeout);
  }

  /** Triggers a per-entity reindex via {@code POST /v1/search/reindex?entityType=...}. */
  public static void reindexEntityType(final ServerHandle server, final String entityType) {
    server.sdk().search().reindex(entityType);
  }

  /** Triggers reindex of all entity types via {@code POST /v1/search/reindex/all}. */
  public static void reindexAll(final ServerHandle server) {
    server.sdk().search().reindexAll();
  }

  private static AppRunRecord fetchLatestRun(final ServerHandle server, final String appName) {
    return server
        .sdk()
        .getHttpClient()
        .execute(
            HttpMethod.GET, "/v1/apps/name/" + appName + "/runs/latest", null, AppRunRecord.class);
  }

  private static boolean isTerminal(final AppRunRecord run) {
    if (run == null || run.getStatus() == null) {
      return true;
    }
    return TERMINAL_STATUSES.contains(run.getStatus().value());
  }

  private static void waitForLatestRunTerminal(
      final ServerHandle server, final String appName, final Duration timeout) {
    try {
      Awaitility.await("waitForLatestRunTerminal " + appName)
          .atMost(timeout)
          .pollInterval(POLL_INTERVAL)
          .ignoreExceptions()
          .until(() -> isTerminal(fetchLatestRun(server, appName)));
    } catch (ConditionTimeoutException ignored) {
      // Best-effort: trigger will retry if the previous run is still active.
    }
  }

  private static AppRunRecord waitForRunAfter(
      final ServerHandle server,
      final String appName,
      final long minStartMillis,
      final Duration timeout) {
    final Map<String, AppRunRecord> ref = new java.util.concurrent.ConcurrentHashMap<>();
    Awaitility.await("waitForRunAfter " + appName)
        .atMost(timeout)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(() -> isFreshTerminalRun(server, appName, minStartMillis, ref));
    return ref.get("latest");
  }

  private static boolean isFreshTerminalRun(
      final ServerHandle server,
      final String appName,
      final long minStartMillis,
      final Map<String, AppRunRecord> ref) {
    final AppRunRecord run = fetchLatestRun(server, appName);
    if (run == null || run.getTimestamp() == null || run.getTimestamp() < minStartMillis) {
      return false;
    }
    if (!isTerminal(run)) {
      return false;
    }
    ref.put("latest", run);
    return true;
  }
}
