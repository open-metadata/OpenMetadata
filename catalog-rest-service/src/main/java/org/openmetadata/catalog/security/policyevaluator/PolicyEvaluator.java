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

import java.util.List;
import java.util.UUID;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Rule;
import org.jeasy.rules.api.Rules;
import org.jeasy.rules.api.RulesEngine;
import org.jeasy.rules.api.RulesEngineParameters;
import org.jeasy.rules.core.DefaultRulesEngine;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.entity.teams.User;
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

  /** Checks if the policy has rules that give permission to perform an operation on the given entity. */
  public boolean hasPermission(@NonNull UUID policyId, EntityInterface entity, @NonNull MetadataOperation operation) {
    AttributeBasedFacts facts =
        new AttributeBasedFacts.AttributeBasedFactsBuilder()
            .withEntity(entity)
            .withOperation(operation)
            .withCheckOperation(true)
            .build();
    Rules rules = PolicyCache.getPolicyRules(policyId);
    checkPermissionRulesEngine.fire(rules, facts.getFacts());
    return facts.hasPermission();
  }

  /** Returns a list of operations that a user can perform on the given entity. */
  public List<MetadataOperation> getAllowedOperations(@NonNull UUID policyId, EntityInterface entity) {
    AttributeBasedFacts facts = new AttributeBasedFacts.AttributeBasedFactsBuilder().withEntity(entity).build();
    Rules rules = PolicyCache.getPolicyRules(policyId);
    allowedOperationsRulesEngine.fire(rules, facts.getFacts());
    return facts.getAllowedOperations();
  }
}
