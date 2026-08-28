package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Counts entities in the application database via REST list endpoints with
 * {@code limit=0}. The {@code paging.total} field on a {@code ResultList}
 * response is the authoritative DB-side count for an entity type and is the
 * reference value for the reindex {@code db_count == es_count} invariant.
 *
 * <p>Mapping entity type → REST collection path is deliberately explicit so
 * that adding new types is an obvious code change. Aliases declared in
 * {@code indexMapping.json} that don't have a list endpoint (system/derived
 * types like {@code dataAsset}, {@code all}) are skipped by the caller.
 */
public final class DbCountQuerier {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  /**
   * Entity type → REST collection path. Covers user-creatable assets that the
   * default reindex run handles. Add entries when new entity types come under
   * test.
   */
  private static final Map<String, String> COLLECTION_PATHS =
      Map.ofEntries(
          Map.entry("table", "/v1/tables"),
          Map.entry("databaseSchema", "/v1/databaseSchemas"),
          Map.entry("database", "/v1/databases"),
          Map.entry("databaseService", "/v1/services/databaseServices"),
          Map.entry("topic", "/v1/topics"),
          Map.entry("messagingService", "/v1/services/messagingServices"),
          Map.entry("dashboard", "/v1/dashboards"),
          Map.entry("dashboardService", "/v1/services/dashboardServices"),
          Map.entry("pipeline", "/v1/pipelines"),
          Map.entry("pipelineService", "/v1/services/pipelineServices"),
          Map.entry("mlmodel", "/v1/mlmodels"),
          Map.entry("mlmodelService", "/v1/services/mlmodelServices"),
          Map.entry("container", "/v1/containers"),
          Map.entry("storageService", "/v1/services/storageServices"),
          Map.entry("searchIndex", "/v1/searchIndexes"),
          Map.entry("searchService", "/v1/services/searchServices"),
          Map.entry("apiCollection", "/v1/apiCollections"),
          Map.entry("apiEndpoint", "/v1/apiEndpoints"),
          Map.entry("apiService", "/v1/services/apiServices"),
          Map.entry("glossary", "/v1/glossaries"),
          Map.entry("glossaryTerm", "/v1/glossaryTerms"),
          Map.entry("tag", "/v1/tags"),
          Map.entry("classification", "/v1/classifications"),
          Map.entry("user", "/v1/users"),
          Map.entry("team", "/v1/teams"),
          Map.entry("domain", "/v1/domains"),
          Map.entry("dataProduct", "/v1/dataProducts"),
          Map.entry("query", "/v1/queries"),
          Map.entry("testCase", "/v1/dataQuality/testCases"),
          Map.entry("testSuite", "/v1/dataQuality/testSuites"));

  private final ServerHandle server;

  public DbCountQuerier(final ServerHandle server) {
    this.server = server;
  }

  /** Whether this querier knows how to count the given entity type. */
  public boolean canCount(final String entityType) {
    return COLLECTION_PATHS.containsKey(entityType);
  }

  /**
   * DB count for the entity type. Includes soft-deleted entities iff {@code
   * includeDeleted} is true.
   */
  public long count(final String entityType, final boolean includeDeleted) {
    final String path = COLLECTION_PATHS.get(entityType);
    if (path == null) {
      throw new IllegalArgumentException(
          "No collection path mapped for entity type: " + entityType);
    }
    final String url = path + "?limit=0" + (includeDeleted ? "&include=all" : "");
    // The list endpoints return a JSON object ({paging, data}); the SDK deserializes the response
    // into the requested type, so request a Map (String.class makes Jackson fail with
    // "Cannot deserialize String from Object").
    final Map<?, ?> response =
        server.sdk().getHttpClient().execute(HttpMethod.GET, url, null, Map.class);
    return parsePagingTotal(response);
  }

  /** Convenience: count of non-deleted entities. */
  public long count(final String entityType) {
    return count(entityType, false);
  }

  private long parsePagingTotal(final Map<?, ?> response) {
    try {
      final JsonNode node = MAPPER.valueToTree(response);
      return node.path("paging").path("total").asLong();
    } catch (final Exception e) {
      throw new IllegalStateException("Failed to parse paging.total from list response", e);
    }
  }
}
