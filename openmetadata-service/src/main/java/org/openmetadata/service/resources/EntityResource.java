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

import jakarta.json.JsonPatch;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
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
import org.openmetadata.schema.BulkAssetsRequestInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
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
import org.openmetadata.service.util.EntityETag;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ResultList;
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
        "owners,followers,votes,tags,extension,domain,dataProducts,experts", VIEW_BASIC);
    Entity.registerResourcePermissions(entityType, getEntitySpecificOperations());
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
    Entity.withHref(uriInfo, entity.getDomain());
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
      OperationContext operationContext,
      ResourceContextInterface resourceContext)
      throws IOException {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.listFromSearchWithOffset(
        uriInfo, fields, searchListFilter, limit, offset, searchSortFilter, q, queryString);
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include) {
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    return getInternal(
        uriInfo,
        securityContext,
        id,
        fields,
        include,
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
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return addHref(uriInfo, repository.get(uriInfo, id, fields, include, false));
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

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include) {
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    return getByNameInternal(
        uriInfo,
        securityContext,
        name,
        fields,
        include,
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
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return addHref(uriInfo, repository.getByName(uriInfo, name, fields, include, false));
  }

  public Response create(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    OperationContext operationContext = new OperationContext(entityType, CREATE);
    CreateResourceContext<T> createResourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
    entity = addHref(uriInfo, repository.create(uriInfo, entity));
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
    entity = addHref(uriInfo, repository.create(uriInfo, entity));
    return Response.created(entity.getHref()).entity(entity).build();
  }

  public Response createOrUpdate(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    repository.prepareInternal(entity, true);
    // If entity does not exist, this is a create operation, else update operation
    ResourceContext<T> resourceContext = getResourceContextByName(entity.getFullyQualifiedName());
    MetadataOperation operation = createOrUpdateOperation(resourceContext);
    OperationContext operationContext = new OperationContext(entityType, operation);
    if (operation == CREATE) {
      CreateResourceContext<T> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorize(securityContext, operationContext, createResourceContext);
      entity = addHref(uriInfo, repository.create(uriInfo, entity));
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
    if (operation == CREATE) {
      CreateResourceContext<T> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
      entity = addHref(uriInfo, repository.create(uriInfo, entity));
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
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PATCH));
    PatchResponse<T> response =
        repository.patch(
            uriInfo, id, securityContext.getUserPrincipal().getName(), patch, changeSource);
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
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextByName(fqn, ResourceContextInterface.Operation.PATCH));
    PatchResponse<T> response =
        repository.patch(
            uriInfo, fqn, securityContext.getUserPrincipal().getName(), patch, changeSource);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      ContainerRequestContext requestContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource) {
    validateETag(requestContext, id);
    return patchInternal(uriInfo, securityContext, id, patch, changeSource);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      ContainerRequestContext requestContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource) {
    validateETag(requestContext, fqn);
    return patchInternal(uriInfo, securityContext, fqn, patch, changeSource);
  }

  private void validateETag(ContainerRequestContext requestContext, UUID id) {
    String ifMatch = (String) requestContext.getProperty("X-OpenMetadata-If-Match");
    if (ifMatch != null && !ifMatch.isEmpty()) {
      T entity = repository.find(id, Include.NON_DELETED, false);
      if (!EntityETag.matches(ifMatch, entity)) {
        throw new PreconditionFailedException(entityType, entity.getFullyQualifiedName());
      }
    }
  }

  private void validateETag(ContainerRequestContext requestContext, String fqn) {
    String ifMatch = (String) requestContext.getProperty("X-OpenMetadata-If-Match");
    if (ifMatch != null && !ifMatch.isEmpty()) {
      T entity = repository.findByName(fqn, Include.NON_DELETED, false);
      if (!EntityETag.matches(ifMatch, entity)) {
        throw new PreconditionFailedException(entityType, entity.getFullyQualifiedName());
      }
    }
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
                jobId, securityContext, entity, e.getMessage());
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
        repository.restoreEntity(securityContext.getUserPrincipal().getName(), entityType, id);
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
            String csvData =
                repository.exportToCsv(
                    name, securityContext.getUserPrincipal().getName(), recursive);
            WebsocketNotificationHandler.sendCsvExportCompleteNotification(
                jobId, securityContext, csvData);
          } catch (Exception e) {
            LOG.error("Encountered Exception while exporting.", e);
            WebsocketNotificationHandler.sendCsvExportFailedNotification(
                jobId, securityContext, e.getMessage());
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
                jobId, securityContext, e.getMessage());
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
                jobId, securityContext, e.getMessage());
          }
        });
    BulkAssetsOperationResponse response =
        new BulkAssetsOperationResponse(
            jobId, "Bulk Remove tags to Asset operation initiated successfully.");
    return Response.ok().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  public Response importCsvInternalAsync(
      SecurityContext securityContext, String name, String csv, boolean dryRun, boolean recursive) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    String jobId = UUID.randomUUID().toString();
    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            CsvImportResult result =
                importCsvInternal(securityContext, name, csv, dryRun, recursive);
            WebsocketNotificationHandler.sendCsvImportCompleteNotification(
                jobId, securityContext, result);
          } catch (Exception e) {
            LOG.error("Encountered Exception while importing.", e);
            WebsocketNotificationHandler.sendCsvImportFailedNotification(
                jobId, securityContext, e.getMessage());
          }
        });
    CSVImportResponse response = new CSVImportResponse(jobId, "Import is in progress.");
    return Response.ok().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  public String exportCsvInternal(SecurityContext securityContext, String name, boolean recursive)
      throws IOException {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return repository.exportToCsv(name, securityContext.getUserPrincipal().getName(), recursive);
  }

  protected CsvImportResult importCsvInternal(
      SecurityContext securityContext, String name, String csv, boolean dryRun, boolean recursive)
      throws IOException {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return repository.importFromCsv(
        name, csv, dryRun, securityContext.getUserPrincipal().getName(), recursive);
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

  protected void addViewOperation(String fieldsParam, MetadataOperation operation) {
    String[] fields = fieldsParam.replace(" ", "").split(",");
    for (String field : fields) {
      if (allowedFields.contains(field)) {
        fieldsToViewOperations.put(field, operation);
      } else if (!"owners,followers,votes,tags,extension,domain,dataProducts,experts"
          .contains(field)) {
        // Some common fields for all the entities might be missing. Ignore it.
        throw new IllegalArgumentException(CatalogExceptionMessage.invalidField(field));
      }
    }
  }
}
