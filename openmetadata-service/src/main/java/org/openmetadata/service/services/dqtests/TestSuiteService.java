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

package org.openmetadata.service.services.dqtests;

import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.util.EntityUtil.createOrUpdateOperation;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;

import jakarta.json.JsonPatch;
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
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
@Singleton
@Service(entityType = Entity.TEST_SUITE)
public class TestSuiteService {
  public static final String FIELDS = "owners,reviewers,tests,summary";
  public static final String SEARCH_FIELDS_EXCLUDE = "table,database,databaseSchema,service";

  @Getter private final TestSuiteMapper mapper;
  private final TestSuiteRepository repository;
  private final SearchRepository searchRepository;
  private final Authorizer authorizer;
  private final Limits limits;
  private final String entityType;
  protected final Map<String, MetadataOperation> fieldsToViewOperations = new HashMap<>();
  protected static final MetadataOperation[] VIEW_ALL_OPERATIONS = {MetadataOperation.VIEW_ALL};
  protected static final MetadataOperation[] VIEW_BASIC_OPERATIONS = {VIEW_BASIC};

  @Inject
  public TestSuiteService(
      TestSuiteRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TestSuiteMapper mapper,
      Limits limits) {
    this.repository = repository;
    this.searchRepository = searchRepository;
    this.authorizer = authorizer;
    this.limits = limits;
    this.mapper = mapper;
    this.entityType = Entity.TEST_SUITE;
    addViewOperation(
        "owners,followers,votes,tags,extension,domains,dataProducts,experts,reviewers", VIEW_BASIC);
    addViewOperation("tests", MetadataOperation.VIEW_BASIC);
    Entity.registerResourcePermissions(entityType, getEntitySpecificOperations());
    Entity.registerResourceFieldViewMapping(entityType, fieldsToViewOperations);
  }

  protected List<MetadataOperation> getEntitySpecificOperations() {
    return null;
  }

  public Fields getFields(String fieldsParam) {
    return repository.getFields(fieldsParam);
  }

  public Set<String> getAllowedFields() {
    return repository.getAllowedFields();
  }

  protected void addViewOperation(String fieldsParam, MetadataOperation operation) {
    Set<String> allowedFields = repository.getAllowedFields();
    String[] fields = fieldsParam.replace(" ", "").split(",");
    for (String field : fields) {
      if (allowedFields.contains(field)) {
        fieldsToViewOperations.put(field, operation);
      } else if (!"owners,followers,votes,tags,extension,domains,dataProducts,experts,reviewers"
          .contains(field)) {
        throw new IllegalArgumentException(CatalogExceptionMessage.invalidField(field));
      }
    }
  }

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

  protected TestSuite addHref(UriInfo uriInfo, TestSuite entity) {
    Entity.withHref(uriInfo, entity.getOwners());
    Entity.withHref(uriInfo, entity.getFollowers());
    Entity.withHref(uriInfo, entity.getExperts());
    Entity.withHref(uriInfo, entity.getReviewers());
    Entity.withHref(uriInfo, entity.getChildren());
    Entity.withHref(uriInfo, entity.getDomains());
    Entity.withHref(uriInfo, entity.getDataProducts());
    return entity;
  }

  protected ResultList<TestSuite> addHref(UriInfo uriInfo, ResultList<TestSuite> list) {
    if (list.getData() != null) {
      list.getData().forEach(i -> addHref(uriInfo, i));
    }
    return list;
  }

  public ResultList<TestSuite> listInternal(
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

  public ResultList<TestSuite> listInternal(
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
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);
    ResultList<TestSuite> resultList;
    if (before != null) {
      resultList = repository.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      resultList = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, resultList);
  }

  public ResultList<TestSuite> listFromSearchWithOffset(
      UriInfo uriInfo,
      Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      SecurityContext securityContext)
      throws IOException {
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

  public TestSuite getInternal(
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

  public TestSuite getInternal(
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

  public TestSuite getByNameInternal(
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

  public TestSuite getByNameInternal(
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

  public EntityHistory listVersionsInternal(SecurityContext securityContext, UUID id) {
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

  public TestSuite getVersionInternal(SecurityContext securityContext, UUID id, String version) {
    OperationContext operationContext = new OperationContext(entityType, VIEW_BASIC);
    return getVersionInternal(
        securityContext, id, version, operationContext, getResourceContextById(id));
  }

  public TestSuite getVersionInternal(
      SecurityContext securityContext,
      UUID id,
      String version,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.getVersion(id, version);
  }

  public TestSummary getTestSummary(UUID testSuiteId) {
    return repository.getTestSummary(testSuiteId);
  }

  public DataQualityReport getDataQualityReport(
      String query, String aggregationQuery, String index, SubjectContext subjectContext)
      throws IOException {
    return repository.getDataQualityReport(query, aggregationQuery, index, subjectContext);
  }

  public Response create(UriInfo uriInfo, SecurityContext securityContext, TestSuite entity) {
    OperationContext operationContext = new OperationContext(entityType, CREATE);
    CreateResourceContext<TestSuite> createResourceContext =
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
      TestSuite entity) {
    OperationContext operationContext = new OperationContext(entityType, CREATE);
    CreateResourceContext<TestSuite> createResourceContext =
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

  public Response createOrUpdate(
      UriInfo uriInfo, SecurityContext securityContext, TestSuite entity) {
    repository.prepareInternal(entity, true);
    ResourceContext<TestSuite> resourceContext =
        getResourceContextByName(entity.getFullyQualifiedName());
    MetadataOperation operation = createOrUpdateOperation(resourceContext);
    OperationContext operationContext = new OperationContext(entityType, operation);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (operation == CREATE) {
      CreateResourceContext<TestSuite> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorize(securityContext, operationContext, createResourceContext);
      entity =
          addHref(
              uriInfo,
              repository.create(
                  uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
      return new PutResponse<>(Response.Status.CREATED, entity, EventType.ENTITY_CREATED)
          .toResponse();
    }
    resourceContext =
        getResourceContextByName(
            entity.getFullyQualifiedName(), ResourceContextInterface.Operation.PUT);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    PutResponse<TestSuite> response =
        repository.createOrUpdate(uriInfo, entity, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public Response createOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic,
      TestSuite entity) {
    repository.prepareInternal(entity, true);
    ResourceContext<TestSuite> resourceContext =
        getResourceContextByName(entity.getFullyQualifiedName());
    MetadataOperation operation = createOrUpdateOperation(resourceContext);
    OperationContext operationContext = new OperationContext(entityType, operation);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (operation == CREATE) {
      CreateResourceContext<TestSuite> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
      entity =
          addHref(
              uriInfo,
              repository.create(
                  uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
      return new PutResponse<>(Response.Status.CREATED, entity, EventType.ENTITY_CREATED)
          .toResponse();
    }
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    PutResponse<TestSuite> response =
        repository.createOrUpdate(uriInfo, entity, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

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
    PatchResponse<TestSuite> response =
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
    PatchResponse<TestSuite> response =
        repository.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);
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
    DeleteResponse<TestSuite> response =
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
    TestSuite entity;

    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    entity = repository.get(uriInfo, id, repository.getFields("name"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            DeleteResponse<TestSuite> deleteResponse =
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

    return Response.accepted()
        .entity(
            new DeleteEntityResponse(
                jobId,
                "Delete operation initiated for " + entity.getName(),
                entity.getName(),
                hardDelete,
                recursive))
        .build();
  }

  public Response deleteByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      boolean recursive,
      boolean hardDelete) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    DeleteResponse<TestSuite> response =
        repository.deleteByName(
            securityContext.getUserPrincipal().getName(), name, recursive, hardDelete);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public DeleteResponse<TestSuite> deleteLogicalTestSuite(
      String updatedBy, TestSuite testSuite, boolean hardDelete) {
    return repository.deleteLogicalTestSuite(updatedBy, testSuite, hardDelete);
  }

  public void deleteFromSearch(TestSuite entity, boolean hardDelete) {
    repository.deleteFromSearch(entity, hardDelete);
  }

  public Response deleteLogicalTestSuiteAsync(
      SecurityContext securityContext, TestSuite testSuite, boolean hardDelete) {
    return repository.deleteLogicalTestSuiteAsync(securityContext, testSuite, hardDelete);
  }

  public Response restoreEntity(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    PutResponse<TestSuite> response =
        repository.restoreEntity(securityContext.getUserPrincipal().getName(), id);
    repository.restoreFromSearch(response.getEntity());
    addHref(uriInfo, response.getEntity());
    LOG.info(
        "Restored {}:{}",
        Entity.getEntityTypeFromObject(response.getEntity()),
        response.getEntity().getId());
    return response.toResponse();
  }

  @Transaction
  public final PutResponse<TestSuite> addFollower(String updatedBy, UUID entityId, UUID userId) {
    TestSuite entity = repository.find(entityId, Include.NON_DELETED);

    User user = repository.getDaoCollection().userDAO().findEntityById(userId);
    if (Boolean.TRUE.equals(user.getDeleted())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deletedUser(userId));
    }

    repository.addRelationship(userId, entityId, USER, entityType, Relationship.FOLLOWS);

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entity.getVersion());
    fieldAdded(change, FIELD_FOLLOWERS, List.of(user.getEntityReference()));

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntity(entity)
            .withChangeDescription(change)
            .withIncrementalChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(entityType)
            .withEntityId(entityId)
            .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(entity.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    entity.setIncrementalChangeDescription(change);
    entity.setChangeDescription(change);
    entity.setFollowers(repository.getFollowers(entity));
    repository.postUpdate(entity, entity);
    return new PutResponse<>(Response.Status.OK, changeEvent, EventType.ENTITY_FIELDS_CHANGED);
  }

  @Transaction
  public final PutResponse<TestSuite> deleteFollower(String updatedBy, UUID entityId, UUID userId) {
    TestSuite entity = repository.find(entityId, Include.NON_DELETED);

    EntityReference user = getEntityReferenceById(USER, userId, Include.NON_DELETED);

    repository.deleteRelationship(userId, USER, entityId, entityType, Relationship.FOLLOWS);

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entity.getVersion());
    fieldDeleted(change, FIELD_FOLLOWERS, List.of(user));

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntity(entity)
            .withChangeDescription(change)
            .withIncrementalChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
            .withEntityType(entityType)
            .withEntityId(entityId)
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(entity.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    entity.setChangeDescription(change);
    entity.setIncrementalChangeDescription(change);
    entity.setFollowers(repository.getFollowers(entity));
    repository.postUpdate(entity, entity);
    return new PutResponse<>(Response.Status.OK, changeEvent, EventType.ENTITY_FIELDS_CHANGED);
  }

  public void authorize(
      SecurityContext securityContext,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  public void authorizeRequests(
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic) {
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
  }

  public ResourceContext<TestSuite> getResourceContext() {
    return new ResourceContext<>(entityType);
  }

  public ResourceContext<TestSuite> getResourceContextById(UUID id) {
    return new ResourceContext<>(entityType, id, null);
  }

  public ResourceContext<TestSuite> getResourceContextById(
      UUID id, ResourceContextInterface.Operation operation) {
    return new ResourceContext<>(entityType, id, null, operation);
  }

  public ResourceContext<TestSuite> getResourceContextByName(String name) {
    return new ResourceContext<>(entityType, null, name);
  }

  public ResourceContext<TestSuite> getResourceContextByName(
      String name, ResourceContextInterface.Operation operation) {
    return new ResourceContext<>(entityType, null, name, operation);
  }

  public String getEntityType() {
    return entityType;
  }
}
