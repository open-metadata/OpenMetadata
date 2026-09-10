package org.openmetadata.service.rules;

import io.github.jamsesso.jsonlogic.ast.JsonLogicArray;
import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluationException;
import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluator;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

public class JsonLogicUtils {

  public static @NotNull Object evaluateUserInRole(
      JsonLogicEvaluator evaluator, JsonLogicArray arguments, Object data, String role)
      throws JsonLogicEvaluationException {
    if (arguments.size() != 1) return false;

    Object resolvedArg = evaluator.evaluate(arguments.getFirst(), data);
    if (!(resolvedArg instanceof String updatedBy)) return false;

    if (!(data instanceof Map<?, ?> entityMap)) return false;

    Object reviewersObj = entityMap.get(role);
    if (reviewersObj == null) return false;

    List<EntityReference> reviewers =
        JsonUtils.convertValue(
            reviewersObj,
            new com.fasterxml.jackson.core.type.TypeReference<List<EntityReference>>() {});
    // Direct Reviewer
    for (EntityReference ref : reviewers) {
      if ("user".equals(ref.getType()) && updatedBy.equals(ref.getName())) {
        return true;
      }
    }
    // Team Membership
    try {
      User user = Entity.getEntityByName(Entity.USER, updatedBy, "teams", Include.ALL);
      List<EntityReference> userTeams = user.getTeams();
      if (userTeams != null) {
        for (EntityReference ref : reviewers) {
          if ("team".equals(ref.getType())) {
            String reviewerTeamId = ref.getId().toString();
            if (reviewerTeamId != null
                && userTeams.stream()
                    .anyMatch(team -> reviewerTeamId.equals(team.getId().toString()))) {
              return true;
            }
          }
        }
      }
    } catch (Exception e) {
      // log error if needed
    }

    return false;
  }

  public static @NotNull Object evaluateIsUpdatedBefore(
      JsonLogicEvaluator evaluator, JsonLogicArray arguments, Object data)
      throws JsonLogicEvaluationException {
    if (arguments.size() != 1) return false;

    Object timestampObj = evaluator.evaluate(arguments.getFirst(), data);
    if (timestampObj == null) return false;

    // Get updatedAt from entity data
    if (!(data instanceof Map<?, ?> entityMap)) return false;
    Object updatedAtObj = entityMap.get("updatedAt");
    if (updatedAtObj == null) return false;

    long updatedAt;
    if (updatedAtObj instanceof Long) {
      updatedAt = (Long) updatedAtObj;
    } else if (updatedAtObj instanceof Number) {
      updatedAt = ((Number) updatedAtObj).longValue();
    } else {
      return false;
    }

    long timestamp = ((Number) timestampObj).longValue();
    return updatedAt < timestamp;
  }

  public static @NotNull Object evaluateIsUpdatedAfter(
      JsonLogicEvaluator evaluator, JsonLogicArray arguments, Object data)
      throws JsonLogicEvaluationException {
    if (arguments.size() != 1) return false;

    Object timestampObj = evaluator.evaluate(arguments.getFirst(), data);
    if (timestampObj == null) return false;

    // Get updatedAt from entity data
    if (!(data instanceof Map<?, ?> entityMap)) return false;
    Object updatedAtObj = entityMap.get("updatedAt");
    if (updatedAtObj == null) return false;

    long updatedAt;
    if (updatedAtObj instanceof Long) {
      updatedAt = (Long) updatedAtObj;
    } else if (updatedAtObj instanceof Number) {
      updatedAt = ((Number) updatedAtObj).longValue();
    } else {
      return false;
    }

    long timestamp = ((Number) timestampObj).longValue();
    return updatedAt > timestamp;
  }

  /**
   * Resolves a dot-separated path against {@code data} and returns every value found at that path.
   *
   * <p>The one argument must resolve to a String path such as {@code extension.dpTest.rows.name}.
   * At each segment: a map key is dereferenced normally, a list segment with a numeric next key is
   * indexed, and a list segment followed by a non-numeric key plucks that key from every element
   * and continues (with nested lists flattened one level per traversal step). The return type is
   * always a list, which pairs cleanly with the built-in {@code contains} operator:
   *
   * <pre>{"contains": ["john", {"tableColumnValues": "extension.dpTest.rows.name"}]}</pre>
   *
   * <p>Registered as a private op so the query-builder UI cannot expose it as a generic operator;
   * it is only emitted by the hardcoded {@code table_field_*} operators for table-type custom
   * property columns.
   */
  public static @NotNull Object evaluateTableColumnValues(
      JsonLogicEvaluator evaluator, JsonLogicArray arguments, Object data)
      throws JsonLogicEvaluationException {
    if (arguments.size() != 1) return Collections.emptyList();

    Object rawPath = evaluator.evaluate(arguments.getFirst(), data);
    if (!(rawPath instanceof String path) || path.isEmpty()) {
      return Collections.emptyList();
    }

    List<Object> cursor = new ArrayList<>();
    cursor.add(data);
    for (String segment : path.split("\\.")) {
      cursor = plucksAcrossLists(cursor, segment);
      if (cursor.isEmpty()) {
        return Collections.emptyList();
      }
    }
    return cursor;
  }

  private static List<Object> plucksAcrossLists(List<Object> cursors, String segment) {
    boolean numeric = isNumeric(segment);
    int index = numeric ? Integer.parseInt(segment) : -1;
    List<Object> next = new ArrayList<>();
    for (Object cursor : cursors) {
      if (cursor instanceof Map<?, ?> map) {
        Object value = map.get(segment);
        if (value != null) {
          next.add(value);
        }
      } else if (cursor instanceof List<?> list) {
        if (numeric) {
          if (index >= 0 && index < list.size()) {
            next.add(list.get(index));
          }
        } else {
          for (Object element : list) {
            if (element instanceof Map<?, ?> elementMap) {
              Object value = elementMap.get(segment);
              if (value != null) {
                next.add(value);
              }
            }
          }
        }
      }
    }
    return next;
  }

  private static boolean isNumeric(String s) {
    if (s == null || s.isEmpty()) return false;
    for (int i = 0; i < s.length(); i++) {
      if (!Character.isDigit(s.charAt(i))) return false;
    }
    return true;
  }
}
