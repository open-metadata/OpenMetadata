package org.openmetadata.service.rules;

import io.github.jamsesso.jsonlogic.ast.JsonLogicArray;
import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluationException;
import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluator;
import java.util.ArrayList;
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

  public static @NotNull Object evaluateFieldCompleteness(
      JsonLogicEvaluator evaluator, JsonLogicArray arguments, Object data)
      throws JsonLogicEvaluationException {
    if (arguments.isEmpty()) return 0.0;

    // Get the list of field names to check
    List<String> fields = new ArrayList<>();
    for (int i = 0; i < arguments.size(); i++) {
      Object arg = evaluator.evaluate(arguments.get(i), data);
      if (arg instanceof String) {
        fields.add((String) arg);
      }
    }

    if (fields.isEmpty()) return 0.0;

    // Check if data is a Map (entity)
    if (!(data instanceof Map<?, ?> entityMap)) return 0.0;

    // Count non-empty fields
    long filledCount = 0;
    for (String field : fields) {
      Object value = entityMap.get(field);
      if (value != null) {
        // Check if the value is non-empty based on its type
        if (value instanceof String && !((String) value).trim().isEmpty()) {
          filledCount++;
        } else if (value instanceof List && !((List<?>) value).isEmpty()) {
          filledCount++;
        } else if (value instanceof Map && !((Map<?, ?>) value).isEmpty()) {
          filledCount++;
        } else if (!(value instanceof String || value instanceof List || value instanceof Map)) {
          // For other types (numbers, booleans), non-null means filled
          filledCount++;
        }
      }
    }

    // Return percentage as a number (0-100)
    return (filledCount * 100.0) / fields.size();
  }
}
