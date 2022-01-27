package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Rule;
import org.jeasy.rules.api.Rules;
import org.jeasy.rules.api.RulesEngine;
import org.jeasy.rules.api.RulesEngineParameters;
import org.jeasy.rules.core.DefaultRulesEngine;
import org.jeasy.rules.core.RuleBuilder;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.PolicyRepository;
import org.openmetadata.catalog.type.MetadataOperation;

/**
 * PolicyEvaluator for {@link MetadataOperation metadata operations} based on OpenMetadata's internal {@link
 * org.openmetadata.catalog.entity.policies.Policy} format to make access decisions.
 *
 * <p>This Singleton class uses {@link DefaultRulesEngine} provided by <a
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
@Slf4j
public class PolicyEvaluator {

  private PolicyRepository policyRepository;
  private AtomicReference<Rules> rules;
  private RulesEngine rulesEngine;

  // Eager initialization of Singleton since PolicyEvaluator is lightweight.
  private static final PolicyEvaluator policyEvaluator = new PolicyEvaluator();

  private PolicyEvaluator() {
    RulesEngineParameters parameters =
        new RulesEngineParameters().skipOnFirstAppliedRule(true); // When first rule applies, stop the matching.
    rulesEngine = new DefaultRulesEngine(parameters);
    // Initialize with empty set of rules. If not, the RulesEngine would throw NullPointerException.
    rules = new AtomicReference<>(new Rules());
  }

  public static PolicyEvaluator getInstance() {
    return policyEvaluator;
  }

  public void setPolicyRepository(PolicyRepository policyRepository) {
    this.policyRepository = policyRepository;
  }

  /** Refresh rules within {@link PolicyEvaluator} to be used by {@link DefaultRulesEngine}. */
  public void refreshRules() throws IOException {
    LOG.warn("{} rules are available for Access Control", rules.get().size());
    Rules newRules = new Rules();
    policyRepository.getAccessControlPolicyRules().stream()
        // Add rules only if they are enabled.
        .filter(org.openmetadata.catalog.entity.policies.accessControl.Rule::getEnabled)
        .map(this::convertRule)
        .forEach(newRules::register);
    // Atomic swap of rules.
    rules.set(newRules);
    LOG.warn("Loaded new set of {} rules for Access Control", rules.get().size());
  }

  public boolean hasPermission(User user, Object entity, MetadataOperation operation) {
    AttributeBasedFacts facts =
        new AttributeBasedFacts.AttributeBasedFactsBuilder()
            .withUser(user)
            .withEntity(entity)
            .withOperation(operation)
            .build();
    rulesEngine.fire(rules.get(), facts.getFacts());
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
