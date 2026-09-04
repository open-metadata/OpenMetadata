/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.triggers;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.WorkflowTriggerFields;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rules.RuleEngine;

/**
 * Shared field- and entity-filter semantics for {@code eventBasedEntity} triggers. Both the trigger
 * ({@code FilterEntityImpl}, which decides whether a workflow fires) and the approval gate ({@code
 * ApprovalGate}, which decides whether a field edit is held for that same workflow) must agree on
 * which fields and which entities a trigger's {@code include}/{@code exclude}/{@code filter} config
 * selects - otherwise the gate could hold a change the workflow never fires on (orphaned hold) or the
 * workflow could fire with nothing held. Keeping the logic here makes that divergence impossible.
 */
@Slf4j
public final class WorkflowTriggerFilters {
  private static final TypeReference<Map<String, String>> FILTER_MAP_TYPE =
      new TypeReference<>() {};

  private WorkflowTriggerFilters() {}

  /** A change to {@code fieldName} triggers when it is a trigger field and passes include/exclude. */
  public static boolean fieldTriggers(
      String fieldName, List<String> includeFields, List<String> excludedFields) {
    boolean triggers = false;
    if (isTriggerField(fieldName)) {
      if (includeFields != null && !includeFields.isEmpty()) {
        triggers = includeFields.stream().anyMatch(field -> matchesField(fieldName, field));
      } else {
        triggers =
            excludedFields == null
                || excludedFields.stream().noneMatch(field -> matchesField(fieldName, field));
      }
    }
    return triggers;
  }

  public static boolean isTriggerField(String fieldName) {
    return Arrays.stream(WorkflowTriggerFields.values())
        .map(WorkflowTriggerFields::value)
        .anyMatch(triggerField -> matchesField(fieldName, triggerField));
  }

  public static boolean matchesField(String fieldName, String triggerField) {
    return fieldName.equals(triggerField) || fieldName.startsWith(triggerField + Entity.SEPARATOR);
  }

  /**
   * The trigger {@code filter} is an EXCLUSION: if the entity-specific JsonLogic evaluates to TRUE
   * the entity is excluded (workflow does not fire / change is not held). A non-match or unparseable
   * filter is not excluded.
   */
  public static boolean matchesExclusionFilter(String filterLogic, EntityInterface entity) {
    return matchesExclusionFilter(filterLogic, JsonUtils.getMap(entity));
  }

  /**
   * Overload evaluating the exclusion filter against a pre-built entity map. The gate feeds the
   * proposed entity (the edit applied), so the trigger's filter and the gate's filter judge the same
   * state even when the edit is held off the persisted entity.
   */
  public static boolean matchesExclusionFilter(String filterLogic, Map<String, Object> entityMap) {
    boolean matches = false;
    if (filterLogic != null && !filterLogic.trim().isEmpty()) {
      matches = Boolean.TRUE.equals(RuleEngine.getInstance().apply(filterLogic, entityMap));
    }
    return matches;
  }

  /**
   * Resolves the JsonLogic for {@code entityType} from the trigger's {@code filter}. The filter is a
   * oneOf of a per-entityType object (map of entityType -&gt; JsonLogic string, with a {@code default}
   * fallback) or - when serialized - a JSON-object string of the same shape. Plain (non-object)
   * string filters are not supported and resolve to no filter.
   */
  public static String extractEntitySpecificFilter(Object filterObj, String entityType) {
    String filterLogic = null;
    if (filterObj instanceof String filterStr) {
      filterLogic = extractFromFilterString(filterStr, entityType);
    } else if (filterObj instanceof Map) {
      Map<String, String> filterMap = JsonUtils.convertValue(filterObj, FILTER_MAP_TYPE);
      filterLogic = extractFromFilterMap(filterMap, entityType);
    } else if (filterObj != null) {
      LOG.error("Unexpected filter object type: {}", filterObj.getClass().getName());
    }
    return filterLogic;
  }

  private static String extractFromFilterString(String filterStr, String entityType) {
    String filterLogic = null;
    String trimmed = filterStr.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        Map<String, String> filterMap = JsonUtils.readValue(filterStr, FILTER_MAP_TYPE);
        filterLogic = extractFromFilterMap(filterMap, entityType);
      } catch (Exception e) {
        LOG.error("Invalid filter format; expected a per-entity JSON object: {}", filterStr);
      }
    } else if (!trimmed.isEmpty()) {
      LOG.warn("Plain string filters are not supported. Use an entity-specific filter object.");
    }
    return filterLogic;
  }

  private static String extractFromFilterMap(Map<String, String> filterMap, String entityType) {
    String filterLogic = null;
    if (filterMap != null && entityType != null) {
      String specific = sanitizeFilterValue(filterMap.get(entityType));
      filterLogic = specific != null ? specific : sanitizeFilterValue(filterMap.get("default"));
    }
    return filterLogic;
  }

  /**
   * A saved-but-empty filter from the UI can serialize as a JSON-encoded empty string ({@code ""}) or
   * empty object ({@code {}}) instead of being dropped. Treat those as "no filter".
   */
  public static String sanitizeFilterValue(String filter) {
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
