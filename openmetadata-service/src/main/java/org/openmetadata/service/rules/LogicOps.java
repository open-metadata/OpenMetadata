package org.openmetadata.service.rules;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.TEAM;

import com.fasterxml.jackson.core.type.TypeReference;
import io.github.jamsesso.jsonlogic.JsonLogic;
import java.util.Arrays;
import java.util.List;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

public class LogicOps {

  public enum CustomLogicOps {
    LENGTH("length");

    public final String key;

    CustomLogicOps(String param) {
      this.key = param;
    }
  }

  public static void addCustomOps(JsonLogic jsonLogic) {
    // This method can be used to add custom operations that are exposed in the UI.
    // Currently, it adds the LENGTH operation.
    addCustomPublicOps(jsonLogic);
    addCustomPrivateOps(jsonLogic);
  }

  private static void addCustomPublicOps(JsonLogic jsonLogic) {
    jsonLogic.addOperation(
        CustomLogicOps.LENGTH.key,
        (args) -> {
          if (nullOrEmpty(args)) {
            return 0;
          }
          return args.length;
        });
  }

  /**
   * Here we'll add validations that are not going to be exposed in the UI
   * in the rule settings.
   * This is why we are not picking the names from the CustomLogicOps enum.
   */
  private static void addCustomPrivateOps(JsonLogic jsonLogic) {
    // This is expecting the `owners` to be passed to the rule argument
    jsonLogic.addOperation(
        "multipleUsersOrSingleTeamOwnership",
        (args) -> {
          if (nullOrEmpty(args) || Arrays.stream(args).allMatch(CommonUtil::nullOrEmpty)) {
            return true;
          }
          List<EntityReference> owners =
              JsonUtils.convertValue(args, new TypeReference<List<EntityReference>>() {});
          if (nullOrEmpty(owners)) {
            return true;
          }
          long teamCount = owners.stream().filter(owner -> owner.getType().equals(TEAM)).count();
          long userCount = owners.size() - teamCount;
          if (teamCount > 1 || (teamCount > 0 && userCount > 0)) {
            return false; // More than one team or both team and user ownership
          }
          return true;
        });

    // Example: {"filterReferenceByType":[{"var":"owner"},"team"]}
    jsonLogic.addOperation(
        "filterReferenceByType",
        (args) -> {
          if (nullOrEmpty(args)) {
            return false;
          }
          String type = (String) args[1];
          if (nullOrEmpty(args[0]) || CommonUtil.nullOrEmpty(type)) {
            return List.of();
          }

          List<EntityReference> refs =
              JsonUtils.convertValue(args[0], new TypeReference<List<EntityReference>>() {});
          return refs.stream().filter(ref -> ref.getType().equals(type)).toList();
        });

    // Example: {"filterTagsBySource":[{"var":"tags"},"Glossary"]}
    jsonLogic.addOperation(
        "filterTagsBySource",
        (args) -> {
          if (nullOrEmpty(args)) {
            return List.of();
          }
          String type = (String) args[1];

          if (nullOrEmpty(args[0]) || CommonUtil.nullOrEmpty(type)) {
            return List.of();
          }

          List<TagLabel> tags =
              JsonUtils.convertValue(args[0], new TypeReference<List<TagLabel>>() {});
          return tags.stream().filter(ref -> ref.getSource().toString().equals(type)).toList();
        });
  }

  /**
   * Returns a list of keys for custom logic operations.
   * This is exposed in /system/settings/customLogicOps for the UI.
   */
  public static List<String> getCustomOpsKeys() {
    return Arrays.stream(CustomLogicOps.values()).map(op -> op.key).toList();
  }
}
