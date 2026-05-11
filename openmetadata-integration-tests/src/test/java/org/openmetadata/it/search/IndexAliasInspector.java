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
  }

  /**
   * Entity types declared in the merged indexMapping.json. The Collate test
   * suite picks up Collate-only entries because Collate's indexMapping.json
   * is on the same classpath.
   */
  public Set<String> declaredEntityTypes() {
    return IndexMappingLoader.getInstance().getIndexMapping().keySet();
  }

  /** Alias name for the given entity type (e.g., {@code "table" -> "table_search_index"}). */
  public String aliasFor(final String entityType) {
    final IndexMapping mapping = IndexMappingLoader.getInstance().getIndexMapping().get(entityType);
    if (mapping == null) {
      throw new IllegalArgumentException("No index mapping declared for entity type: " + entityType);
    }
    return mapping.getAlias(null);
  }

  /** Live alias -> backing index map (alphabetical for stable diffs). */
  public Map<String, String> aliasToIndex() {
    final Map<String, String> result = new LinkedHashMap<>();
    for (final String entityType : declaredEntityTypes()) {
      final String alias = aliasFor(entityType);
      final List<String> indices = indicesForAlias(alias);
      if (indices.size() == 1) {
        result.put(alias, indices.get(0));
      } else if (indices.size() > 1) {
        throw new IllegalStateException(
            "Alias " + alias + " resolves to multiple indices: " + indices);
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
