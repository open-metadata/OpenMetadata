package org.openmetadata.service.rules;

import com.fasterxml.jackson.core.type.TypeReference;
import io.github.jamsesso.jsonlogic.JsonLogic;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

public class LogicOps {

  public enum CustomLogicOps {
    IS_REVIEWER("isReviewer"),
    EXCLUDE_FIELDS("excludeFields");

    public final String key;

    CustomLogicOps(String param) {
      this.key = param;
    }
  }

  public static void addCustomOps(JsonLogic jsonLogic) {
    // This method can be used to add custom operations that are exposed in the UI.
    // Currently, it adds the IS_REVIEWER, and EXCLUDE_FIELDS operations.
    addCustomPublicOps(jsonLogic);
  }

  private static void addCustomPublicOps(JsonLogic jsonLogic) {

    // isReviewer: expects reviewers and updatedBy as arguments
    // { "isReviewer": [ { "var": "reviewers" }, { "var": "updatedBy" } ] }
    jsonLogic.addOperation(
        CustomLogicOps.IS_REVIEWER.key,
        (Object[] args) -> {
          if (args == null || args.length < 2 || args[0] == null || args[1] == null) return false;
          List<EntityReference> reviewers =
              JsonUtils.convertValue(args[0], new TypeReference<List<EntityReference>>() {});
          String updatedBy = args[1].toString();
          for (EntityReference ref : reviewers) {
            if ("user".equals(ref.getType()) && updatedBy.equals(ref.getName())) {
              return true;
            }
          }
          // Team membership logic
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
            // log or ignore
          }
          return false;
        });

    // excludeFields: expects changeDescription and excludedFields as arguments
    // { "excludeFields": [ { "var": "changeDescription" }, ["field1", "field2"] ] }
    jsonLogic.addOperation(
        CustomLogicOps.EXCLUDE_FIELDS.key,
        (Object[] args) -> {
          if (args == null || args.length < 2 || args[0] == null || args[1] == null) return false;
          @SuppressWarnings("unchecked")
          Map<String, Object> changeDescription = (Map<String, Object>) args[0];
          @SuppressWarnings("unchecked")
          List<String> excludedFields = (List<String>) args[1];
          List<String> changedFields = new java.util.ArrayList<>();
          for (String key : List.of("fieldsAdded", "fieldsDeleted", "fieldsUpdated")) {
            List<FieldChange> fieldChanges =
                JsonUtils.convertValue(
                    changeDescription.get(key), new TypeReference<List<FieldChange>>() {});
            if (fieldChanges != null) {
              for (FieldChange fc : fieldChanges) {
                changedFields.add(fc.getName());
              }
            }
          }
          return !changedFields.isEmpty()
              && changedFields.stream().anyMatch(excludedFields::contains);
        });
  }
}
