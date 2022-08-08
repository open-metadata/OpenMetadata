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

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Collectors;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.catalog.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.catalog.type.MetadataOperation;

/**
 * PolicyEvaluator for {@link MetadataOperation metadata operations} based on OpenMetadata's internal {@link Policy}
 * format to make access decisions.
 *
 * <p>Policy Evaluation uses the following:
 *
 * <ul>
 *   <li>{@link Policy} which is a collection of `Allow` and `Deny` rules {@link Rule}.
 *   <li>PolicyEvaluator gets {@link OperationContext} with information about the operation, {@link ResourceContext}
 *       with information about the resource on which the operations is being performed, and {@link SubjectContext} with
 *       information about the user performing the operation.
 *   <li>First, all the Deny rules are applied and if there is rule match, then the operation is denied.
 *   <li>Second, all the Allow rules are applied and if there is rule match, then the operation is allowed.
 *   <li>All operations that don't a match rule are not allowed.
 * </ul>
 */
@Slf4j
public class PolicyEvaluator {
  /** Checks if the policy has rules that give permission to perform an operation on the given entity. */
  public static boolean hasPermission(
      @NonNull SubjectContext subjectContext,
      @NonNull ResourceContextInterface resourceContext,
      @NonNull OperationContext operationContext) {

    // First run through all the DENY policies
    Iterator<PolicyContext> policies = subjectContext.getPolicies();
    while (policies.hasNext()) {
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        if (rule.getEffect() == Effect.DENY
            && CompiledRule.matchRule(rule, operationContext, subjectContext, resourceContext)) {
          return false;
        }
      }
    }
    // Next run through all the ALLOW policies
    policies = subjectContext.getPolicies(); // Refresh the iterator
    while (policies.hasNext()) {
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        if (rule.getEffect() == Effect.ALLOW
            && CompiledRule.matchRule(rule, operationContext, subjectContext, resourceContext)) {
          return true;
        }
      }
    }
    return false;
  }

  /** Returns a list of operations that a user can perform on the given entity. */
  public static List<MetadataOperation> getAllowedOperations(@NonNull SubjectContext subjectContext) {
    List<MetadataOperation> list = new ArrayList<>();
    Iterator<PolicyContext> policies = subjectContext.getPolicies();

    while (policies.hasNext()) {
      // TODO clean up (add resource name and allow/deny)
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        if (CompiledRule.matchRuleForPermissions(rule, subjectContext)) {
          if (rule.getEffect() == Effect.ALLOW) {
            list.addAll(rule.getOperations());
          }
        }
      }
    }
    return list.stream().distinct().collect(Collectors.toList());
  }
}
