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
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.JsonUtils;

public class RuleEngine {

  @Getter private static final RuleEngine instance = new RuleEngine();
  private final JsonLogic jsonLogic;

  private RuleEngine() {
    this.jsonLogic = new JsonLogic();
    LogicOps.addCustomOps(jsonLogic);
  }

  public void evaluate(Object facts, List<SemanticsRule> rules) {
    evaluate(facts, rules, false);
  }

  public void evaluate(Object facts, List<SemanticsRule> rules, boolean incomingOnly) {
    ArrayList<SemanticsRule> rulesToEvaluate = new ArrayList<>();
    if (!incomingOnly) {
      rulesToEvaluate.addAll(getEntitySemantics());
    }
    if (!nullOrEmpty(rules)) {
      rulesToEvaluate.addAll(rules);
    }

    if (nullOrEmpty(rulesToEvaluate)) {
      return; // No rules to evaluate
    }

    rulesToEvaluate.forEach(
        rule -> {
          validateRule(facts, rule);
        });
  }

  private List<SemanticsRule> getEntitySemantics() {
    return SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class)
        .getEntitySemantics();
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
