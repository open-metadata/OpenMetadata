package org.openmetadata.it.util;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.awaitility.pollinterval.IterativePollInterval;
import org.awaitility.pollinterval.PollInterval;
import org.openmetadata.it.util.TestNamespace.EntityRoot;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Recursively hard-deletes the root entities a test created (tracked via {@link
 * TestNamespace#trackRoot}). Deleting a root cascades its children (a databaseService takes its
 * databases/schemas/tables/columns with it), so only roots are tracked and deleted. Best-effort:
 * failures are logged, never thrown, so cleanup never fails a green test.
 *
 * <p>Deletes go through the <b>async</b> endpoint and then block until the root is really gone. The
 * synchronous path holds the request open for the whole cascade, which a 100k-table service runs
 * clean past the client's read timeout — that surfaced as {@code Cleanup delete failed: Network
 * error: timeout}, {@code deleted 0/1}, and an entire tree left behind for the next test in the JVM
 * to seed on top of. Waiting for the cascade is the point: these suites share one cluster, so a
 * cleanup that returns early does not save time, it just moves the cost onto the next test's seed.
 */
public final class NamespaceCleanup {

  private static final Logger LOG = LoggerFactory.getLogger(NamespaceCleanup.class);

  // How long to wait for a recursive hard delete to finish cascading. Sized for the scale suite's
  // 100k-table service, whose cascade ran ~6 minutes on an unloaded cluster; small tests fall
  // through on the first poll, so a generous cap costs them nothing. Override with
  // -Djpw.cleanup.cascadeTimeoutMin.
  private static final Duration CASCADE_TIMEOUT =
      Duration.ofMinutes(Integer.getInteger("jpw.cleanup.cascadeTimeoutMin", 15));

  // A normal test's cascade completes in tens of milliseconds, so poll fast at first and back off.
  // The interval must not be fixed: Awaitility derives the poll *delay* — the wait before the very
  // first check — from a FixedPollInterval unless one is set explicitly, so a flat 5s interval
  // billed every cleanup 5 idle seconds. That is 5265 cleanups x ~5s of pure sleep in one parallel
  // lane, which is what pushed the lane past its 65m budget. Backing off to MAX_CASCADE_POLL keeps
  // a 100k-table cascade from polling the cluster hundreds of times a minute for 15 minutes.
  private static final Duration INITIAL_CASCADE_POLL = Duration.ofMillis(100);
  // Package-private so NamespaceCleanupTest can pin the "not a fixed interval" invariant.
  static final Duration MAX_CASCADE_POLL = Duration.ofSeconds(5);
  static final PollInterval CASCADE_POLL =
      IterativePollInterval.iterative(NamespaceCleanup::nextCascadePoll, INITIAL_CASCADE_POLL);

  // OM entity type -> REST collection path. Only top-level (root) types need entries.
  private static final Map<String, String> COLLECTION_PATHS =
      Map.ofEntries(
          Map.entry(Entity.DATABASE_SERVICE, "services/databaseServices"),
          Map.entry(Entity.MESSAGING_SERVICE, "services/messagingServices"),
          Map.entry(Entity.DASHBOARD_SERVICE, "services/dashboardServices"),
          Map.entry(Entity.PIPELINE_SERVICE, "services/pipelineServices"),
          Map.entry(Entity.MLMODEL_SERVICE, "services/mlmodelServices"),
          Map.entry(Entity.STORAGE_SERVICE, "services/storageServices"),
          Map.entry(Entity.SEARCH_SERVICE, "services/searchServices"),
          Map.entry(Entity.API_SERVICE, "services/apiServices"),
          Map.entry(Entity.DRIVE_SERVICE, "services/driveServices"),
          Map.entry(Entity.GLOSSARY, "glossaries"),
          Map.entry(Entity.CLASSIFICATION, "classifications"),
          Map.entry(Entity.DOMAIN, "domains"),
          Map.entry(Entity.DATA_PRODUCT, "dataProducts"),
          Map.entry(Entity.TEAM, "teams"),
          Map.entry(Entity.USER, "users"),
          Map.entry(Entity.PERSONA, "personas"),
          Map.entry(Entity.TEST_SUITE, "dataQuality/testSuites"));

  private NamespaceCleanup() {}

  public static void deleteRoots(final List<EntityRoot> roots) {
    if (roots.isEmpty()) {
      return;
    }
    final HttpClient http = SdkClients.adminClient().getHttpClient();
    int deleted = 0;
    for (final EntityRoot root : roots) {
      final String collection = COLLECTION_PATHS.get(root.entityType());
      if (collection == null) {
        LOG.warn(
            "No cleanup collection mapping for entity type '{}' — skipping", root.entityType());
        continue;
      }
      final String path =
          "/v1/" + collection + "/async/" + root.id() + "?hardDelete=true&recursive=true";
      try {
        http.execute(HttpMethod.DELETE, path, null, Object.class);
        if (awaitGone(http, collection, root)) {
          deleted++;
        }
      } catch (final RuntimeException e) {
        LOG.warn(
            "Cleanup delete failed for {} {}: {}", root.entityType(), root.id(), e.getMessage());
      }
    }
    LOG.info("Namespace cleanup deleted {}/{} root entities", deleted, roots.size());
  }

  /**
   * Blocks until the root is actually gone. The next test in the JVM seeds into this same cluster,
   * so returning while a recursive hard delete is still cascading just hands the cost to that
   * test's seed phase — at 100k tables that showed up as a seed going from ~31 minutes to 95-314,
   * and then as ServiceDeleteSearchCleanupScaleIT missing its own 5-minute search-cleanup budget.
   *
   * <p>Best-effort, like the delete itself: a cascade still running at the cap is logged, not
   * thrown, so cleanup never fails an otherwise green test.
   */
  private static boolean awaitGone(
      final HttpClient http, final String collection, final EntityRoot root) {
    final String path = "/v1/" + collection + "/" + root.id();
    boolean gone = true;
    try {
      Awaitility.await("cleanup cascade for " + root.entityType() + " " + root.id())
          .atMost(CASCADE_TIMEOUT)
          .pollDelay(Duration.ZERO)
          .pollInterval(CASCADE_POLL)
          .until(() -> isGone(http, path));
    } catch (final ConditionTimeoutException stillRunning) {
      LOG.warn(
          "Cleanup cascade for {} {} still running after {} — the next test seeds on top of it",
          root.entityType(),
          root.id(),
          CASCADE_TIMEOUT);
      gone = false;
    }
    return gone;
  }

  /** Doubles the poll interval up to {@link #MAX_CASCADE_POLL} so a long cascade is not hammered. */
  private static Duration nextCascadePoll(final Duration previous) {
    final Duration doubled = previous.multipliedBy(2);
    return doubled.compareTo(MAX_CASCADE_POLL) > 0 ? MAX_CASCADE_POLL : doubled;
  }

  /**
   * A 404 is the only answer that proves the root is gone. A 5xx thrown mid-cascade, or a transient
   * auth blip, must read as "keep polling" — treating any failure as success would hand the next
   * test the very cluster state this wait exists to prevent.
   */
  private static boolean isGone(final HttpClient http, final String path) {
    boolean gone = false;
    try {
      http.execute(HttpMethod.GET, path, null, Object.class);
    } catch (final OpenMetadataException e) {
      gone = e.getStatusCode() == 404;
    }
    return gone;
  }
}
