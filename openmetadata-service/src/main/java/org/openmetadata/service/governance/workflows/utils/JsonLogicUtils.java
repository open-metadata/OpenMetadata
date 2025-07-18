package org.openmetadata.service.governance.workflows.utils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import io.github.jamsesso.jsonlogic.JsonLogic;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class JsonLogicUtils {

  public static boolean evaluateFilter(String entityLinkStr, String updatedBy, String filterLogic) {
    try {
      LOG.debug("Evaluating JSON Logic filter: {}", filterLogic);

      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      JsonLogic jsonLogic = createJsonLogicWithCustomOperators(entity);

      // Extract variables from the JsonLogic - There can be custom operators
      Set<String> requiredVars = extractVariablesFromJsonLogic(filterLogic);
      LOG.debug("Filter requires variables: {}", requiredVars);

      Map<String, Object> jsonLogicContext =
          buildCustomJsonLogicContext(requiredVars, entity, updatedBy);

      String filterRule = unescapeFilter(filterLogic);
      Object result;
      try {
        result = jsonLogic.apply(filterRule, jsonLogicContext);
      } catch (Exception e) {
        LOG.error("Error applying JsonLogic: {}", e.getMessage(), e);
        return false;
      }

      boolean boolResult = convertToBoolean(result);
      LOG.info(
          "JsonLogic='{}', Context={}, Result='{}'->{}",
          filterLogic,
          jsonLogicContext,
          result,
          boolResult);
      return boolResult;

    } catch (Exception e) {
      LOG.error("Error evaluating JSON Logic filter: {}", e.getMessage(), e);
      return false;
    }
  }

  // Done when the filter is double-escaped
  private static String unescapeFilter(String filterLogic) throws JsonProcessingException {
    Object ruleObj = JsonUtils.getObjectMapper().readValue(filterLogic, Object.class);
    if (ruleObj instanceof String) {
      ruleObj = JsonUtils.getObjectMapper().readValue((String) ruleObj, Object.class);
    }
    return JsonUtils.getObjectMapper().writeValueAsString(ruleObj);
  }

  /**
   * Create JsonLogic instance with custom operators
   */
  private static JsonLogic createJsonLogicWithCustomOperators(EntityInterface entity) {
    JsonLogic jsonLogic = new JsonLogic();
    // Add excludeFields custom operator
    jsonLogic.addOperation(
        "excludeFields",
        args -> {
          if (args.length == 0) {
            return false;
          }

          List<String> excludedFields = extractStringList(args[0]);
          return evaluateExcludeLogic(entity, excludedFields);
        });

    return jsonLogic;
  }

  /**
   * Core exclude fields logic
   * Returns true if ONLY excluded fields were changed (should skip workflow)
   * Returns false if any non-excluded fields were changed (should trigger workflow)
   */
  private static boolean evaluateExcludeLogic(EntityInterface entity, List<String> excludedFields) {
    Optional<ChangeDescription> oChangeDescription =
        Optional.ofNullable(entity.getChangeDescription());

    // CREATE events: excludeFields does not apply (return false = trigger)
    if (oChangeDescription.isEmpty()) {
      LOG.debug("CREATE event - excludeFields logic returns false (should trigger)");
      return false;
    }

    // Get changed fields
    ChangeDescription changeDescription = oChangeDescription.get();
    List<String> changedFields = new ArrayList<>();

    for (FieldChange fc : changeDescription.getFieldsAdded()) {
      changedFields.add(fc.getName());
    }
    for (FieldChange fc : changeDescription.getFieldsDeleted()) {
      changedFields.add(fc.getName());
    }
    for (FieldChange fc : changeDescription.getFieldsUpdated()) {
      changedFields.add(fc.getName());
    }

    // If no fields changed, don't skip (return false = trigger)
    if (changedFields.isEmpty()) {
      LOG.debug("No fields changed - excludeFields logic returns false (should trigger)");
      return false;
    }

    if (excludedFields == null || excludedFields.isEmpty()) {
      LOG.debug("No exclude fields specified - excludeFields logic returns false (should trigger)");
      return false;
    }

    // Check if ALL changed fields are in excluded list
    boolean onlyExcludedFieldsChanged = new HashSet<>(excludedFields).containsAll(changedFields);

    LOG.info(
        "EXCLUDEFIELDS DEBUG: excluded={}, changed={}, onlyExcludedFieldsChanged={}",
        excludedFields,
        changedFields,
        onlyExcludedFieldsChanged);
    return onlyExcludedFieldsChanged;
  }

  /**
   * Extract variables from JSON Logic expression
   */
  private static Set<String> extractVariablesFromJsonLogic(String filterLogic) {
    Set<String> variables = new HashSet<>();
    try {
      JsonNode jsonNode = JsonUtils.getObjectMapper().readTree(filterLogic);
      // If the node is a string, it means the input was double-escaped, so parse again
      if (jsonNode.isTextual()) {
        jsonNode = JsonUtils.getObjectMapper().readTree(jsonNode.asText());
      }
      extractVariablesRecursive(jsonNode, variables);
    } catch (Exception e) {
      LOG.debug("Could not parse JSON Logic to extract variables: {}", e.getMessage());
    }
    return variables;
  }

  /**
   * Recursively find all {"var": "variableName"} references, Finds Nested variables if any sent
   */
  private static void extractVariablesRecursive(JsonNode node, Set<String> variables) {
    if (node.isObject()) {
      if (node.has("var")) {
        JsonNode varNode = node.get("var");
        if (varNode.isTextual()) {
          variables.add(varNode.asText());
        }
      }
      node.fields()
          .forEachRemaining(entry -> extractVariablesRecursive(entry.getValue(), variables));
    } else if (node.isArray()) {
      node.forEach(element -> extractVariablesRecursive(element, variables));
    }
  }

  /**
   * Build context only for required variables
   */
  private static Map<String, Object> buildCustomJsonLogicContext(
      Set<String> requiredVars, EntityInterface entity, String updatedBy) {

    // Add all entity fields as top-level keys
    Map<String, Object> rules = new HashMap<>(JsonUtils.getMap(entity));

    // Variables needed for JsonLogic Evaluator, if in case we send entity.field
    if (requiredVars.contains("entity")) {
      rules.put("entity", JsonUtils.getMap(entity));
    }
    if (requiredVars.contains("updatedBy")) {
      rules.put("updatedBy", updatedBy);
    }

    // Business logic variables - Custom Operators
    if (requiredVars.contains("isReviewer") && updatedBy != null) {
      boolean isReviewer = checkIfUserIsReviewer(entity, updatedBy);
      rules.put("isReviewer", isReviewer);
      LOG.debug("Built isReviewer rule: {}", isReviewer);
    }

    if (requiredVars.contains("isOwner") && updatedBy != null) {
      boolean isOwner = checkIfUserIsOwner(entity, updatedBy);
      rules.put("isOwner", isOwner);
      LOG.debug("Built isOwner rule: {}", isOwner);
    }

    // Add change-related variables if needed
    if (requiredVars.contains("changedFields") || requiredVars.contains("isCreateEvent")) {
      addChangeInfo(rules, entity);
    }

    LOG.debug("Built rules for variables: {} -> {}", requiredVars, rules.keySet());
    return rules;
  }

  /**
   * Add change information
   */
  private static void addChangeInfo(Map<String, Object> context, EntityInterface entity) {
    Optional<ChangeDescription> oChangeDescription =
        Optional.ofNullable(entity.getChangeDescription());

    if (oChangeDescription.isPresent()) {
      // UPDATE event
      ChangeDescription changeDescription = oChangeDescription.get();
      List<String> changedFields = new ArrayList<>();

      for (FieldChange fc : changeDescription.getFieldsAdded()) {
        changedFields.add(fc.getName());
      }
      for (FieldChange fc : changeDescription.getFieldsDeleted()) {
        changedFields.add(fc.getName());
      }
      for (FieldChange fc : changeDescription.getFieldsUpdated()) {
        changedFields.add(fc.getName());
      }

      context.put("changedFields", changedFields);
      context.put("isCreateEvent", false);
    } else {
      context.put("changedFields", new ArrayList<>());
      context.put("isCreateEvent", true);
    }
  }

  private static boolean checkIfUserIsReviewer(EntityInterface entity, String updatedBy) {
    List<EntityReference> reviewers = entity.getReviewers();
    if (reviewers == null || reviewers.isEmpty()) {
      return false;
    }
    // Check direct reviewer
    boolean isDirectReviewer =
        reviewers.stream()
            .filter(ref -> Entity.USER.equals(ref.getType()))
            .anyMatch(ref -> updatedBy.equals(ref.getName()));
    if (isDirectReviewer) {
      return true;
    }

    // Check team membership
    try {
      User user = Entity.getEntityByName(Entity.USER, updatedBy, "teams", Include.ALL);
      List<EntityReference> userTeams = user.getTeams();

      if (userTeams != null) {
        return reviewers.stream()
            .filter(ref -> Entity.TEAM.equals(ref.getType()))
            .anyMatch(
                teamRef ->
                    userTeams.stream()
                        .anyMatch(userTeam -> userTeam.getId().equals(teamRef.getId())));
      }
    } catch (Exception e) {
      LOG.debug("Could not fetch user teams for {}: {}", updatedBy, e.getMessage());
    }

    return false;
  }

  private static boolean checkIfUserIsOwner(EntityInterface entity, String updatedBy) {
    List<EntityReference> owners = entity.getOwners();
    if (owners == null || owners.isEmpty()) {
      return false;
    }

    // Check direct ownership
    boolean isDirectOwner =
        owners.stream()
            .filter(ref -> Entity.USER.equals(ref.getType()))
            .anyMatch(ref -> updatedBy.equals(ref.getName()));

    if (isDirectOwner) {
      return true;
    }

    // Check team ownership
    try {
      User user = Entity.getEntityByName(Entity.USER, updatedBy, "teams", Include.ALL);
      List<EntityReference> userTeams = user.getTeams();

      if (userTeams != null) {
        return owners.stream()
            .filter(ref -> Entity.TEAM.equals(ref.getType()))
            .anyMatch(
                teamRef ->
                    userTeams.stream()
                        .anyMatch(userTeam -> userTeam.getId().equals(teamRef.getId())));
      }
    } catch (Exception e) {
      LOG.debug("Could not fetch user teams for owner check: {}", e.getMessage());
    }

    return false;
  }

  /**
   * Helper to extract string list from JsonLogic argument
   */
  private static List<String> extractStringList(Object arg) {
    if (arg instanceof List<?>) {
      List<?> list = (List<?>) arg;
      List<String> result = new ArrayList<>();
      for (Object item : list) {
        result.add(item.toString());
      }
      return result;
    } else if (arg instanceof String) {
      return List.of((String) arg);
    } else {
      return new ArrayList<>();
    }
  }

  private static boolean convertToBoolean(Object result) {
    if (result instanceof Boolean) {
      return (Boolean) result;
    } else if (result instanceof Number) {
      return ((Number) result).doubleValue() != 0;
    } else if (result instanceof String) {
      return !((String) result).isEmpty();
    } else if (result == null) {
      return false;
    } else {
      return true;
    }
  }
}
