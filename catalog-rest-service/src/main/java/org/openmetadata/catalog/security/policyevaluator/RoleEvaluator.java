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
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;

/**
 * RoleEvaluator for {@link MetadataOperation metadata operations} based on OpenMetadata's internal {@link
 * org.openmetadata.catalog.entity.teams.Role} format to make access decisions.
 *
 * <p>A subject (user/team) has a set of `Roles`. Each `Role` has a set of `Policies`. Each policy has a set of `Rules`.
 * This class delegates the access decision to PolicyEvaluator for each policy in a role based on the defined order. See
 * {@link PolicyEvaluator} for more details.
 */
@Slf4j
public class RoleEvaluator {
  // Eager initialization of Singleton since PolicyEvaluator is lightweight.
  private static final RoleEvaluator INSTANCE = new RoleEvaluator();

  private RoleEvaluator() {}

  public static RoleEvaluator getInstance() {
    return INSTANCE;
  }

  public boolean hasPermissions(SubjectContext subjectContext, EntityInterface entity, MetadataOperation operation) {
    // Role based permission
    for (EntityReference role : subjectContext.getAllRoles()) {
      List<EntityReference> policies = RoleCache.getRole(role.getId()).getPolicies();
      for (EntityReference policy : policies) {
        if (PolicyEvaluator.getInstance().hasPermission(policy.getId(), entity, operation)) {
          return true;
        }
      }
    }
    return false;
  }

  public List<MetadataOperation> getAllowedOperations(SubjectContext subjectContext, EntityInterface entity) {
    List<MetadataOperation> list = new ArrayList<>();
    for (EntityReference role : subjectContext.getAllRoles()) {
      List<EntityReference> policies = RoleCache.getRole(role.getId()).getPolicies();
      for (EntityReference policy : policies) {
        list.addAll(PolicyEvaluator.getInstance().getAllowedOperations(policy.getId(), entity));
      }
    }
    return list.stream().distinct().collect(Collectors.toList());
  }
}
