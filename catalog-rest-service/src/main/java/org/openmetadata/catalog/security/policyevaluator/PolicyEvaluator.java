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
import java.util.Collection;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.ResourceRegistry;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.security.AuthorizationException;
import org.openmetadata.catalog.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.Permission;
import org.openmetadata.catalog.type.Permission.Access;
import org.openmetadata.catalog.type.ResourceDescriptor;
import org.openmetadata.catalog.type.ResourcePermission;

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

  private PolicyEvaluator() {}

  /** Checks if the policy has rules that give permission to perform an operation on the given entity. */
  public static void hasPermission(
      @NonNull SubjectContext subjectContext,
      @NonNull ResourceContextInterface resourceContext,
      @NonNull OperationContext operationContext) {

    // First run through all the DENY policies
    Iterator<PolicyContext> policies = subjectContext.getPolicies();
    while (policies.hasNext()) {
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        LOG.debug(
            "evaluating policy for deny {}:{}:{}",
            policyContext.getRoleName(),
            policyContext.getPolicyName(),
            rule.getName());
        rule.evaluateDenyRule(policyContext, operationContext, subjectContext, resourceContext);
      }
    }
    // Next run through all the ALLOW policies
    policies = subjectContext.getPolicies(); // Refresh the iterator
    while (policies.hasNext()) {
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        LOG.debug(
            "evaluating policy for allow {}:{}:{}",
            policyContext.getRoleName(),
            policyContext.getPolicyName(),
            rule.getName());
        rule.evaluateAllowRule(operationContext, subjectContext, resourceContext);
        if (operationContext.getOperations().isEmpty()) {
          return; // All operations are allowed
        }
      }
    }
    throw new AuthorizationException(
        CatalogExceptionMessage.permissionNotAllowed(
            subjectContext.getUser().getName(), operationContext.getOperations()));
  }

  /** Returns a list of operations that a user can perform on the given entity. */
  public static List<ResourcePermission> getAllowedOperations(@NonNull SubjectContext subjectContext) {
    Map<String, ResourcePermission> resourcePermissionMap = initResourcePermissions();

    Iterator<PolicyContext> policies = subjectContext.getPolicies();
    while (policies.hasNext()) {
      PolicyContext policyContext = policies.next();
      for (CompiledRule rule : policyContext.getRules()) {
        LOG.debug("evaluating {}:{}:{}\n", policyContext.getRoleName(), policyContext.getPolicyName(), rule.getName());
        // TODO fix this
        if (rule.matchRuleForPermissions(subjectContext)) {
          if (rule.getResources().contains("all")) {
            setPermissionForAllResources(resourcePermissionMap, rule, policyContext);
          } else {
            setPermissionForResources(resourcePermissionMap, rule, policyContext);
          }
        }
      }
    }
    return new ArrayList<>(resourcePermissionMap.values());
  }

  /** Get list of resources with all their permissions set to given Access */
  public static List<ResourcePermission> getResourcePermissions(Access access) {
    List<ResourcePermission> resourcePermissions = new ArrayList<>();
    for (ResourceDescriptor rd : ResourceRegistry.listResourceDescriptors()) {
      List<Permission> permissions = new ArrayList<>();
      for (MetadataOperation operation : rd.getOperations()) {
        permissions.add(new Permission().withOperation(operation).withAccess(access));
      }
      ResourcePermission resourcePermission =
          new ResourcePermission().withResource(rd.getName()).withPermissions(permissions);
      resourcePermissions.add(resourcePermission);
    }
    return resourcePermissions;
  }

  /**
   * Initialize a map of Resource name to ResourcePermission with for each resource permission for all operations set as
   * NOT_ALLOW
   */
  public static Map<String, ResourcePermission> initResourcePermissions() {
    // For each resource, initialize permission for each operation as NOT_ALLOW
    Collection<ResourcePermission> resourcePermissions = getResourcePermissions(Access.NOT_ALLOW);
    Map<String, ResourcePermission> resourcePermissionMap = new HashMap<>();
    resourcePermissions.forEach(rp -> resourcePermissionMap.put(rp.getResource(), rp));
    return resourcePermissionMap;
  }

  public static void setPermissionForAllResources(
      Map<String, ResourcePermission> resourcePermissionMap, Rule rule, PolicyContext policyContext) {
    // For all resources, set the permission
    for (ResourcePermission resourcePermission : resourcePermissionMap.values()) {
      setPermission(resourcePermission, rule, policyContext);
    }
  }

  private static void setPermissionForResources(
      Map<String, ResourcePermission> resourcePermissionMap, CompiledRule rule, PolicyContext policyContext) {
    for (String resource : rule.getResources()) {
      ResourcePermission resourcePermission = resourcePermissionMap.get(resource);
      setPermission(resourcePermission, rule, policyContext);
    }
  }

  private static void setPermission(ResourcePermission resourcePermission, Rule rule, PolicyContext policyContext) {
    Access access = getAccess(rule);
    for (MetadataOperation ruleOperation : rule.getOperations()) {
      for (Permission permission : resourcePermission.getPermissions()) {
        if (permission.getOperation().equals(ruleOperation)) {
          if (overrideAccess(access, permission.getAccess())) {
            permission
                .withAccess(access)
                .withRole(policyContext.getRoleName())
                .withPolicy(policyContext.getPolicyName())
                .withRule(rule);
            LOG.debug("Updated permission {}", permission);
          }
        }
      }
    }
  }

  private static Access getAccess(Rule rule) {
    if (rule.getCondition() != null) {
      return rule.getEffect() == Effect.DENY ? Access.CONDITIONAL_DENY : Access.CONDITIONAL_ALLOW;
    }
    return rule.getEffect() == Effect.DENY ? Access.DENY : Access.ALLOW;
  }

  // Returns true if access1 has precedence over access2
  public static boolean overrideAccess(Access newAccess, Access currentAccess) {
    // Lower the ordinal number of access overrides higher ordinal number
    return currentAccess.ordinal() > newAccess.ordinal();
  }
}
