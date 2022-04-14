/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Rule;
import org.jeasy.rules.api.Rules;
import org.jeasy.rules.api.RulesEngine;
import org.jeasy.rules.api.RulesEngineParameters;
import org.jeasy.rules.core.DefaultRulesEngine;
import org.jeasy.rules.core.RuleBuilder;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.PolicyRepository;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.JsonUtils;

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
  private final ConcurrentHashMap<UUID, Rules> policyToRules = new ConcurrentHashMap<>();
  private final RulesEngine checkPermissionRulesEngine;
  private final RulesEngine allowedOperationsRulesEngine;

  // Eager initialization of Singleton since PolicyEvaluator is lightweight.
  private static final PolicyEvaluator policyEvaluator = new PolicyEvaluator();

  private PolicyEvaluator() {
    // When first rule applies, stop the check for permission.
    checkPermissionRulesEngine = new DefaultRulesEngine(new RulesEngineParameters().skipOnFirstAppliedRule(true));
    allowedOperationsRulesEngine = new DefaultRulesEngine();
  }

  public static PolicyEvaluator getInstance() {
    return policyEvaluator;
  }

  public void setPolicyRepository(PolicyRepository policyRepository) {
    this.policyRepository = policyRepository;
  }

  /** Refresh rules within {@link PolicyEvaluator} to be used by {@link DefaultRulesEngine}. */
  public void load() {
    final List<Policy> policies;
    try {
      policies = policyRepository.getAccessControlPolicies();
      for (final Policy policy : policies) {
        Rules rules = getRules(policy);
        //      policy.getRules().stream()
        //          // Add rules only if they are enabled.
        //          .filter(t -> ((org.openmetadata.catalog.entity.policies.accessControl.Rule) t).getEnabled())
        //          .map((Object rule) -> convertRule((org.openmetadata.catalog.entity.policies.accessControl.Rule)
        // rule))
        //          .forEach(newRules::register);
        //      // Atomic swap of rules.
        policyToRules.put(policy.getId(), rules);
        LOG.info("Loaded new set of {} rules for policy {}:{}", rules.size(), policy.getName(), policy.getId());
      }
    } catch (IOException e) {
      LOG.error("Failed to reload Policies");
    }
    LOG.info("Finished loading Access Control policies");
  }

  /** Checks if the policy has rules that gives permission to perform an operation on the given entity. */
  public boolean hasPermission(@NonNull UUID policyId, Object entity, @NonNull MetadataOperation operation) {
    AttributeBasedFacts facts =
        new AttributeBasedFacts.AttributeBasedFactsBuilder()
            .withEntity(entity)
            .withOperation(operation)
            .withCheckOperation(true)
            .build();
    Rules rules = policyToRules.get(policyId);
    checkPermissionRulesEngine.fire(rules, facts.getFacts());
    return facts.hasPermission();
  }

  /** Returns a list of operations that a user can perform on the given entity. */
  public List<MetadataOperation> getAllowedOperations(@NonNull UUID policyId, Object entity) {
    AttributeBasedFacts facts = new AttributeBasedFacts.AttributeBasedFactsBuilder().withEntity(entity).build();
    Rules rules = policyToRules.get(policyId);
    allowedOperationsRulesEngine.fire(rules, facts.getFacts());
    return facts.getAllowedOperations();
  }

  private Rule convertRule(org.openmetadata.catalog.entity.policies.accessControl.Rule rule) {
    return new RuleBuilder()
        .name(rule.getName())
        .description(rule.getName())
        .priority(rule.getPriority())
        .when(new RuleCondition(rule))
        .then(new SetPermissionAction(rule))
        .then(new SetAllowedOperationAction(rule))
        .build();
  }

  public void update(Policy policy) throws IOException {
    policyToRules.put(policy.getId(), getRules(policy));
  }

  public void delete(Policy po) {
    policyToRules.remove(po.getId());
  }

  public Rules getRules(Policy policy) throws IOException {
    Rules rules = new Rules();
    for (Object r : policy.getRules()) {
      org.openmetadata.catalog.entity.policies.accessControl.Rule acRule =
          JsonUtils.readValue(
              JsonUtils.getJsonStructure(r).toString(),
              org.openmetadata.catalog.entity.policies.accessControl.Rule.class);
      if (acRule.getAllow()) {
        rules.register(convertRule(acRule));
      }
    }
    return rules;
  }
}
