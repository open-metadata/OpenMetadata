package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

/**
 * Read-only view over the live search engine for reindex assertions:
 * resolves declared aliases (merged OM + Collate), looks up the backing
 * index for each alias, fetches the live mapping JSON, and counts mapping
 * fields for field-explosion checks.
 *
 * <p>Backed by {@link IndexMappingLoader} for the canonical list of aliases
 * and by {@link SearchClient} for live engine state. Works against both
 * Elasticsearch and OpenSearch.
 */
public final class IndexAliasInspector {

  private final SearchClient client;

  public IndexAliasInspector(final ServerHandle server) {
    this.client = new SearchClient(server);
    ensureMappingLoaderInitialized();
  }

  /**
   * Entity types declared in the merged indexMapping.json. The Collate test
   * suite picks up Collate-only entries because Collate's indexMapping.json
   * is on the same classpath.
   */
  public Set<String> declaredEntityTypes() {
    return IndexMappingLoader.getInstance().getIndexMapping().keySet();
  }

  /**
   * Embedded backend ITs already init the loader via TestSuiteBootstrap. UIITs run in
   * a separate JVM from the OM service, so the test JVM's loader is uninitialized —
   * lazily initialize it here so callers don't have to care which boot mode they're in.
   */
  private static void ensureMappingLoaderInitialized() {
    try {
      IndexMappingLoader.getInstance();
    } catch (final IllegalStateException uninitialized) {
      try {
        IndexMappingLoader.init();
      } catch (final java.io.IOException ioe) {
        throw new IllegalStateException("Failed to lazily init IndexMappingLoader", ioe);
      }
    }
  }

  /**
   * Alias name for the given entity type, cluster-alias-aware. When the server runs with a cluster
   * alias (the test stacks use {@code "openmetadata"}), the live read alias is prefixed
   * ({@code "table" -> "openmetadata_table_search_index"}); without one it's the bare
   * {@code "table_search_index"}. Resolving via {@link SearchRepository#getClusterAlias()} (the same
   * value the server names indices with) keeps these assertions querying the alias that actually
   * exists in the engine instead of a name that 404s under a cluster alias.
   */
  public String aliasFor(final String entityType) {
    return mappingFor(entityType).getAlias(clusterAlias());
  }

  /**
   * The entity's own canonical index name, cluster-alias-aware ({@code table} ->
   * {@code openmetadata_table_search_index}). Unlike {@link #aliasFor}, this resolves to the 1:1
   * read alias the server attaches to each entity's single backing index — not the short grouping
   * alias ({@code openmetadata_table}) that also spans child/sibling indices (e.g. columns under
   * {@code table}, time-series under {@code testCase}). Use this whenever an assertion must target
   * exactly one entity type's index rather than an alias that fans out across several.
   */
  public String indexNameFor(final String entityType) {
    return mappingFor(entityType).getIndexName(clusterAlias());
  }

  private static IndexMapping mappingFor(final String entityType) {
    final IndexMapping mapping = IndexMappingLoader.getInstance().getIndexMapping().get(entityType);
    if (mapping == null) {
      throw new IllegalArgumentException(
          "No index mapping declared for entity type: " + entityType);
    }
    return mapping;
  }

  /** The server's configured cluster alias (empty string when none), or {@code null} if the
   * SearchRepository isn't initialized in this JVM (e.g. external/UIIT mode). */
  private static String clusterAlias() {
    final SearchRepository searchRepository = Entity.getSearchRepository();
    return searchRepository != null ? searchRepository.getClusterAlias() : null;
  }

  /**
   * Live 1:1 alias -> backing index map (alphabetical for stable diffs). Shared grouping aliases
   * that resolve to multiple indices (e.g. {@code testSuite} spans test_case / test_suite /
   * test_case_result) are skipped: they aren't a single entity type's primary read alias, so they
   * don't belong in a 1:1 alias→index snapshot used for swap assertions.
   */
  public Map<String, String> aliasToIndex() {
    final Map<String, String> result = new LinkedHashMap<>();
    for (final String entityType : declaredEntityTypes()) {
      final String alias = aliasFor(entityType);
      final List<String> indices = indicesForAlias(alias);
      if (indices.size() == 1) {
        result.put(alias, indices.get(0));
      }
    }
    return result;
  }

  /** List of backing indices for an alias (typically one; empty if the alias does not exist). */
  public List<String> indicesForAlias(final String alias) {
    final List<String> indices = new ArrayList<>();
    if (!client.exists("/_alias/" + alias)) {
      return indices;
    }
    final JsonNode body = client.get("/_alias/" + alias);
    final Iterator<Map.Entry<String, JsonNode>> fields = body.fields();
    while (fields.hasNext()) {
      indices.add(fields.next().getKey());
    }
    return indices;
  }

  /** Live mapping JSON for the alias (the {@code properties} node). */
  public JsonNode mapping(final String alias) {
    final JsonNode body = client.get("/" + alias + "/_mapping");
    final Iterator<Map.Entry<String, JsonNode>> fields = body.fields();
    if (!fields.hasNext()) {
      throw new IllegalStateException("No mapping returned for alias: " + alias);
    }
    return fields.next().getValue().path("mappings");
  }

  /**
   * Count of leaf fields in the alias mapping — flattens nested objects so a deeply nested
   * doc shape still produces a comparable single number. Used to detect mapping explosions.
   */
  public long fieldCount(final String alias) {
    return countLeaves(mapping(alias).path("properties"), 0);
  }

  private long countLeaves(final JsonNode properties, final int depth) {
    if (properties == null || properties.isMissingNode() || !properties.isObject()) {
      return 0;
    }
    long total = 0;
    final Iterator<Map.Entry<String, JsonNode>> entries = properties.fields();
    while (entries.hasNext()) {
      final Map.Entry<String, JsonNode> entry = entries.next();
      final JsonNode value = entry.getValue();
      final JsonNode nested = value.path("properties");
      if (nested.isObject()) {
        total += countLeaves(nested, depth + 1);
      } else {
        total++;
      }
    }
    return total;
  }
}
