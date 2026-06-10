package org.openmetadata.it.search;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

  private static final Logger LOG = LoggerFactory.getLogger(ReindexHelpers.class);
  private static final Set<String> TERMINAL_STATUSES =
      Set.of("success", "failed", "completed", "stopped", "activeError");
  private static final Set<String> SUCCESS_STATUSES = Set.of("success", "completed");
  private static final String REINDEX_TIMEOUT_MIN_PROP = "jpw.reindex.timeoutMin";
  private static final int DEFAULT_TIMEOUT_MINUTES = 60;
  private static final String PROPAGATION_TIMEOUT_MIN_PROP = "jpw.search.propagationTimeoutMin";
  private static final int DEFAULT_PROPAGATION_MINUTES = 5;
  private static final int BASELINE_RECREATE_ATTEMPTS = 3;
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  private ReindexHelpers() {}

  /**
   * Max wait for a reindex run to reach a terminal status — and for the singleton SearchIndexApp
   * lock to free so a fresh trigger is accepted. Reindex duration scales with catalog size and
   * cluster load: on a large shared/external cluster a single run can take ~20 minutes, and a
   * concurrent test's run holds the lock for that whole window. So this defaults high and is
   * overridable via {@code -Djpw.reindex.timeoutMin}. The waits poll run status and return the
   * instant it goes terminal, so a large cap never slows a fast run — it only bounds the failure.
   */
  public static Duration reindexTimeout() {
    return Duration.ofMinutes(
        Integer.getInteger(REINDEX_TIMEOUT_MIN_PROP, DEFAULT_TIMEOUT_MINUTES));
  }

  /**
   * Max wait for a single document/field change to become query-visible — live-indexing lag or the
   * tail of a reindex. On a clean cluster this is seconds, so the poll returns almost immediately
   * and the cap never slows a passing test; it only bounds the failure. On a shared/external cluster
   * under concurrent reindex load it can run minutes, so this defaults high and is overridable via
   * {@code -Djpw.search.propagationTimeoutMin}.
   */
  public static Duration searchPropagationTimeout() {
    return Duration.ofMinutes(
        Integer.getInteger(PROPAGATION_TIMEOUT_MIN_PROP, DEFAULT_PROPAGATION_MINUTES));
  }

  /** Triggers the named app via {@code POST /v1/apps/trigger/{name}}. */
  public static void triggerApp(final ServerHandle server, final String appName) {
    final HttpClient http = server.sdk().getHttpClient();
    http.execute(HttpMethod.POST, "/v1/apps/trigger/" + appName, null, Void.class);
  }

  /**
   * Triggers the named app with an inline config payload — overrides the app's persisted
   * configuration for this run only. Useful for slowing reindex (small batch + few
   * threads) so concurrent assertions have time to observe mid-flight state.
   */
  public static void triggerAppWithConfig(
      final ServerHandle server, final String appName, final Map<String, Object> config) {
    final HttpClient http = server.sdk().getHttpClient();
    http.execute(HttpMethod.POST, "/v1/apps/trigger/" + appName, config, Void.class);
  }

  /**
   * Waits for the previous run to reach a terminal status, then triggers a fresh run with
   * the given inline config — retrying the trigger until the server accepts it. OM's
   * internal app-execution lock can linger briefly after {@code AppRunRecord} flips to
   * {@code success}; a naive immediate trigger races with that release and gets
   * "Job is already running" errors.
   */
  public static void triggerSearchIndexWithConfigWhenIdle(
      final ServerHandle server,
      final Map<String, Object> config,
      final Duration acceptanceTimeout) {
    waitForLatestRunTerminal(server, SEARCH_INDEX_APP, reindexTimeout());
    Awaitility.await("trigger SearchIndexApp with config")
        .atMost(acceptanceTimeout)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              triggerAppWithConfig(server, SEARCH_INDEX_APP, config);
              return true;
            });
  }

  /** Status of the latest run for the named app, or {@code null} if no runs yet. */
  public static String latestRunStatus(final ServerHandle server, final String appName) {
    final AppRunRecord run = fetchLatestRun(server, appName);
    return (run == null || run.getStatus() == null) ? null : run.getStatus().value();
  }

  /** Whether the latest run for the named app is in a terminal status. */
  public static boolean latestRunIsTerminal(final ServerHandle server, final String appName) {
    return isTerminal(fetchLatestRun(server, appName));
  }

  /**
   * Whether the latest run started at or after {@code sinceMillis} AND is in a terminal
   * status. Lets callers distinguish "the run I just triggered finished" from "an older
   * run is still marked Success" — which {@link #latestRunIsTerminal} cannot.
   */
  public static boolean freshRunIsTerminal(
      final ServerHandle server, final String appName, final long sinceMillis) {
    final AppRunRecord run = fetchLatestRun(server, appName);
    if (run == null || run.getTimestamp() == null || run.getTimestamp() < sinceMillis) {
      return false;
    }
    return isTerminal(run);
  }

  /**
   * Blocks until a run started at or after {@code sinceMillis} appears for the app. Use
   * after a trigger to avoid racing the next probe loop against a stale {@code Success}
   * status from the previous run.
   */
  public static void waitForRunStartedSince(
      final ServerHandle server,
      final String appName,
      final long sinceMillis,
      final Duration timeout) {
    Awaitility.await("new run for " + appName + " to register")
        .atMost(timeout)
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              final AppRunRecord run = fetchLatestRun(server, appName);
              return run != null && run.getTimestamp() != null && run.getTimestamp() >= sinceMillis;
            });
  }

  /** Trigger SearchIndexingApplication and block until the latest run reaches a terminal state. */
  public static AppRunRecord triggerSearchIndexAndWait(final ServerHandle server) {
    return triggerSearchIndexAndWait(server, reindexTimeout());
  }

  public static AppRunRecord triggerSearchIndexAndWait(
      final ServerHandle server, final Duration timeout) {
    waitForLatestRunTerminal(server, SEARCH_INDEX_APP, reindexTimeout());
    final long triggeredAtMillis = System.currentTimeMillis();
    triggerWhenAccepted(server, reindexTimeout());
    final AppRunRecord run = waitForRunAfter(server, SEARCH_INDEX_APP, triggeredAtMillis, timeout);
    logIfNotSuccess(run);
    return run;
  }

  /**
   * Fires the plain trigger, retrying until the server accepts it. OM's app-execution lock can
   * linger briefly after the previous run flips to terminal (notably the {@code beforeEach}
   * recreate at class transitions in the serial search-it suite), so a one-shot trigger races
   * the release and gets a 500 "Job is already running". The first accepting call starts exactly
   * one run, so the retry never double-triggers.
   */
  private static void triggerWhenAccepted(
      final ServerHandle server, final Duration acceptanceTimeout) {
    Awaitility.await("trigger SearchIndexApp")
        .atMost(acceptanceTimeout)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              triggerApp(server, SEARCH_INDEX_APP);
              return true;
            });
  }

  /**
   * Rebuilds every index from scratch and blocks until the fresh run reaches a terminal status.
   * Unlike {@link #triggerSearchIndexAndWait}, this passes {@code recreateIndex=true} so dropped
   * indices are recreated and read aliases are re-promoted — the only reliable way to restore a
   * baseline after a test has dropped indices or left an alias unswapped (e.g. a stopped recreate
   * run). Used by {@code SearchClusterResetExtension}.
   */
  public static AppRunRecord recreateAllAndWait(final ServerHandle server, final Duration timeout) {
    AppRunRecord run = null;
    for (int attempt = 1; attempt <= BASELINE_RECREATE_ATTEMPTS && !isSuccess(run); attempt++) {
      final long triggeredAtMillis = System.currentTimeMillis();
      // Trigger via the idle-aware path: the SearchIndexApp single-run lock can linger briefly
      // after
      // a previous run flips to terminal, so a one-shot trigger races it and gets "Job is already
      // running" (notably at class transitions in the serial search-it suite). This waits for the
      // prior run to finish and retries the trigger until accepted, then blocks for the fresh run.
      triggerSearchIndexWithConfigWhenIdle(server, Map.of("recreateIndex", true), reindexTimeout());
      run = waitForRunAfter(server, SEARCH_INDEX_APP, triggeredAtMillis, timeout);
      if (!isSuccess(run)) {
        LOG.warn(
            "Baseline recreate attempt {}/{} ended in status '{}'{} — a prior test (e.g. a stopped"
                + " reindex or a 504 on a large cleanup) can leave indices half-dropped; retrying to"
                + " restore a clean baseline.",
            attempt,
            BASELINE_RECREATE_ATTEMPTS,
            statusOf(run),
            failureSummary(run));
      }
    }
    return run;
  }

  /** Triggers a per-entity reindex via {@code POST /v1/search/reindex?entityType=...}. */
  public static void reindexEntityType(final ServerHandle server, final String entityType) {
    server.sdk().search().reindex(entityType);
  }

  /**
   * Sends a stop request to the named app and blocks until the latest run reaches a
   * terminal status (typically {@code stopped}). Used by stop-under-load tests.
   */
  public static AppRunRecord stopAppAndWait(
      final ServerHandle server, final String appName, final Duration timeout) {
    server
        .sdk()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/apps/stop/" + appName, null, Void.class);
    // sinceMillis=0: we want the run we just stopped to reach terminal, not a fresh run.
    return waitForRunAfter(server, appName, 0L, timeout);
  }

  /** Records the wall-clock instant just before sending a stop request. */
  public static long sendStop(final ServerHandle server, final String appName) {
    final long ts = System.currentTimeMillis();
    server
        .sdk()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/apps/stop/" + appName, null, Void.class);
    return ts;
  }

  /** Triggers reindex of all entity types via {@code POST /v1/search/reindex/all}. */
  public static void reindexAll(final ServerHandle server) {
    server.sdk().search().reindexAll();
  }

  /** Latest {@link AppRunRecord} for the named app, or {@code null} if no runs yet. */
  public static AppRunRecord fetchLatestRun(final ServerHandle server, final String appName) {
    return server
        .sdk()
        .getHttpClient()
        .execute(
            HttpMethod.GET, "/v1/apps/name/" + appName + "/runs/latest", null, AppRunRecord.class);
  }

  private static boolean isSuccess(final AppRunRecord run) {
    return run != null && run.getStatus() != null && SUCCESS_STATUSES.contains(statusOf(run));
  }

  private static String statusOf(final AppRunRecord run) {
    return (run == null || run.getStatus() == null) ? "none" : run.getStatus().value();
  }

  private static void logIfNotSuccess(final AppRunRecord run) {
    if (!isSuccess(run)) {
      LOG.warn(
          "SearchIndexApp run did not succeed: status='{}'{}", statusOf(run), failureSummary(run));
    }
  }

  /** A short, log-safe rendering of the run's failure context, or empty when there is none. */
  private static String failureSummary(final AppRunRecord run) {
    final String summary;
    if (run == null || run.getFailureContext() == null) {
      summary = "";
    } else {
      summary = " failureContext=" + run.getFailureContext();
    }
    return summary;
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
