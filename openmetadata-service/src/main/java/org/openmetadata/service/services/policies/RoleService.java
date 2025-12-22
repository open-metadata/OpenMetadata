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

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.resources.teams.RoleMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

/**
 * Service layer for Role entity operations.
 *
 * <p>Extends AbstractEntityService to inherit all standard CRUD operations with proper
 * authorization and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.ROLE)
public class RoleService extends AbstractEntityService<Role> {

  @SuppressWarnings("unused")
  private final RoleMapper mapper;

  @Inject
  public RoleService(
      RoleRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      RoleMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.ROLE);
    this.mapper = mapper;
  }
}
