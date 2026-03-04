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

package org.openmetadata.service.resources;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;
import static org.openmetadata.service.util.EntityUtil.createOrUpdateOperation;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.json.JsonPatch;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.schema.BulkAssetsRequestInterface;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.BulkAssetsOperationResponse;
import org.openmetadata.service.util.CSVExportResponse;
import org.openmetadata.service.util.CSVImportResponse;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ValidatorUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public abstract class EntityResource<T extends EntityInterface, K extends EntityRepository<T>> {
  protected final Class<T> entityClass;
  protected final String entityType;
  protected final Set<String> allowedFields;
  @Getter protected final K repository;
  protected final Authorizer authorizer;
  protected final Limits limits;
  protected final Map<String, MetadataOperation> fieldsToViewOperations = new HashMap<>();

  protected EntityResource(String entityType, Authorizer authorizer, Limits limits) {
    this.entityType = entityType;
    this.repository = (K) Entity.getEntityRepository(entityType);
    this.entityClass = (Class<T>) Entity.getEntityClassFromType(entityType);
    allowedFields = repository.getAllowedFields();
    this.authorizer = authorizer;
    this.limits = limits;
    addViewOperation(
        "owners,followers,votes,tags,extension,domains,dataProducts,experts,reviewers", VIEW_BASIC);
    Entity.registerResourcePermissions(entityType, getEntitySpecificOperations());
    Entity.registerResourceFieldViewMapping(entityType, fieldsToViewOperations);
  }

  /** Method used for initializing a resource, such as creating default policies, roles, etc. */
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {}

  /**
   * Method used for upgrading a resource such as adding new fields to entities, etc. that can't be done in bootstrap
   * migrate
   */
  public void upgrade() {
    // Nothing to do in the default implementation
  }

  public final Fields getFields(String fields) {
    return repository.getFields(fields);
  }

  protected T addHref(UriInfo uriInfo, T entity) {
    Entity.withHref(uriInfo, entity.getOwners());
    Entity.withHref(uriInfo, entity.getFollowers());
    Entity.withHref(uriInfo, entity.getExperts());
    Entity.withHref(uriInfo, entity.getReviewers());
    Entity.withHref(uriInfo, entity.getChildren());
    Entity.withHref(uriInfo, entity.getDomains());
    Entity.withHref(uriInfo, entity.getDataProducts());
    return entity;
  }

  protected List<MetadataOperation> getEntitySpecificOperations() {
    return null;
  }

  public final ResultList<T> addHref(UriInfo uriInfo, ResultList<T> list) {
    listOrEmpty(list.getData()).forEach(i -> addHref(uriInfo, i));
    return list;
  }

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      int limitParam,
      String before,
      String after) {
    Fields fields = getFields(fieldsParam);
    OperationContext listOperationContext =
        new OperationContext(entityType, getViewOperations(fields));
    ResourceContext resourceContext = filter.getResourceContext(entityType);
    return listInternal(
        uriInfo,
        securityContext,
        fields,
        filter,
        limitParam,
        before,
        after,
        listOperationContext,
        resourceContext);
  }

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limitParam,
      String before,
      String after,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    RestUtil.validateCursors(before, after);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    // Add Domain Filter
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);

    // List
    ResultList<T> resultList;
    if (before != null) { // Reverse paging
      resultList = repository.listBefore(uriInfo, fields, filter, limitParam, before);
    } else { // Forward paging or first page
      resultList = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, resultList);
  }

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limitParam,
      String before,
      String after,
      List<AuthRequest> authRequests) {
    RestUtil.validateCursors(before, after);
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    // Add Domain Filter
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);

    // List
    ResultList<T> resultList;
    if (before != null) { // Reverse paging
      resultList = repository.listBefore(uriInfo, fields, filter, limitParam, before);
    } else { // Forward paging or first page
      resultList = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, resultList);
  }

  public ResultList<T> listInternalFromSearch(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      List<AuthRequest> authRequests)
      throws IOException {
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);
    return repository.listFromSearchWithOffset(
        uriInfo,
        fields,
        searchListFilter,
        limit,
        offset,
        searchSortFilter,
        q,
        queryString,
        securityContext);
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, null);
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include,
      String includeRelations) {
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    RelationIncludes relationIncludes = new RelationIncludes(include, includeRelations);
    return getInternal(
        uriInfo,
        securityContext,
        id,
        fields,
        relationIncludes,
        operationContext,
        getResourceContextById(id));
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      Fields fields,
      Include include,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    return getInternal(
        uriInfo,
        securityContext,
        id,
        fields,
        RelationIncludes.fromInclude(include),
        operationContext,
        resourceContext);
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      Fields fields,
      RelationIncludes relationIncludes,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return addHref(uriInfo, repository.get(uriInfo, id, fields, relationIncludes, false));
  }

  public T getVersionInternal(SecurityContext securityContext, UUID id, String version) {
    OperationContext operationContext = new OperationContext(entityType, VIEW_BASIC);
    return getVersionInternal(
        securityContext, id, version, operationContext, getResourceContextById(id));
  }

  public T getVersionInternal(
      SecurityContext securityContext,
      UUID id,
      String version,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.getVersion(id, version);
  }

  protected EntityHistory listVersionsInternal(SecurityContext securityContext, UUID id) {
    OperationContext operationContext = new OperationContext(entityType, VIEW_BASIC);
    return listVersionsInternal(securityContext, id, operationContext, getResourceContextById(id));
  }

  protected EntityHistory listVersionsInternal(
      SecurityContext securityContext,
      UUID id,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.listVersions(id);
  }

  protected ResultList<T> listEntityHistoryByTimestampInternal(
      SecurityContext securityContext,
      long startTs,
      long endTs,
      String before,
      String after,
      int limit) {

    ResourceContext resourceContext = getResourceContext();
    OperationContext operationContext = new OperationContext(entityType, VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.listEntityHistoryByTimestamp(startTs, endTs, after, before, limit);
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include, null);
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include,
      String includeRelations) {
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    RelationIncludes relationIncludes = new RelationIncludes(include, includeRelations);
    return getByNameInternal(
        uriInfo,
        securityContext,
        name,
        fields,
        relationIncludes,
        operationContext,
        getResourceContextByName(name));
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Fields fields,
      Include include,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    return getByNameInternal(
        uriInfo,
        securityContext,
        name,
        fields,
        RelationIncludes.fromInclude(include),
        operationContext,
        resourceContext);
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Fields fields,
      RelationIncludes relationIncludes,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return addHref(uriInfo, repository.getByName(uriInfo, name, fields, relationIncludes, false));
  }

  public Response create(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    OperationContext operationContext = new OperationContext(entityType, CREATE);
    CreateResourceContext<T> createResourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    entity =
        addHref(
            uriInfo,
            repository.create(
                uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
    return Response.created(entity.getHref()).entity(entity).build();
  }

  public Response create(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic,
      T entity) {
    OperationContext operationContext = new OperationContext(entityType, CREATE);
    CreateResourceContext<T> createResourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    entity =
        addHref(
            uriInfo,
            repository.create(
                uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
    return Response.created(entity.getHref()).entity(entity).build();
  }

  public Response createOrUpdate(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    repository.prepareInternal(entity, true);
    // If entity does not exist, this is a create operation, else update operation
    ResourceContext<T> resourceContext = getResourceContextByName(entity.getFullyQualifiedName());
    MetadataOperation operation = createOrUpdateOperation(resourceContext);
    OperationContext operationContext = new OperationContext(entityType, operation);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (operation == CREATE) {
      CreateResourceContext<T> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorize(securityContext, operationContext, createResourceContext);
      entity =
          addHref(
              uriInfo,
              repository.create(
                  uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
      return new PutResponse<>(Response.Status.CREATED, entity, ENTITY_CREATED).toResponse();
    }
    resourceContext =
        getResourceContextByName(
            entity.getFullyQualifiedName(), ResourceContextInterface.Operation.PUT);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    PutResponse<T> response =
        repository.createOrUpdate(uriInfo, entity, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response createOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic,
      T entity) {
    repository.prepareInternal(entity, true);
    // If entity does not exist, this is a create operation, else update operation
    ResourceContext<T> resourceContext = getResourceContextByName(entity.getFullyQualifiedName());
    MetadataOperation operation = createOrUpdateOperation(resourceContext);
    OperationContext operationContext = new OperationContext(entityType, operation);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (operation == CREATE) {
      CreateResourceContext<T> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
      entity =
          addHref(
              uriInfo,
              repository.create(
                  uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
      return new PutResponse<>(Response.Status.CREATED, entity, ENTITY_CREATED).toResponse();
    }
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    PutResponse<T> response =
        repository.createOrUpdate(uriInfo, entity, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  /** Deprecated: use method with changeContext
   * Example:
   * ```
   * patchInternal(uriInfo, securityContext, id, patch, changeContext);
   * ```
   * */
  @Deprecated
  public Response patchInternal(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch, null);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource) {
    // Get If-Match header from ThreadLocal set by ETagRequestFilter
    String ifMatchHeader =
        org.openmetadata.service.resources.filters.ETagRequestFilter.getIfMatchHeader();
    return patchInternal(uriInfo, securityContext, id, patch, changeSource, ifMatchHeader);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PATCH));
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    PatchResponse<T> response =
        repository.patch(
            uriInfo,
            id,
            securityContext.getUserPrincipal().getName(),
            patch,
            changeSource,
            ifMatchHeader,
            impersonatedBy);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic,
      UUID id,
      JsonPatch patch) {
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    PatchResponse<T> response =
        repository.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response patchInternal(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch, null);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource) {
    // Get If-Match header from ThreadLocal set by ETagRequestFilter
    String ifMatchHeader =
        org.openmetadata.service.resources.filters.ETagRequestFilter.getIfMatchHeader();
    return patchInternal(uriInfo, securityContext, fqn, patch, changeSource, ifMatchHeader);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextByName(fqn, ResourceContextInterface.Operation.PATCH));
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    PatchResponse<T> response =
        repository.patch(
            uriInfo,
            fqn,
            securityContext.getUserPrincipal().getName(),
            patch,
            changeSource,
            ifMatchHeader,
            impersonatedBy);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response delete(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    DeleteResponse<T> response =
        repository.delete(securityContext.getUserPrincipal().getName(), id, recursive, hardDelete);
    if (hardDelete) {
      limits.invalidateCache(entityType);
    }
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response deleteByIdAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    String jobId = UUID.randomUUID().toString();
    T entity;
    Response response;

    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    entity = repository.get(uriInfo, id, repository.getFields("name"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            DeleteResponse<T> deleteResponse =
                repository.delete(userName, id, recursive, hardDelete);
            if (hardDelete) {
              limits.invalidateCache(entityType);
            }
            WebsocketNotificationHandler.sendDeleteOperationCompleteNotification(
                jobId, securityContext, deleteResponse.entity());
          } catch (Exception e) {
            WebsocketNotificationHandler.sendDeleteOperationFailedNotification(
                jobId,
                securityContext,
                entity,
                e.getMessage() == null ? e.toString() : e.getMessage());
          }
        });

    response =
        Response.accepted()
            .entity(
                new DeleteEntityResponse(
                    jobId,
                    "Delete operation initiated for " + entity.getName(),
                    entity.getName(),
                    hardDelete,
                    recursive))
            .build();

    return response;
  }

  public Response deleteByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      boolean recursive,
      boolean hardDelete) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    DeleteResponse<T> response =
        repository.deleteByName(
            securityContext.getUserPrincipal().getName(), name, recursive, hardDelete);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response restoreEntity(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    PutResponse<T> response =
        repository.restoreEntity(securityContext.getUserPrincipal().getName(), id);
    repository.restoreFromSearch(response.getEntity());
    addHref(uriInfo, response.getEntity());
    LOG.info(
        "Restored {}:{}",
        Entity.getEntityTypeFromObject(response.getEntity()),
        response.getEntity().getId());
    return response.toResponse();
  }

  public Response exportCsvInternalAsync(
      SecurityContext securityContext, String name, boolean recursive) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    String jobId = UUID.randomUUID().toString();
    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            CsvExportProgressCallback progressCallback =
                (exported, total, message) ->
                    WebsocketNotificationHandler.sendCsvExportProgressNotification(
                        jobId, securityContext, exported, total, message);

            String csvData =
                repository.exportToCsv(
                    name,
                    securityContext.getUserPrincipal().getName(),
                    recursive,
                    progressCallback);
            WebsocketNotificationHandler.sendCsvExportCompleteNotification(
                jobId, securityContext, csvData);
          } catch (Exception e) {
            LOG.error("Encountered Exception while exporting.", e);
            WebsocketNotificationHandler.sendCsvExportFailedNotification(
                jobId, securityContext, e.getMessage() == null ? e.toString() : e.getMessage());
          }
        });
    CSVExportResponse response = new CSVExportResponse(jobId, "Export initiated successfully.");
    return Response.accepted().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  public Response bulkAddToAssetsAsync(
      SecurityContext securityContext, UUID entityId, BulkAssetsRequestInterface request) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    String user = subjectContext.user().getName();

    Set<String> editPermissibleResources =
        authorizer.listPermissions(securityContext, user).stream()
            .filter(
                permission ->
                    permission.getPermissions().stream()
                        .anyMatch(
                            perm ->
                                MetadataOperation.EDIT_TAGS.equals(perm.getOperation())
                                    && Permission.Access.ALLOW.equals(perm.getAccess())))
            .map(ResourcePermission::getResource)
            .collect(Collectors.toSet());

    // Validate if all entity types in the request are in the permissible resources
    List<String> unauthorizedEntityTypes =
        request.getAssets().stream()
            .map(EntityReference::getType)
            .filter(entityType -> !editPermissibleResources.contains(entityType))
            .distinct()
            .toList();

    if (!unauthorizedEntityTypes.isEmpty()
        && !subjectContext.isAdmin()
        && !subjectContext.isBot()) {
      throw new AuthorizationException(
          CatalogExceptionMessage.resourcePermissionNotAllowed(
              user, List.of(MetadataOperation.EDIT_TAGS), unauthorizedEntityTypes));
    }

    String jobId = UUID.randomUUID().toString();
    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            BulkOperationResult result =
                repository.bulkAddAndValidateTagsToAssets(entityId, request);
            WebsocketNotificationHandler.bulkAssetsOperationCompleteNotification(
                jobId, securityContext, result);
          } catch (Exception e) {
            WebsocketNotificationHandler.bulkAssetsOperationFailedNotification(
                jobId, securityContext, e.getMessage() == null ? e.toString() : e.getMessage());
          }
        });
    BulkAssetsOperationResponse response =
        new BulkAssetsOperationResponse(
            jobId, "Bulk Add tags to Asset operation initiated successfully.");
    return Response.ok().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  public Response bulkRemoveFromAssetsAsync(
      SecurityContext securityContext, UUID entityId, BulkAssetsRequestInterface request) {
    SubjectContext subjectContext = getSubjectContext(securityContext);
    String user = subjectContext.user().getName();
    Set<String> editPermissibleResources =
        authorizer.listPermissions(securityContext, user).stream()
            .filter(
                permission ->
                    permission.getPermissions().stream()
                        .anyMatch(
                            perm ->
                                MetadataOperation.EDIT_TAGS.equals(perm.getOperation())
                                    && Permission.Access.ALLOW.equals(perm.getAccess())))
            .map(ResourcePermission::getResource)
            .collect(Collectors.toSet());

    List<String> unauthorizedEntityTypes =
        request.getAssets().stream()
            .map(EntityReference::getType)
            .filter(entityType -> !editPermissibleResources.contains(entityType))
            .distinct()
            .toList();

    if (!unauthorizedEntityTypes.isEmpty()
        && !subjectContext.isAdmin()
        && !subjectContext.isBot()) {
      throw new AuthorizationException(
          CatalogExceptionMessage.resourcePermissionNotAllowed(
              user, List.of(MetadataOperation.EDIT_TAGS), unauthorizedEntityTypes));
    }
    String jobId = UUID.randomUUID().toString();
    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            BulkOperationResult result =
                repository.bulkRemoveAndValidateTagsToAssets(entityId, request);
            WebsocketNotificationHandler.bulkAssetsOperationCompleteNotification(
                jobId, securityContext, result);
          } catch (Exception e) {
            WebsocketNotificationHandler.bulkAssetsOperationFailedNotification(
                jobId, securityContext, e.getMessage() == null ? e.toString() : e.getMessage());
          }
        });
    BulkAssetsOperationResponse response =
        new BulkAssetsOperationResponse(
            jobId, "Bulk Remove tags to Asset operation initiated successfully.");
    return Response.ok().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  public Response importCsvInternalAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive) {
    return importCsvInternalAsync(uriInfo, securityContext, name, csv, dryRun, recursive, null);
  }

  public Response importCsvInternalAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive,
      String versioningEntityType) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    String jobId = UUID.randomUUID().toString();
    CSVImportResponse responseEntity = new CSVImportResponse(jobId, "Import is in progress.");
    Response response =
        Response.ok().entity(responseEntity).type(MediaType.APPLICATION_JSON).build();
    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            WebsocketNotificationHandler.sendCsvImportStartedNotification(jobId, securityContext);

            CsvImportProgressCallback progressCallback =
                (rowsProcessed, totalRows, batchNumber, message) ->
                    WebsocketNotificationHandler.sendCsvImportProgressNotification(
                        jobId, securityContext, rowsProcessed, totalRows, message);

            CsvImportResult result =
                importCsvInternal(
                    uriInfo,
                    securityContext,
                    name,
                    csv,
                    dryRun,
                    recursive,
                    versioningEntityType,
                    progressCallback);
            WebsocketNotificationHandler.sendCsvImportCompleteNotification(
                jobId, securityContext, result);
          } catch (Exception e) {
            LOG.error("Encountered Exception while importing.", e);
            WebsocketNotificationHandler.sendCsvImportFailedNotification(
                jobId, securityContext, e.getMessage() == null ? e.toString() : e.getMessage());
          }
        });

    return response;
  }

  public String exportCsvInternal(SecurityContext securityContext, String name, boolean recursive)
      throws IOException {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return repository.exportToCsv(name, securityContext.getUserPrincipal().getName(), recursive);
  }

  protected CsvImportResult importCsvInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive)
      throws IOException {
    return importCsvInternal(uriInfo, securityContext, name, csv, dryRun, recursive, null);
  }

  protected CsvImportResult importCsvInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive,
      String versioningEntityType)
      throws IOException {
    return importCsvInternal(
        uriInfo, securityContext, name, csv, dryRun, recursive, versioningEntityType, null);
  }

  protected CsvImportResult importCsvInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive,
      String versioningEntityType,
      CsvImportProgressCallback progressCallback)
      throws IOException {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    CsvImportResult result =
        nullOrEmpty(versioningEntityType)
            ? repository.importFromCsv(
                name,
                csv,
                dryRun,
                securityContext.getUserPrincipal().getName(),
                recursive,
                progressCallback)
            : repository.importFromCsv(
                name,
                csv,
                dryRun,
                securityContext.getUserPrincipal().getName(),
                recursive,
                versioningEntityType,
                progressCallback);

    // Create version history for bulk import (same logic as async import)
    String effectiveVersioningEntityType =
        nullOrEmpty(versioningEntityType) ? entityType : versioningEntityType;
    if (result.getStatus() != ApiStatus.ABORTED
        && result.getNumberOfRowsProcessed() > 1
        && !dryRun) {
      EntityRepository<EntityInterface> versioningRepo =
          (EntityRepository<EntityInterface>)
              Entity.getEntityRepository(effectiveVersioningEntityType);

      if (versioningRepo.supportsBulkImportVersioning()) {
        processChangeEventForBulkImport(versioningRepo, uriInfo, securityContext, name, result);
      }
    }
    return result;
  }

  protected void processChangeEventForBulkImport(
      EntityRepository<EntityInterface> versioningRepo,
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      CsvImportResult result) {
    versioningRepo.createChangeEventForBulkOperation(
        versioningRepo.getByName(
            uriInfo,
            name,
            new Fields(versioningRepo.getAllowedFields(), ""),
            Include.NON_DELETED,
            false),
        result,
        securityContext.getUserPrincipal().getName());
  }

  protected ResourceContext<T> getResourceContext() {
    return new ResourceContext<>(entityType);
  }

  protected ResourceContext<T> getResourceContextById(UUID id) {
    return new ResourceContext<>(entityType, id, null);
  }

  protected ResourceContext<T> getResourceContextById(
      UUID id, ResourceContextInterface.Operation operation) {
    return new ResourceContext<>(entityType, id, null, operation);
  }

  protected ResourceContext<T> getResourceContextByName(String name) {
    return new ResourceContext<>(entityType, null, name);
  }

  protected ResourceContext<T> getResourceContextByName(
      String name, ResourceContextInterface.Operation operation) {
    return new ResourceContext<>(entityType, null, name, operation);
  }

  protected static final MetadataOperation[] VIEW_ALL_OPERATIONS = {MetadataOperation.VIEW_ALL};
  protected static final MetadataOperation[] VIEW_BASIC_OPERATIONS = {VIEW_BASIC};

  protected MetadataOperation[] getViewOperations(Fields fields) {
    if (fields.getFieldList().isEmpty()) {
      return VIEW_BASIC_OPERATIONS;
    }
    Set<MetadataOperation> viewOperations = new TreeSet<>();
    for (String field : fields.getFieldList()) {
      MetadataOperation operation = fieldsToViewOperations.get(field);
      if (operation == null) {
        return VIEW_ALL_OPERATIONS;
      }
      viewOperations.add(operation);
    }
    return viewOperations.toArray(new MetadataOperation[0]);
  }

  protected EntityReference getEntityReference(String entityType, String fqn) {
    return EntityUtil.getEntityReference(entityType, fqn);
  }

  protected static List<EntityReference> getEntityReferences(String entityType, List<String> fqns) {
    if (nullOrEmpty(fqns)) {
      return null;
    }
    return EntityUtil.getEntityReferences(entityType, fqns);
  }

  protected Response bulkCreateOrUpdateAsync(
      UriInfo uriInfo,
      List<T> entities,
      String userName,
      Map<String, T> existingByFqn,
      List<BulkResponse> authFailedResponses,
      int totalRequests) {
    repository
        .submitAsyncBulkOperation(
            uriInfo, entities, userName, existingByFqn, authFailedResponses, totalRequests)
        .thenAccept(
            result ->
                LOG.info(
                    "Async bulk operation completed for {} {}: {} succeeded, {} failed",
                    entities.size(),
                    entityType,
                    result.getNumberOfRowsPassed(),
                    result.getNumberOfRowsFailed()));

    BulkOperationResult result = new BulkOperationResult();
    result.setNumberOfRowsProcessed(totalRequests);
    result.setNumberOfRowsPassed(0);
    result.setNumberOfRowsFailed(authFailedResponses.size());
    if (!authFailedResponses.isEmpty()) {
      result.setStatus(ApiStatus.PARTIAL_SUCCESS);
      result.setFailedRequest(authFailedResponses);
    } else {
      result.setStatus(ApiStatus.SUCCESS);
    }

    return Response.accepted().entity(result).build();
  }

  protected Response bulkCreateOrUpdateSync(
      UriInfo uriInfo, List<T> entities, String userName, Map<String, T> existingByFqn) {
    BulkOperationResult result =
        repository.bulkCreateOrUpdateEntities(uriInfo, entities, userName, existingByFqn);
    return Response.ok(result).build();
  }

  protected <C extends CreateEntity> Response processBulkRequest(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<C> createRequests,
      EntityMapper<T, C> mapper,
      boolean async) {

    List<T> validEntities = new ArrayList<>();
    List<BulkResponse> failedResponses = new ArrayList<>();

    // Phase 1: Validate and prepare all entities (in-memory, no DB)
    List<T> preparedEntities = new ArrayList<>();
    Map<String, C> entityToRequest = new HashMap<>();
    for (C createRequest : createRequests) {
      try {
        String violations = ValidatorUtil.validate(createRequest);
        if (violations != null) {
          throw new IllegalArgumentException(violations);
        }
        T entity =
            mapper.createToEntity(createRequest, securityContext.getUserPrincipal().getName());
        repository.prepareInternal(entity, false);
        repository.setFullyQualifiedName(entity);
        preparedEntities.add(entity);
        entityToRequest.put(entity.getFullyQualifiedName(), createRequest);
      } catch (Exception e) {
        BulkResponse failedResponse = new BulkResponse();
        failedResponse.setRequest(createRequest);
        failedResponse.setMessage(e.getMessage());
        failedResponse.setStatus(400);
        failedResponses.add(failedResponse);
      }
    }

    // Phase 2: Batch fetch existing entities (1 DB query instead of N)
    Map<String, T> existingByFqn = new HashMap<>();
    if (!preparedEntities.isEmpty()) {
      List<String> allFqns =
          preparedEntities.stream().map(T::getFullyQualifiedName).collect(Collectors.toList());
      List<T> existingEntities = repository.getDao().findEntityByNames(allFqns, Include.ALL);
      for (T existing : existingEntities) {
        existingByFqn.put(existing.getFullyQualifiedName(), existing);
      }
      if (!existingEntities.isEmpty()) {
        repository.enrichEntitiesForAuth(existingEntities);
      }
    }

    // Phase 3: Auth check using batch results
    for (T entity : preparedEntities) {
      try {
        boolean entityExists = existingByFqn.containsKey(entity.getFullyQualifiedName());

        if (!entityExists) {
          OperationContext operationContext = new OperationContext(entityType, CREATE);
          CreateResourceContext<T> createResourceContext =
              new CreateResourceContext<>(entityType, entity);
          limits.enforceLimits(securityContext, createResourceContext, operationContext);
          authorizer.authorize(securityContext, operationContext, createResourceContext);
        } else {
          MetadataOperation operation = MetadataOperation.EDIT_ALL;
          OperationContext operationContext = new OperationContext(entityType, operation);
          T existingEntity = existingByFqn.get(entity.getFullyQualifiedName());
          ResourceContext<T> resourceContext =
              new ResourceContext<>(entityType, existingEntity, repository);
          authorizer.authorize(securityContext, operationContext, resourceContext);
        }

        validEntities.add(entity);
      } catch (AuthorizationException e) {
        BulkResponse failedResponse = new BulkResponse();
        failedResponse.setRequest(entityToRequest.get(entity.getFullyQualifiedName()));
        failedResponse.setMessage("Permission denied: " + e.getMessage());
        failedResponse.setStatus(403);
        failedResponses.add(failedResponse);
      } catch (Exception e) {
        BulkResponse failedResponse = new BulkResponse();
        failedResponse.setRequest(entityToRequest.get(entity.getFullyQualifiedName()));
        failedResponse.setMessage(e.getMessage());
        failedResponse.setStatus(400);
        failedResponses.add(failedResponse);
      }
    }

    if (validEntities.isEmpty()) {
      BulkOperationResult result = new BulkOperationResult();
      result.setStatus(ApiStatus.FAILURE);
      result.setNumberOfRowsProcessed(createRequests.size());
      result.setNumberOfRowsPassed(0);
      result.setNumberOfRowsFailed(createRequests.size());
      result.setFailedRequest(failedResponses);
      return Response.ok(result).build();
    }

    String userName = securityContext.getUserPrincipal().getName();
    Response response;
    if (async) {
      response =
          bulkCreateOrUpdateAsync(
              uriInfo,
              validEntities,
              userName,
              existingByFqn,
              failedResponses,
              createRequests.size());
    } else {
      BulkOperationResult result =
          repository.bulkCreateOrUpdateEntities(uriInfo, validEntities, userName, existingByFqn);

      if (!failedResponses.isEmpty()) {
        result.setStatus(ApiStatus.PARTIAL_SUCCESS);
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + failedResponses.size());
        result.setNumberOfRowsProcessed(createRequests.size());
        if (result.getFailedRequest() == null) {
          result.setFailedRequest(failedResponses);
        } else {
          result.getFailedRequest().addAll(failedResponses);
        }
      }
      response = Response.ok(result).build();
    }

    return response;
  }

  protected void addViewOperation(String fieldsParam, MetadataOperation operation) {
    String[] fields = fieldsParam.replace(" ", "").split(",");
    for (String field : fields) {
      if (allowedFields.contains(field)) {
        fieldsToViewOperations.put(field, operation);
      } else if (!"owners,followers,votes,tags,extension,domains,dataProducts,experts,reviewers"
          .contains(field)) {
        // Some common fields for all the entities might be missing. Ignore it.
        throw new IllegalArgumentException(CatalogExceptionMessage.invalidField(field));
      }
    }
  }

  @GET
  @Path("/history")
  @Operation(
      operationId = "listAllEntityVersionsByTimestamp",
      summary = "List all entity versions within a time range",
      description =
          "Get a paginated list of all entity versions within a given time range "
              + "specified by `startTs` and `endTs` in milliseconds since epoch. ",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of all versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class)))
      })
  public ResultList<T> listEntityHistoryByTimestamp(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Start timestamp in milliseconds since epoch", required = true)
          @QueryParam("startTs")
          long startTs,
      @Parameter(description = "End timestamp in milliseconds since epoch", required = true)
          @QueryParam("endTs")
          long endTs,
      @Parameter(description = "Limit the number of entity returned (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 500, message = "must be less than or equal to 500")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of entity versions before this cursor")
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of entity versions after this cursor")
          @QueryParam("after")
          String after) {
    return listEntityHistoryByTimestampInternal(
        securityContext, startTs, endTs, before, after, limitParam);
  }
}
