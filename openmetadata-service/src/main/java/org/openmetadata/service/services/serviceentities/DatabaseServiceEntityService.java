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

package org.openmetadata.service.services.serviceentities;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.resources.services.database.DatabaseServiceMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.DATABASE_SERVICE)
public class DatabaseServiceEntityService
    extends AbstractServiceEntityService<
        DatabaseService, DatabaseServiceRepository, DatabaseConnection> {

  @Getter private final DatabaseServiceMapper mapper = new DatabaseServiceMapper();

  @Inject
  public DatabaseServiceEntityService(
      DatabaseServiceRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer) {
    super(repository, searchRepository, authorizer, Entity.DATABASE_SERVICE, ServiceType.DATABASE);
  }

  @Override
  protected String extractServiceType(DatabaseService service) {
    return service.getServiceType().value();
  }
}
