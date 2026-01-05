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

package org.openmetadata.service.services.policies;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.teams.RoleMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
@Singleton
@Service(entityType = Entity.ROLE)
public class RoleService extends EntityBaseService<Role, RoleRepository> {

  public static final String FIELDS = "policies,teams,users";

  @Getter private final RoleMapper mapper;

  @Inject
  public RoleService(
      RoleRepository repository, Authorizer authorizer, RoleMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.ROLE, Role.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("policies,teams,users", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public Role addHref(UriInfo uriInfo, Role role) {
    super.addHref(uriInfo, role);
    Entity.withHref(uriInfo, role.getPolicies());
    Entity.withHref(uriInfo, role.getTeams());
    Entity.withHref(uriInfo, role.getUsers());
    return role;
  }

  @SneakyThrows
  public void initialize() {
    List<Role> roles = repository.getEntitiesFromSeedData();
    for (Role role : roles) {
      role.setFullyQualifiedName(role.getName());
      List<EntityReference> policies = role.getPolicies();
      for (EntityReference policy : policies) {
        EntityReference ref =
            Entity.getEntityReferenceByName(Entity.POLICY, policy.getName(), Include.NON_DELETED);
        policy.setId(ref.getId());
      }
      repository.initializeEntity(role);
    }
  }

  public static class RoleList extends ResultList<Role> {}

  public ResultList<Role> listRoles(
      UriInfo uriInfo,
      String fieldsParam,
      int limitParam,
      String before,
      String after,
      Include include) {
    Fields fields = getFields(fieldsParam);
    ListFilter filter = new ListFilter(include);

    ResultList<Role> roles;
    if (before != null) {
      roles = repository.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      roles = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, roles);
  }
}
