package org.openmetadata.service.rules;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.JsonUtils;

public class RuleEngine {

  @Getter private static final RuleEngine instance = new RuleEngine();
  private final JsonLogic jsonLogic;

  private RuleEngine() {
    this.jsonLogic = new JsonLogic();
    LogicOps.addCustomOps(jsonLogic);
  }

  /**
   * Evaluates the default platform entity semantics rules against the provided entity
   */
  public void evaluate(Object facts) {
    evaluate(facts, null, false);
  }

  public void evaluate(Object facts, List<SemanticsRule> rules) {
    evaluate(facts, rules, false);
  }

  public void evaluate(Object facts, List<SemanticsRule> rules, boolean incomingOnly) {
    ArrayList<SemanticsRule> rulesToEvaluate = new ArrayList<>();
    if (!incomingOnly) {
      rulesToEvaluate.addAll(getEnabledEntitySemantics());
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
}
