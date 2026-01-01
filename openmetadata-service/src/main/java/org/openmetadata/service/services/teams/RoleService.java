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

package org.openmetadata.service.services.teams;

import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.resources.teams.RoleMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.ROLE)
public class RoleService extends AbstractEntityService<Role> {

  @Getter private final RoleMapper mapper;
  private final RoleRepository roleRepository;

  @Inject
  public RoleService(
      RoleRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      RoleMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.ROLE);
    this.roleRepository = repository;
    this.mapper = mapper;
  }

  @SneakyThrows
  public void initialize() {
    List<Role> roles = roleRepository.getEntitiesFromSeedData();
    for (Role role : roles) {
      role.setFullyQualifiedName(role.getName());
      List<EntityReference> policies = role.getPolicies();
      for (EntityReference policy : policies) {
        EntityReference ref =
            Entity.getEntityReferenceByName(Entity.POLICY, policy.getName(), Include.NON_DELETED);
        policy.setId(ref.getId());
      }
      roleRepository.initializeEntity(role);
    }
  }
}
