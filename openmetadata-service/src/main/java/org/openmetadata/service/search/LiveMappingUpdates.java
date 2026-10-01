package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Adapts a mapping file for a mapping update on an index that already exists.
 *
 * <p>A live index cannot gain a new custom analyzer without being recreated, and a mapping update
 * that names one is rejected as a whole. So {@code search_analyzer} references to analyzers the
 * mapping file defines but the live index lacks are dropped from the update; the next reindex
 * creates the index with them. Every other property change still applies.
 */
@Slf4j
public final class LiveMappingUpdates {
  private static final String SEARCH_ANALYZER = "search_analyzer";

  private LiveMappingUpdates() {}

  /**
   * Returns the mapping content to send to an existing index whose settings response is {@code
   * liveSettings} (the body of {@code GET /<index>/_settings}). Content is returned unchanged when
   * the live settings are unknown or every referenced analyzer already exists.
   */
  public static String forLiveIndex(String mappingContent, JsonNode liveSettings) {
    if (mappingContent == null || liveSettings == null || !liveSettings.isObject()) {
      return mappingContent;
    }
    JsonNode root = JsonUtils.readTree(mappingContent);
    Set<String> missing = definedAnalyzers(root);
    missing.removeAll(liveAnalyzers(liveSettings));
    JsonNode mappings = root.path("mappings");
    if (missing.isEmpty() || !mappings.isObject() || !dropReferences(mappings, missing)) {
      return mappingContent;
    }
    LOG.info("Search analyzers {} apply at the next reindex of this index", missing);
    return JsonUtils.pojoToJson(root);
  }

  static Set<String> definedAnalyzers(JsonNode mappingRoot) {
    Set<String> names = new HashSet<>();
    mappingRoot
        .path("settings")
        .path("analysis")
        .path("analyzer")
        .fieldNames()
        .forEachRemaining(names::add);
    return names;
  }

  /** Analyzers present on every index in the response (an alias can resolve to several). */
  static Set<String> liveAnalyzers(JsonNode liveSettings) {
    Set<String> common = null;
    for (Iterator<Map.Entry<String, JsonNode>> it = liveSettings.fields(); it.hasNext(); ) {
      JsonNode analysis = it.next().getValue().path("settings").path("index").path("analysis");
      Set<String> names = new HashSet<>();
      analysis.path("analyzer").fieldNames().forEachRemaining(names::add);
      if (common == null) {
        common = names;
      } else {
        common.retainAll(names);
      }
    }
    return common == null ? new HashSet<>() : common;
  }

  private static boolean dropReferences(JsonNode node, Set<String> missing) {
    boolean dropped = false;
    if (node.isObject()) {
      ObjectNode object = (ObjectNode) node;
      if (missing.contains(object.path(SEARCH_ANALYZER).asText(null))) {
        object.remove(SEARCH_ANALYZER);
        dropped = true;
      }
      for (JsonNode child : object) {
        dropped |= dropReferences(child, missing);
      }
    } else if (node.isArray()) {
      for (JsonNode child : node) {
        dropped |= dropReferences(child, missing);
      }
    }
    return dropped;
  }
}
