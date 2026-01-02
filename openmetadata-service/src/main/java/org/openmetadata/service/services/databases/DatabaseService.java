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

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.DatabaseProfilerConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.databases.DatabaseMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATABASE)
public class DatabaseService extends EntityBaseService<Database, DatabaseRepository> {

  public static final String FIELDS =
      "owners,databaseSchemas,usageSummary,location,tags,certification,extension,domains,sourceHash,followers";

  @Getter private final DatabaseMapper mapper;

  public static class DatabaseList extends ResultList<Database> {
    /* Required for serde */
  }

  @Inject
  public DatabaseService(
      DatabaseRepository repository, Authorizer authorizer, DatabaseMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DATABASE, Database.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Database addHref(UriInfo uriInfo, Database db) {
    super.addHref(uriInfo, db);
    Entity.withHref(uriInfo, db.getDatabaseSchemas());
    Entity.withHref(uriInfo, db.getLocation());
    Entity.withHref(uriInfo, db.getService());
    return db;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("databaseSchemas,location", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public Database addDatabaseProfilerConfig(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      DatabaseProfilerConfig databaseProfilerConfig) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = repository.addDatabaseProfilerConfig(id, databaseProfilerConfig);
    return addHref(uriInfo, database);
  }

  public Database getDatabaseProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = repository.find(id, Include.NON_DELETED);
    return addHref(
        uriInfo,
        database.withDatabaseProfilerConfig(repository.getDatabaseProfilerConfig(database)));
  }

  public Database deleteDatabaseProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = repository.deleteDatabaseProfilerConfig(id);
    return addHref(uriInfo, database);
  }

  public RestUtil.PutResponse<Database> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }
}
