package org.openmetadata.service.rules;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class RuleEngine {

  @Getter private static final RuleEngine instance = new RuleEngine();
  private final JsonLogic jsonLogic;
  private final DataContractRepository dataContractRepository;

  private RuleEngine() {
    this.jsonLogic = new JsonLogic();
    LogicOps.addCustomOps(jsonLogic);
    dataContractRepository =
        (DataContractRepository) Entity.getEntityRepository(Entity.DATA_CONTRACT);
  }

  public Object apply(String rule, Map<String, Object> context) {
    try {
      rule = unescapeFilter(rule);
      return jsonLogic.apply(rule, context);
    } catch (Exception e) {
      // Return false, falls back to triggering workflow
      return false;
    }
  }

  /**
   * Evaluates the default platform entity semantics rules against the provided entity
   */
  public void evaluate(EntityInterface facts) {
    evaluate(facts, null, false);
  }

  public void evaluateUpdate(EntityInterface original, EntityInterface updated) {
    List<SemanticsRule> originalErrors = evaluateAndReturn(original, null, false);
    List<SemanticsRule> updatedErrors = evaluateAndReturn(updated, null, false);

    // If the updated entity is not fixing anything, throw a validation exception
    if (!nullOrEmpty(updatedErrors) && updatedErrors.size() >= originalErrors.size()) {
      raiseErroredRules(updatedErrors);
    }
  }

  public void evaluate(EntityInterface facts, List<SemanticsRule> rules) {
    evaluate(facts, rules, false);
  }

  public void evaluate(EntityInterface facts, List<SemanticsRule> rules, boolean incomingOnly) {
    List<SemanticsRule> erroredRules = evaluateAndReturn(facts, rules, incomingOnly);
    raiseErroredRules(erroredRules);
  }

  private void raiseErroredRules(List<SemanticsRule> erroredRules) {
    if (!nullOrEmpty(erroredRules) && erroredRules.size() == 1) {
      throw new RuleValidationException(
          erroredRules.getFirst(), "Entity does not satisfy the rule");
    }
    if (!nullOrEmpty(erroredRules)) {
      throw new RuleValidationException(erroredRules, "Entity does not satisfy multiple rules");
    }
  }

  public List<SemanticsRule> evaluateAndReturn(
      EntityInterface facts, List<SemanticsRule> rules, boolean incomingOnly) {
    ArrayList<SemanticsRule> rulesToEvaluate = new ArrayList<>();
    if (!incomingOnly) {
      rulesToEvaluate.addAll(getEnabledEntitySemantics());
      DataContract entityContract = dataContractRepository.getEntityDataContractSafely(facts);
      if (entityContract != null
          && entityContract.getStatus() == ContractStatus.Active
          && !nullOrEmpty(entityContract.getSemantics())) {
        rulesToEvaluate.addAll(entityContract.getSemantics());
      }
    }
    if (!nullOrEmpty(rules)) {
      rulesToEvaluate.addAll(rules);
    }

    if (nullOrEmpty(rulesToEvaluate)) {
      return List.of(); // No rules to evaluate
    }

    List<SemanticsRule> erroredRules = new ArrayList<>();
    rulesToEvaluate.forEach(
        rule -> {
          if (shouldApplyRule(facts, rule)) {
            try {
              validateRule(facts, rule);
            } catch (RuleValidationException e) {
              erroredRules.add(rule);
            }
          }
        });

    return erroredRules;
  }

  public Boolean shouldApplyRule(EntityInterface facts, SemanticsRule rule) {
    // If the rule is not entity-specific, apply it
    if (rule.getEntityType() == null && nullOrEmpty(rule.getIgnoredEntities())) {
      return true;
    }
    // Then, apply the rule only if type matches
    if (rule.getEntityType() != null) {
      return Entity.getEntityRepository(rule.getEntityType()).getEntityClass().isInstance(facts);
    }
    // Finally, check if the rule is not ignored for the entity type
    if (!nullOrEmpty(rule.getIgnoredEntities())) {
      List<? extends Class<? extends EntityInterface>> ignoredEntities =
          rule.getIgnoredEntities().stream()
              .map(Entity::getEntityRepository)
              .map(EntityRepository::getEntityClass)
              .toList();
      return !ignoredEntities.contains(facts.getClass());
    }
    return true; // Default case, apply the rule
  }

  private List<SemanticsRule> getEnabledEntitySemantics() {
    return SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class)
        .getEntitySemantics()
        .stream()
        .filter(SemanticsRule::getEnabled)
        .toList();
  }

  private void validateRule(Object facts, SemanticsRule rule) throws RuleValidationException {
    try {
      Boolean result = (Boolean) jsonLogic.apply(rule.getRule(), JsonUtils.getMap(facts));
      if (result == null || !result) {
        throw new RuleValidationException(rule, "Entity does not satisfy the rule");
      }
    } catch (JsonLogicException e) {
      throw new RuleValidationException(rule, e.getMessage(), e);
    }
  }

  private DataContract getEntityDataContractSafely(EntityInterface entity) {
    try {
      return dataContractRepository.loadEntityDataContract(entity.getEntityReference());
    } catch (Exception e) {
      LOG.debug("Failed to load data contracts for entity {}: {}", entity.getId(), e.getMessage());
      return null;
    }
  }

    private static String unescapeFilter(String filterLogic) throws JsonProcessingException {
        Object ruleObj = JsonUtils.getObjectMapper().readValue(filterLogic, Object.class);
        if (ruleObj instanceof String) {
            ruleObj = JsonUtils.getObjectMapper().readValue((String) ruleObj, Object.class);
        }
        return JsonUtils.getObjectMapper().writeValueAsString(ruleObj);
    }
}
