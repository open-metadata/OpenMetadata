package org.openmetadata.service.rules;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.JsonUtils;

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

  /**
   * Evaluates the default platform entity semantics rules against the provided entity
   */
  public void evaluate(EntityInterface facts) {
    evaluate(facts, null, false);
  }

  public void evaluate(EntityInterface facts, List<SemanticsRule> rules) {
    evaluate(facts, rules, false);
  }

  public void evaluate(EntityInterface facts, List<SemanticsRule> rules, boolean incomingOnly) {
    ArrayList<SemanticsRule> rulesToEvaluate = new ArrayList<>();
    if (!incomingOnly) {
      rulesToEvaluate.addAll(getEnabledEntitySemantics());
      List<DataContract> entityContracts = loadEntityDataContractsSafely(facts);
      if (!nullOrEmpty(entityContracts)) {
        entityContracts.forEach(
            contract -> {
              if (contract.getStatus() == ContractStatus.Active) {
                rulesToEvaluate.addAll(contract.getSemantics());
              }
            });
      }
    }
    if (!nullOrEmpty(rules)) {
      rulesToEvaluate.addAll(rules);
    }

    if (nullOrEmpty(rulesToEvaluate)) {
      return; // No rules to evaluate
    }

    rulesToEvaluate.forEach(
        rule -> {
          // Only evaluate the rule if it's a generic rule or the rule's entity type matches the
          // facts class
          if (rule.getEntityType() == null
              || Entity.getEntityRepository(rule.getEntityType())
                  .getEntityClass()
                  .isInstance(facts)) {
            validateRule(facts, rule);
          }
        });
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

  private List<DataContract> loadEntityDataContractsSafely(EntityInterface entity) {
    try {
      return dataContractRepository.loadEntityDataContract(entity);
    } catch (Exception e) {
      LOG.debug("Failed to load data contracts for entity {}: {}", entity.getId(), e.getMessage());
      return new ArrayList<>();
    }
  }
}
