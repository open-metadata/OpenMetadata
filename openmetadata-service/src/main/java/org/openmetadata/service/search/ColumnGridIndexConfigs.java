package org.openmetadata.service.search;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.ChildFieldResolver;

/**
 * Registry-derived index configs shared by the Elasticsearch and OpenSearch column-grid
 * aggregators. Excluded types (with reasons) are listed in GRID_EXCLUDED_TYPES; requesting one is
 * an explicit error, never a silent drop.
 */
public final class ColumnGridIndexConfigs {

  public record IndexConfig(String indexName, String columnFieldPath, String columnNameKeyword) {}

  /**
   * Suffixes the aggregators strip from or append to a columnNameKeyword to reach the sibling
   * fields of the same container. Both engines carry the keyword through their query builders and
   * derive the container path and the tag field from it, so the two suffixes live here rather than
   * being repeated as literals in each engine.
   */
  public static final String NAME_KEYWORD_SUFFIX = ".name.keyword";

  public static final String TAG_FQN_SUFFIX = ".tags.tagFQN";

  /**
   * Types the column grid does not serve.
   *
   * <p>apiEndpoint: its children live under two container paths (requestSchema.schemaFields and
   * responseSchema.schemaFields) with two separate keyword subfields, and two paths cannot feed one
   * composite source. Extend this set with any type whose search mapping lacks a keyword subfield
   * for the child-name path.
   *
   * <p>Included with a caveat, deliberately NOT in this set: pipeline and mlmodel have the keyword
   * subfield but no lowercase_normalizer, so grid grouping is case sensitive for those two and case
   * insensitive for the other six. Two children named "Extract" and "extract" group as two rows on
   * a pipeline and one row on a table. That is a visible but benign grouping difference, not a
   * wrong result, and excluding the types entirely would be the bigger regression. Adding the
   * normalizer needs a reindex and is out of scope here.
   *
   * <p>Verified against openmetadata-spec/src/main/resources/elasticsearch/en on 2026-09-11.
   */
  public static final Set<String> GRID_EXCLUDED_TYPES = Set.of(Entity.API_ENDPOINT);

  private static final Map<String, IndexConfig> CONFIGS = build();

  private ColumnGridIndexConfigs() {}

  public static Map<String, IndexConfig> load() {
    return CONFIGS;
  }

  public static List<String> resolveEntityTypes(List<String> requested) {
    List<String> result;
    if (requested == null || requested.isEmpty()) {
      result = List.of(Entity.TABLE);
    } else {
      requested.forEach(ColumnGridIndexConfigs::validateGridType);
      result = List.copyOf(requested);
    }
    return result;
  }

  private static void validateGridType(String entityType) {
    if (!CONFIGS.containsKey(entityType)) {
      throw new IllegalArgumentException(
          "Entity type not supported by the column grid: %s. Supported: %s"
              .formatted(entityType, String.join(", ", new TreeSet<>(CONFIGS.keySet()))));
    }
  }

  private static Map<String, IndexConfig> build() {
    Map<String, IndexConfig> configs = new HashMap<>();
    for (String entityType : ChildFieldResolver.supportedEntityTypes()) {
      if (!GRID_EXCLUDED_TYPES.contains(entityType)) {
        String path = ChildFieldResolver.specFor(entityType).containerPaths().getFirst();
        configs.put(entityType, new IndexConfig(entityType, path, path + NAME_KEYWORD_SUFFIX));
      }
    }
    return Map.copyOf(configs);
  }
}
