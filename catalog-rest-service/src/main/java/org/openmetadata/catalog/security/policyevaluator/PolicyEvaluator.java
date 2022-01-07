package org.openmetadata.catalog.security.policyevaluator;

import java.util.List;
import org.jeasy.rules.api.Rule;
import org.jeasy.rules.api.Rules;
import org.jeasy.rules.api.RulesEngine;
import org.jeasy.rules.api.RulesEngineParameters;
import org.jeasy.rules.core.DefaultRulesEngine;
import org.jeasy.rules.core.RuleBuilder;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.type.MetadataOperation;

/**
 * PolicyEvaluator for {@link MetadataOperation metadata operations} based on OpenMetadata's internal {@link
 * org.openmetadata.catalog.entity.policies.Policy} format to make access decisions.
 *
 * <p>This class uses {@link DefaultRulesEngine} provided by <a
 * href="https://github.com/j-easy/easy-rules">j-easy/easy-rules</a> package.
 *
 * <p>The rules defined as {@link org.openmetadata.catalog.entity.policies.accessControl.Rule} are to be fetched from
 * OpenMetadata's {@link org.openmetadata.catalog.jdbi3.PolicyRepository} and converted into type {@link Rule} to be
 * used within the {@link DefaultRulesEngine}
 *
 * <p>The facts are constructed based on 3 inputs for the PolicyEvaluator:
 *
 * <p>- {@link MetadataOperation operation} to be performed
 *
 * <p>- {@link User} (subject) who performs the operation
 *
 * <p>- {@link org.openmetadata.catalog.Entity} (object) on which to operate on.
 */
public class PolicyEvaluator {

  private final Rules rules;
  private final RulesEngine rulesEngine;

  public PolicyEvaluator(List<org.openmetadata.catalog.entity.policies.accessControl.Rule> rules) {
    this.rules = new Rules();
    rules.stream()
        .filter(org.openmetadata.catalog.entity.policies.accessControl.Rule::getEnabled)
        .map(this::convertRule)
        .forEach(this.rules::register);
    RulesEngineParameters parameters =
        new RulesEngineParameters().skipOnFirstAppliedRule(true); // When first rule applies, stop the matching.
    this.rulesEngine = new DefaultRulesEngine(parameters);
  }

  public boolean hasPermission(User user, Object entity, MetadataOperation operation) {
    AttributeBasedFacts facts =
        new AttributeBasedFacts.AttributeBasedFactsBuilder()
            .withUser(user)
            .withEntity(entity)
            .withOperation(operation)
            .build();
    this.rulesEngine.fire(rules, facts.getFacts());
    return facts.hasPermission();
  }

  private Rule convertRule(org.openmetadata.catalog.entity.policies.accessControl.Rule rule) {
    return new RuleBuilder()
        .name(rule.getName())
        .description(rule.getName())
        .priority(rule.getPriority())
        .when(new RuleCondition(rule))
        .then(new SetPermissionAction(rule))
        .build();
  }
}
