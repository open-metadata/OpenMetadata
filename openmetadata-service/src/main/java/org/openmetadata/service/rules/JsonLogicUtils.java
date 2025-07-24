package org.openmetadata.service.rules;

import com.fasterxml.jackson.core.type.TypeReference;
import io.github.jamsesso.jsonlogic.ast.JsonLogicArray;
import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluationException;
import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluator;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

public class JsonLogicUtils {

  public static @NotNull Object evaluateExcludeFields(
      JsonLogicEvaluator evaluator, JsonLogicArray arguments, Object data) {
    if (arguments == null || arguments.size() != 1) return false;

    // Need to evaluate it to get the string value from var
    // Eg if the input is var: "owners.fullyQualifiedName", then we need to get the "owners"
    String parentField;
    try {
      Object evaluatedArg = evaluator.evaluate(arguments.getFirst(), data);
      if (!(evaluatedArg instanceof String evaluatedStr)) return false;
      parentField = evaluatedStr.split("\\.")[0]; // Eg: "owners" from "owners.fullyQualifiedName"
    } catch (JsonLogicEvaluationException e) {
      return false;
    }

    if (!(data instanceof Map<?, ?> entityMap)) return false;

    Object changeDescriptionObj = entityMap.get("changeDescription");
    if (changeDescriptionObj == null) return false;

    ChangeDescription changeDescription;
    try {
      changeDescription = JsonUtils.convertValue(changeDescriptionObj, new TypeReference<>() {});
    } catch (Exception e) {
      return false;
    }

    List<FieldChange> allChanges = new ArrayList<>();
    if (changeDescription.getFieldsAdded() != null) {
      allChanges.addAll(changeDescription.getFieldsAdded());
    }
    if (changeDescription.getFieldsDeleted() != null) {
      allChanges.addAll(changeDescription.getFieldsDeleted());
    }
    if (changeDescription.getFieldsUpdated() != null) {
      allChanges.addAll(changeDescription.getFieldsUpdated());
    }

    if (allChanges.isEmpty()) return false;

    return allChanges.stream().map(FieldChange::getName).anyMatch(name -> name.equals(parentField));
  }

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
}
