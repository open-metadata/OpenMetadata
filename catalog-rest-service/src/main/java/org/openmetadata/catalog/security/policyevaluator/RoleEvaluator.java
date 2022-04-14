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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.ResultList;

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
  private final ConcurrentHashMap<UUID, List<EntityReference>> roleToPolicies = new ConcurrentHashMap<>();

  // Eager initialization of Singleton since PolicyEvaluator is lightweight.
  private static final RoleEvaluator INSTANCE = new RoleEvaluator();

  private RoleEvaluator() {}

  public static RoleEvaluator getInstance() {
    return INSTANCE;
  }

  public void load() {
    EntityRepository<Role> roleRepository = Entity.getEntityRepository(Entity.ROLE);
    roleToPolicies.clear();
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    try {
      Fields roleFields = roleRepository.getFields("policies");
      ResultList<Role> roles = roleRepository.listAfter(null, roleFields, filter, Short.MAX_VALUE, null);
      roles.getData().forEach(r -> roleToPolicies.put(r.getId(), r.getPolicies()));
    } catch (IOException e) {
      LOG.error("Failed to load roles", e);
    }
  }

  public boolean hasPermissions(List<EntityReference> roles, Object entity, MetadataOperation operation) {
    // Role based permission
    for (EntityReference roleRef : roles) {
      List<EntityReference> policies = roleToPolicies.get(roleRef.getId());
      for (EntityReference policy : policies) {
        if (PolicyEvaluator.getInstance().hasPermission(policy.getId(), entity, operation)) {
          return true;
        }
      }
    }
    return false;
  }

  public List<MetadataOperation> getAllowedOperations(List<EntityReference> roles, Object entity) {
    List<MetadataOperation> list = new ArrayList<>();
    for (EntityReference roleRef : roles) {
      List<EntityReference> policies = roleToPolicies.get(roleRef.getId());
      for (EntityReference policy : policies) {
        list.addAll(PolicyEvaluator.getInstance().getAllowedOperations(policy.getId(), entity));
      }
    }
    return list.stream().distinct().collect(Collectors.toList());
  }

  public void update(Role role) {
    roleToPolicies.put(role.getId(), role.getPolicies());
  }

  public void delete(Role role) {
    roleToPolicies.remove(role.getId());
  }
}
