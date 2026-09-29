/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMappingLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Decides whether a configured highlight field can actually produce a highlight, by reading the
 * index mappings instead of a hand-maintained list of bad paths.
 *
 * <p>Two mapped shapes can never be highlighted:
 *
 * <ul>
 *   <li>{@code flattened} (rewritten to {@code flat_object} for OpenSearch by {@code OsUtils}) — the
 *       field has no analyzer, and asking the highlighter for one fails the whole shard, which
 *       surfaces as a 500 on the search rather than a missing highlight;
 *   <li>{@code enabled: false} — the subtree is kept in {@code _source} but never indexed, so a
 *       highlight on it silently matches nothing.
 * </ul>
 *
 * <p>A field that is absent from the mapping is reported as supported: the highlighter skips unmapped
 * fields without erroring, so rejecting them would break configurations that are merely
 * forward-looking. Only fields that <em>are</em> mapped, in a shape that cannot highlight, are
 * unsupported.
 *
 * <p>Deriving this from the mappings is deliberate. The same knowledge previously lived as hardcoded
 * path lists that had to be restated on every mapping change — see the duplicated {@code
 * STALE_FLATTENED_CHILDREN_FIELDS} in the v1130 and v11210 migration utils — and drifted each time.
 */
public final class HighlightFieldClassifier {

  private static final Logger LOG = LoggerFactory.getLogger(HighlightFieldClassifier.class);

  private static final String TYPE = "type";
  private static final String ENABLED = "enabled";
  private static final char PATH_SEPARATOR = '.';

  /** {@code flat_object} is the OpenSearch spelling of {@code flattened}; neither has an analyzer. */
  private static final Set<String> NO_ANALYZER_TYPES = Set.of("flattened", "flat_object");

  private static volatile MappingIndex mappingIndex;

  public enum HighlightSupport {
    SUPPORTED,
    NOT_INDEXED,
    NOT_ANALYZABLE
  }

  /**
   * Unsupported paths keyed by entity type, plus the union across every index. The union backs the
   * query-time guard, which sees a field list without knowing which index it is about to query.
   */
  private record MappingIndex(
      Map<String, Map<String, HighlightSupport>> byEntity,
      Map<String, HighlightSupport> anyEntity) {}

  private HighlightFieldClassifier() {}

  /** Classifies {@code field} against the index mapping of {@code entityType}. */
  public static HighlightSupport classify(String entityType, String field) {
    Map<String, HighlightSupport> unsupported = mappingIndex().byEntity().get(entityType);
    return unsupported == null ? HighlightSupport.SUPPORTED : resolve(unsupported, field);
  }

  /**
   * True when {@code field} cannot be highlighted in any index that maps it. Used by the query-time
   * guard, where the index is not known and dropping a field that some other index could have
   * highlighted is preferable to failing the shard.
   */
  public static boolean isHighlightUnsafeField(String field) {
    return field != null
        && resolve(mappingIndex().anyEntity(), field) != HighlightSupport.SUPPORTED;
  }

  private static HighlightSupport resolve(Map<String, HighlightSupport> unsupported, String field) {
    HighlightSupport result = unsupported.get(field);
    if (result == null) {
      result = nearestUnsupportedAncestor(unsupported, field);
    }
    return result;
  }

  /** A subfield of an unsupported node inherits its parent's verdict — {@code extension.owner}. */
  private static HighlightSupport nearestUnsupportedAncestor(
      Map<String, HighlightSupport> unsupported, String field) {
    HighlightSupport result = HighlightSupport.SUPPORTED;
    int separator = field.lastIndexOf(PATH_SEPARATOR);
    while (separator > 0 && result == HighlightSupport.SUPPORTED) {
      String ancestor = field.substring(0, separator);
      result = unsupported.getOrDefault(ancestor, HighlightSupport.SUPPORTED);
      separator = ancestor.lastIndexOf(PATH_SEPARATOR);
    }
    return result;
  }

  private static MappingIndex mappingIndex() {
    MappingIndex result = mappingIndex;
    if (result == null) {
      result = buildMappingIndex();
      if (!result.byEntity().isEmpty()) {
        mappingIndex = result;
      }
    }
    return result;
  }

  private static MappingIndex buildMappingIndex() {
    Map<String, Map<String, HighlightSupport>> byEntity = new HashMap<>();
    Map<String, HighlightSupport> anyEntity = new HashMap<>();
    for (Map.Entry<String, Map<String, Object>> entry : entityIndexMappings().entrySet()) {
      Map<String, HighlightSupport> unsupported = collectUnsupported(entry.getValue());
      if (!unsupported.isEmpty()) {
        byEntity.put(entry.getKey(), Collections.unmodifiableMap(unsupported));
        anyEntity.putAll(unsupported);
      }
    }
    return new MappingIndex(
        Collections.unmodifiableMap(byEntity), Collections.unmodifiableMap(anyEntity));
  }

  private static Map<String, Map<String, Object>> entityIndexMappings() {
    Map<String, Map<String, Object>> result = Map.of();
    try {
      result = IndexMappingLoader.getInstance().getEntityIndexMapping();
    } catch (IllegalStateException e) {
      LOG.warn("Index mappings are not loaded; treating every highlight field as supported");
    }
    return result;
  }

  private static Map<String, HighlightSupport> collectUnsupported(Map<String, Object> mapping) {
    Map<String, HighlightSupport> collected = new HashMap<>();
    IndexMappingProperties.walk(
        IndexMappingProperties.topLevel(JsonUtils.valueToTree(mapping)),
        (path, field) -> {
          HighlightSupport support = classifyNode(field);
          if (support != HighlightSupport.SUPPORTED) {
            collected.put(path, support);
          }
          // Stop at an unsupported node: everything beneath it inherits the verdict, and its
          // children are not separately mapped anyway.
          return support == HighlightSupport.SUPPORTED;
        });
    return collected;
  }

  private static HighlightSupport classifyNode(JsonNode field) {
    HighlightSupport result = HighlightSupport.SUPPORTED;
    if (!field.path(ENABLED).asBoolean(true)) {
      result = HighlightSupport.NOT_INDEXED;
    } else if (NO_ANALYZER_TYPES.contains(field.path(TYPE).asText(""))) {
      result = HighlightSupport.NOT_ANALYZABLE;
    }
    return result;
  }
}
