package org.openmetadata.it.util;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
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
  // 100k-table service, whose cascade ran ~6 minutes on an unloaded cluster. Override with
  // -Djpw.cleanup.cascadeTimeoutMin.
  private static final Duration CASCADE_TIMEOUT =
      Duration.ofMinutes(Integer.getInteger("jpw.cleanup.cascadeTimeoutMin", 15));
  // Awaitility defaults its poll delay to the poll interval, so a 5s interval meant every root -
  // including the overwhelming majority whose cascade is already finished - blocked 5s before its
  // first check. Across a lane's namespaces that dominated the integration budget. The delay is
  // pinned to zero below; this interval only paces genuinely in-flight cascades, and each poll is
  // a single cheap 404 probe.
  private static final Duration CASCADE_POLL = Duration.ofMillis(500);

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
