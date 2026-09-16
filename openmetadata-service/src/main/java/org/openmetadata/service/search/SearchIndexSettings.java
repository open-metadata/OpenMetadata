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
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Set;
import org.openmetadata.schema.utils.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Hardens an index's create-time mapping JSON so documents can never be rejected at index time,
 * without any per-document work — Elasticsearch/OpenSearch enforce the bounds natively. Applied once
 * per index creation, it:
 *
 * <ul>
 *   <li>adds {@code ignore_above} to keyword fields (and keyword multi-fields) so values longer than
 *       the byte-safe character threshold are stored but not indexed, instead of throwing an
 *       immense-term error;
 *   <li>adds {@code ignore_malformed} to numeric, date and boolean fields so a malformed value is
 *       skipped instead of rejecting the whole document (OpenSearch does not support
 *       {@code ignore_malformed} on {@code boolean}, so {@code OsUtils} strips it from boolean fields
 *       when transforming the mapping for OpenSearch);
 *   <li>injects the tunable {@code index.mapping.*.limit} guardrails (depth, nested objects, total
 *       fields) into the index settings.
 * </ul>
 *
 * Existing values in a mapping file are never overwritten.
 */
public final class SearchIndexSettings {

  private static final Logger LOG = LoggerFactory.getLogger(SearchIndexSettings.class);

  private static final String LIMIT = "limit";
  private static final String TYPE = "type";
  private static final String PROPERTIES = "properties";
  private static final String FIELDS = "fields";
  private static final String IGNORE_ABOVE = "ignore_above";
  private static final String IGNORE_MALFORMED = "ignore_malformed";
  private static final String DEPTH_LIMIT = "depth_limit";
  private static final String KEYWORD = "keyword";
  private static final String FLATTENED = "flattened";

  private static final Set<String> MALFORMED_GUARD_TYPES =
      Set.of(
          "long",
          "integer",
          "short",
          "byte",
          "double",
          "float",
          "half_float",
          "scaled_float",
          "date",
          "boolean");

  private SearchIndexSettings() {}

  public static String harden(String indexMappingContent, SearchFieldLimits limits) {
    String result = indexMappingContent;
    if (limits.isHardeningEnabled()
        && indexMappingContent != null
        && !indexMappingContent.isEmpty()) {
      result = hardenContent(indexMappingContent, limits);
    }
    return result;
  }

  private static String hardenContent(String content, SearchFieldLimits limits) {
    String result = content;
    try {
      ObjectNode root = (ObjectNode) JsonUtils.readTree(content);
      injectMappingLimits(root, limits);
      hardenFields(root, limits);
      result = JsonUtils.pojoToJson(root);
    } catch (Exception hardeningFailed) {
      LOG.warn("Could not harden index mapping; using original", hardeningFailed);
    }
    return result;
  }

  private static void hardenFields(ObjectNode root, SearchFieldLimits limits) {
    JsonNode mappings = root.get("mappings");
    if (mappings instanceof ObjectNode mappingsNode
        && mappingsNode.get(PROPERTIES) instanceof ObjectNode properties) {
      hardenProperties(properties, limits);
    }
  }

  private static void hardenProperties(ObjectNode properties, SearchFieldLimits limits) {
    properties
        .fields()
        .forEachRemaining(
            entry -> {
              if (entry.getValue() instanceof ObjectNode field) {
                hardenField(field, limits);
              }
            });
  }

  private static void hardenField(ObjectNode field, SearchFieldLimits limits) {
    String type = field.path(TYPE).asText("");
    applyKeywordGuard(field, type, limits);
    applyMalformedGuard(field, type);
    applyFlattenedGuard(field, type, limits);
    if (field.get(PROPERTIES) instanceof ObjectNode nestedProperties) {
      hardenProperties(nestedProperties, limits);
    }
    if (field.get(FIELDS) instanceof ObjectNode multiFields) {
      hardenProperties(multiFields, limits);
    }
  }

  private static void applyKeywordGuard(ObjectNode field, String type, SearchFieldLimits limits) {
    if (KEYWORD.equals(type) && !field.has(IGNORE_ABOVE)) {
      field.put(IGNORE_ABOVE, limits.getSafeCharThreshold());
    }
  }

  /**
   * Elasticsearch {@code flattened} indexes every leaf as a keyword, so a long leaf would throw an
   * immense-term error and a deep object would exceed the flattened depth limit. {@code ignore_above}
   * and {@code depth_limit} guard both. These are ES-only parameters; the OpenSearch transform strips
   * them when converting to {@code flat_object}.
   */
  private static void applyFlattenedGuard(ObjectNode field, String type, SearchFieldLimits limits) {
    if (FLATTENED.equals(type)) {
      if (!field.has(IGNORE_ABOVE)) {
        field.put(IGNORE_ABOVE, limits.getSafeCharThreshold());
      }
      if (!field.has(DEPTH_LIMIT)) {
        field.put(DEPTH_LIMIT, limits.getDepthLimit());
      }
    }
  }

  private static void applyMalformedGuard(ObjectNode field, String type) {
    if (MALFORMED_GUARD_TYPES.contains(type) && !field.has(IGNORE_MALFORMED)) {
      field.put(IGNORE_MALFORMED, true);
    }
  }

  private static void injectMappingLimits(ObjectNode root, SearchFieldLimits limits) {
    ObjectNode mapping = mappingNode(root);
    putLimitIfAbsent(mapping, "depth", limits.getDepthLimit());
    putLimitIfAbsent(mapping, "nested_objects", limits.getNestedObjectsLimit());
    putLimitIfAbsent(mapping, "total_fields", limits.getTotalFieldsLimit());
  }

  private static ObjectNode mappingNode(ObjectNode root) {
    ObjectNode settings = childObject(root, "settings");
    ObjectNode index = childObject(settings, "index");
    return childObject(index, "mapping");
  }

  private static ObjectNode childObject(ObjectNode parent, String name) {
    JsonNode existing = parent.get(name);
    ObjectNode result;
    if (existing != null && existing.isObject()) {
      result = (ObjectNode) existing;
    } else {
      result = JsonUtils.getObjectNode();
      parent.set(name, result);
    }
    return result;
  }

  private static void putLimitIfAbsent(ObjectNode mapping, String key, int value) {
    JsonNode existing = mapping.get(key);
    if (existing == null || !existing.has(LIMIT)) {
      ObjectNode limitNode = JsonUtils.getObjectNode();
      limitNode.put(LIMIT, value);
      mapping.set(key, limitNode);
    }
  }
}
