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
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.DatabaseSchemaProfilerConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.databases.DatabaseSchemaMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATABASE_SCHEMA)
public class DatabaseSchemaService
    extends EntityBaseService<DatabaseSchema, DatabaseSchemaRepository> {

  public static final String FIELDS =
      "owners,tables,usageSummary,tags,certification,extension,domains,sourceHash,followers";

  @Getter private final DatabaseSchemaMapper mapper;

  @Inject
  public DatabaseSchemaService(
      DatabaseSchemaRepository repository,
      Authorizer authorizer,
      DatabaseSchemaMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DATABASE_SCHEMA, DatabaseSchema.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public DatabaseSchema addHref(UriInfo uriInfo, DatabaseSchema schema) {
    super.addHref(uriInfo, schema);
    Entity.withHref(uriInfo, schema.getTables());
    Entity.withHref(uriInfo, schema.getService());
    Entity.withHref(uriInfo, schema.getDatabase());
    return schema;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("tables", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public RestUtil.PutResponse<DatabaseSchema> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public RestUtil.PutResponse<DatabaseSchema> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return repository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<DatabaseSchema> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return repository.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
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
        repository.addDatabaseSchemaProfilerConfig(id, databaseSchemaProfilerConfig);
    return addHref(uriInfo, databaseSchema);
  }

  public DatabaseSchema getDatabaseSchemaProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    DatabaseSchema databaseSchema = repository.find(id, Include.NON_DELETED);
    return addHref(
        uriInfo,
        databaseSchema.withDatabaseSchemaProfilerConfig(
            repository.getDatabaseSchemaProfilerConfig(databaseSchema)));
  }

  public DatabaseSchema deleteDatabaseSchemaProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    DatabaseSchema databaseSchema = repository.deleteDatabaseSchemaProfilerConfig(id);
    return addHref(uriInfo, databaseSchema);
  }

  public static class DatabaseSchemaList extends ResultList<DatabaseSchema> {
    /* Required for serde */
  }
}
