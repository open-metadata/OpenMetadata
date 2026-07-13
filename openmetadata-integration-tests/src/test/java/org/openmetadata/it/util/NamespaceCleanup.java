package org.openmetadata.it.util;

import java.util.List;
import java.util.Map;
import org.openmetadata.it.util.TestNamespace.EntityRoot;
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
 */
public final class NamespaceCleanup {

  private static final Logger LOG = LoggerFactory.getLogger(NamespaceCleanup.class);

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
      final String path = "/v1/" + collection + "/" + root.id() + "?hardDelete=true&recursive=true";
      try {
        http.execute(HttpMethod.DELETE, path, null, Object.class);
        deleted++;
      } catch (final RuntimeException e) {
        LOG.warn(
            "Cleanup delete failed for {} {}: {}", root.entityType(), root.id(), e.getMessage());
      }
    }
    LOG.info("Namespace cleanup deleted {}/{} root entities", deleted, roots.size());
  }
}
