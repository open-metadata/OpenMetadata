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

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.ServiceEntityInfo;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.resources.services.database.DatabaseServiceMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.DATABASE_SERVICE)
public class DatabaseServiceEntityService
    extends ServiceEntityResource<DatabaseService, DatabaseServiceRepository, DatabaseConnection> {
  public static final String FIELDS = "pipelines,owners,tags,domains,followers";

  @Getter private final DatabaseServiceMapper mapper = new DatabaseServiceMapper();

  @Inject
  public DatabaseServiceEntityService(
      DatabaseServiceRepository repository, Authorizer authorizer, Limits limits) {
    super(
        new ServiceEntityInfo<>(
            Entity.DATABASE_SERVICE, ServiceType.DATABASE, DatabaseService.class),
        repository,
        authorizer,
        limits);
  }

  @Override
  public DatabaseService addHref(UriInfo uriInfo, DatabaseService dbService) {
    super.addHref(uriInfo, dbService);
    Entity.withHref(uriInfo, dbService.getPipelines());
    return dbService;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("pipelines", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  protected DatabaseService nullifyConnection(DatabaseService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(DatabaseService service) {
    return service.getServiceType().value();
  }

  public DatabaseService addTestConnectionResult(
      SecurityContext securityContext, UUID serviceId, TestConnectionResult testConnectionResult) {
    OperationContext operationContext =
        new OperationContext(getEntityType(), MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(serviceId));
    DatabaseService service = repository.addTestConnectionResult(serviceId, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  public static class DatabaseServiceList extends ResultList<DatabaseService> {
    /* Required for serde */
  }
}
