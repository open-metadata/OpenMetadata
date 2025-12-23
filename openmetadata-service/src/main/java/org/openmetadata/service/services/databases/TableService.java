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

package org.openmetadata.service.services.databases;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

/**
 * Service layer for Table entity operations.
 *
 * <p>Extends AbstractEntityService to inherit all standard CRUD operations with proper
 * authorization and repository delegation.
 *
 * <p>Override methods only when custom business logic is required. By default, all operations are
 * handled by the base class.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.TABLE)
public class TableService extends AbstractEntityService<Table> {

  @SuppressWarnings("unused")
  private final TableMapper mapper;

  /**
   * Constructor with dependency injection.
   *
   * @param repository TableRepository for data access (injected by Dagger)
   * @param searchRepository SearchRepository for search operations (injected by Dagger)
   * @param authorizer Authorizer for access control (injected by Dagger)
   * @param mapper TableMapper for DTO conversions (injected by Dagger)
   */
  @Inject
  public TableService(
      TableRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TableMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.TABLE);
    this.mapper = mapper;
  }

  // All CRUD operations inherited from AbstractEntityService
  // Override methods here only if custom logic is needed
}
