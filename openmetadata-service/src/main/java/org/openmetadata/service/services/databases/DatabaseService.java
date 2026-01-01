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
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.DatabaseProfilerConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.resources.databases.DatabaseMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATABASE)
public class DatabaseService extends AbstractEntityService<Database> {

  @Getter private final DatabaseMapper mapper;
  private final DatabaseRepository databaseRepository;

  @Inject
  public DatabaseService(
      DatabaseRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DatabaseMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.DATABASE);
    this.databaseRepository = repository;
    this.mapper = mapper;
  }

  public Database addDatabaseProfilerConfig(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      DatabaseProfilerConfig databaseProfilerConfig) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = databaseRepository.addDatabaseProfilerConfig(id, databaseProfilerConfig);
    return addHref(uriInfo, database);
  }

  public Database getDatabaseProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = databaseRepository.find(id, Include.NON_DELETED);
    return addHref(
        uriInfo,
        database.withDatabaseProfilerConfig(
            databaseRepository.getDatabaseProfilerConfig(database)));
  }

  public Database deleteDatabaseProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Database database = databaseRepository.deleteDatabaseProfilerConfig(id);
    return addHref(uriInfo, database);
  }

  public RestUtil.PutResponse<Database> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return databaseRepository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Database> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return databaseRepository.deleteFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Database> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return databaseRepository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  private Database addHref(UriInfo uriInfo, Database database) {
    Entity.withHref(uriInfo, database.getOwners());
    Entity.withHref(uriInfo, database.getFollowers());
    Entity.withHref(uriInfo, database.getDatabaseSchemas());
    Entity.withHref(uriInfo, database.getLocation());
    Entity.withHref(uriInfo, database.getService());
    return database;
  }
}
