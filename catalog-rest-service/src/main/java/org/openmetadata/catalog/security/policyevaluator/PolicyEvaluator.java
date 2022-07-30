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

import static org.openmetadata.catalog.security.policyevaluator.PolicyFunctions.matchOperations;
import static org.openmetadata.catalog.security.policyevaluator.PolicyFunctions.matchResource;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Collectors;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.security.policyevaluator.PolicyCache.CompiledRule;
import org.openmetadata.catalog.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.catalog.type.MetadataOperation;

/**
 * PolicyEvaluator for {@link MetadataOperation metadata operations} based on OpenMetadata's internal {@link
 * org.openmetadata.catalog.entity.policies.Policy} format to make access decisions.
 *
 * <p>TODO documentation
 *
 * <p>This Singleton class uses {@link DefaultRulesEngine} provided by <a
 * href="https://github.com/j-easy/easy-rules">j-easy/easy-rules</a> package.
 *
 * <p>The rules defined as {@link org.openmetadata.catalog.entity.policies.accessControl.Rule} are to be fetched from
 * OpenMetadata's {@link org.openmetadata.catalog.jdbi3.PolicyRepository} and to be used within the {@link
 * DefaultRulesEngine}
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
  // Eager initialization of Singleton since PolicyEvaluator is lightweight.
  private static final PolicyEvaluator policyEvaluator = new PolicyEvaluator();

  private PolicyEvaluator() {}

  public static PolicyEvaluator getInstance() {
    return policyEvaluator;
  }

  /** Checks if the policy has rules that give permission to perform an operation on the given entity. */
  public boolean hasPermission(
      @NonNull SubjectContext subjectContext,
      @NonNull ResourceContextInterface resourceContext,
      @NonNull OperationContext operationContext) {
    // Role based permission
    Iterator<PolicyContext> policies = subjectContext.getPolicies();
    while (policies.hasNext()) {
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        if (matchResource(operationContext.getResource(), rule)
            && matchOperations(operationContext.getOperations(), rule)) {
          if (rule.getEffect() == Effect.DENY) {
            return false;
          }
          if (rule.getEffect() == Effect.ALLOW) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Returns a list of operations that a user can perform on the given entity. */
  public List<MetadataOperation> getAllowedOperations(
      @NonNull SubjectContext subjectContext, ResourceContextInterface resourceContext) {
    List<MetadataOperation> list = new ArrayList<>();
    Iterator<PolicyContext> policies = subjectContext.getPolicies();
    while (policies.hasNext()) {
      // TODO clean up (add resource name and allow/deny)
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        if (matchResource("all", rule)) {
          if (rule.getEffect() == Effect.ALLOW) {
            list.addAll(rule.getOperations());
          }
        }
      }
    }
    return list.stream().distinct().collect(Collectors.toList());
  }
}
