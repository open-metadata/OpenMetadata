package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rules.RuleEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The JsonLogic filter of an event-based trigger. The filter is an exclusion: entities it matches
 * do not start the workflow. Shared by the trigger itself and by anything that needs to know
 * whether a workflow applies to an entity, so both read the filter the same way.
 */
public final class TriggerEntityFilter {
  private static final Logger LOG = LoggerFactory.getLogger(TriggerEntityFilter.class);
  private static final TypeReference<Map<String, String>> FILTER_MAP_TYPE =
      new TypeReference<>() {};
  private static final String DEFAULT_FILTER_KEY = "default";

  private TriggerEntityFilter() {}

  /**
   * The JsonLogic filter that applies to an entity type, or null when there is none. The trigger
   * config's filter is a oneOf of a string (legacy top-level JsonLogic, or a JSON object string)
   * and an object mapping entity types, or "default", to JsonLogic.
   */
  public static String forEntityType(Object filterConfig, String entityType) {
    String filter = null;
    if (filterConfig != null && entityType != null) {
      if (filterConfig instanceof String filterString) {
        filter = fromFilterString(filterString, entityType);
      } else if (filterConfig instanceof Map) {
        filter = fromFilterMap(JsonUtils.convertValue(filterConfig, FILTER_MAP_TYPE), entityType);
      } else {
        LOG.error("Unexpected filter object type: {}", filterConfig.getClass().getName());
      }
    }
    return filter;
  }

  // If the JsonLogic evaluates to TRUE, the entity is excluded from triggering the workflow.
  // Non-match (FALSE) or unparseable filter (RuleEngine returns false on any exception) means the
  // entity is NOT excluded, so the workflow triggers.
  public static boolean excludes(String filterLogic, EntityInterface<?> entity) {
    boolean matches = false;
    if (filterLogic != null && !filterLogic.trim().isEmpty()) {
      matches =
          Boolean.TRUE.equals(
              RuleEngine.getInstance().apply(filterLogic, JsonUtils.getMap(entity)));
    }
    return matches;
  }

  private static String fromFilterString(String filterString, String entityType) {
    String trimmed = filterString.trim();
    String filter = null;
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        filter = fromFilterMap(JsonUtils.readValue(filterString, FILTER_MAP_TYPE), entityType);
      } catch (Exception e) {
        LOG.error(
            "Invalid filter format. Expected JSON object with entity-specific filters: {}",
            filterString);
      }
    } else if (!trimmed.isEmpty()) {
      LOG.warn("Plain string filters are no longer supported. Use entity-specific filter object.");
    }
    return filter;
  }

  private static String fromFilterMap(Map<String, String> filterMap, String entityType) {
    String filter = null;
    if (filterMap != null) {
      filter = sanitize(filterMap.get(entityType));
      if (filter == null) {
        filter = sanitize(filterMap.get(DEFAULT_FILTER_KEY));
      }
    }
    return filter;
  }

  // A saved-but-empty filter from the UI can serialize as a JSON-encoded empty string (\"\") or
  // empty object ({}) instead of being dropped. Treat those as "no filter" so RuleEngine never
  // sees garbage that it can't parse.
  private static String sanitize(String filter) {
    String sanitized = null;
    if (filter != null) {
      String trimmed = filter.trim();
      if (!trimmed.isEmpty() && !"\"\"".equals(trimmed) && !"{}".equals(trimmed)) {
        sanitized = filter;
      }
    }
    return sanitized;
  }
}
