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

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.DatabaseSchemaProfilerConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.resources.databases.DatabaseSchemaMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATABASE_SCHEMA)
public class DatabaseSchemaService extends AbstractEntityService<DatabaseSchema> {

  @Getter private final DatabaseSchemaMapper mapper;
  private final DatabaseSchemaRepository databaseSchemaRepository;

  @Inject
  public DatabaseSchemaService(
      DatabaseSchemaRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DatabaseSchemaMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.DATABASE_SCHEMA);
    this.databaseSchemaRepository = repository;
    this.mapper = mapper;
  }

  public DatabaseSchema addDatabaseSchemaProfilerConfig(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      DatabaseSchemaProfilerConfig databaseSchemaProfilerConfig) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    DatabaseSchema databaseSchema =
        databaseSchemaRepository.addDatabaseSchemaProfilerConfig(id, databaseSchemaProfilerConfig);
    return addHref(uriInfo, databaseSchema);
  }

  public DatabaseSchema getDatabaseSchemaProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    DatabaseSchema databaseSchema = databaseSchemaRepository.find(id, Include.NON_DELETED);
    return addHref(
        uriInfo,
        databaseSchema.withDatabaseSchemaProfilerConfig(
            databaseSchemaRepository.getDatabaseSchemaProfilerConfig(databaseSchema)));
  }

  public DatabaseSchema deleteDatabaseSchemaProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    DatabaseSchema databaseSchema = databaseSchemaRepository.deleteDatabaseSchemaProfilerConfig(id);
    return addHref(uriInfo, databaseSchema);
  }

  public RestUtil.PutResponse<DatabaseSchema> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return databaseSchemaRepository.addFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<DatabaseSchema> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return databaseSchemaRepository.deleteFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<DatabaseSchema> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return databaseSchemaRepository.updateVote(
        securityContext.getUserPrincipal().getName(), id, request);
  }

  private DatabaseSchema addHref(UriInfo uriInfo, DatabaseSchema schema) {
    Entity.withHref(uriInfo, schema.getOwners());
    Entity.withHref(uriInfo, schema.getFollowers());
    Entity.withHref(uriInfo, schema.getTables());
    Entity.withHref(uriInfo, schema.getService());
    Entity.withHref(uriInfo, schema.getDatabase());
    return schema;
  }
}
