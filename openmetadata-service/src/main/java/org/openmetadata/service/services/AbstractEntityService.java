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

package org.openmetadata.service.services;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * Abstract base class for entity services providing common CRUD operations.
 *
 * <p>This class implements all standard entity operations with proper authorization, validation,
 * and repository delegation. Concrete service classes should extend this and only override methods
 * when custom business logic is required.
 *
 * <p>Standard flow for all operations: 1. Authorization check 2. Validation (if applicable) 3.
 * Delegate to repository 4. Return result
 *
 * <p>Subclasses can override any method to customize behavior, or simply inherit all
 * implementations.
 *
 * @param <T> The entity type implementing EntityInterface
 */
@Slf4j
public abstract class AbstractEntityService<T extends EntityInterface> implements EntityService<T> {

  protected final EntityRepository<T> repository;
  protected final SearchRepository searchRepository;
  protected final Authorizer authorizer;
  protected final String entityType;

  /**
   * Constructor for AbstractEntityService.
   *
   * @param repository Entity repository for data access
   * @param searchRepository Search repository for search operations
   * @param authorizer Authorizer for access control
   * @param entityType Entity type string (e.g., Entity.TABLE)
   */
  protected AbstractEntityService(
      EntityRepository<T> repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      String entityType) {
    this.repository = repository;
    this.searchRepository = searchRepository;
    this.authorizer = authorizer;
    this.entityType = entityType;
  }

  @Override
  public ResultList<T> listEntities(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limitParam,
      String before,
      String after) {
    // Validate cursors
    RestUtil.validateCursors(before, after);

    // Create operation context for authorization
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    ResourceContext resourceContext = filter.getResourceContext(entityType);

    // Authorize
    authorizer.authorize(securityContext, operationContext, resourceContext);

    // Add domain filter
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);

    // Retrieve from repository with pagination
    ResultList<T> resultList;
    if (before != null) {
      resultList = repository.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      resultList = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }

    return resultList;
  }

  @Override
  public ResultList<T> listEntitiesFromSearch(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException {
    // Authorization would be handled here if needed
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

  @Override
  public T getEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, Fields fields, Include include) {
    // Create operation context for authorization
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);

    // Authorize
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    // Retrieve from repository
    return repository.get(uriInfo, id, fields, include, false);
  }

  @Override
  public T getEntityByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Fields fields,
      Include include) {
    // Create operation context for authorization
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);

    // Authorize
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));

    // Retrieve from repository
    return repository.getByName(uriInfo, name, fields, include, false);
  }

  @Override
  public T getEntityVersion(SecurityContext securityContext, UUID id, String version) {
    // Create operation context for authorization
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);

    // Authorize
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    // Retrieve version from repository
    return repository.getVersion(id, version);
  }

  @Override
  public EntityHistory listEntityVersions(SecurityContext securityContext, UUID id) {
    // Create operation context for authorization
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);

    // Authorize
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    // List versions from repository
    return repository.listVersions(id);
  }

  @Override
  public T createEntity(UriInfo uriInfo, SecurityContext securityContext, T entity)
      throws IOException {
    // Create operation context for authorization
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    CreateResourceContext<T> createResourceContext =
        new CreateResourceContext<>(entityType, entity);

    // Authorize
    authorizer.authorize(securityContext, operationContext, createResourceContext);

    // Create in repository
    return repository.create(uriInfo, entity);
  }

  @Override
  public PutResponse<T> updateEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, T updatedEntity)
      throws IOException {
    // Delegate to repository for update logic
    String userName = securityContext.getUserPrincipal().getName();
    return repository.createOrUpdate(uriInfo, updatedEntity, userName);
  }

  @Override
  public T patchEntity(UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch)
      throws IOException {
    // Delegate to repository for patch logic
    String userName = securityContext.getUserPrincipal().getName();
    RestUtil.PatchResponse<T> response = repository.patch(uriInfo, id, userName, patch);
    return response.entity();
  }

  @Override
  public void deleteEntity(
      SecurityContext securityContext, UUID id, boolean recursive, boolean hardDelete)
      throws IOException {
    // Delegate to repository for delete logic
    repository.delete(securityContext.getUserPrincipal().getName(), id, recursive, hardDelete);
  }

  @Override
  public void deleteEntityByName(
      SecurityContext securityContext, String name, boolean recursive, boolean hardDelete)
      throws IOException {
    // Delegate to repository for delete logic
    repository.deleteByName(
        securityContext.getUserPrincipal().getName(), name, recursive, hardDelete);
  }

  @Override
  public T restoreEntity(SecurityContext securityContext, UUID id) throws IOException {
    // Delegate to repository for restore logic
    PutResponse<T> response =
        repository.restoreEntity(securityContext.getUserPrincipal().getName(), id);
    return response.getEntity();
  }

  @Override
  public void validateCreateRequest(CreateEntity request, T entity) {
    // Default implementation - subclasses can override for custom validation
  }

  @Override
  public void validateUpdateRequest(CreateEntity request, T existing, T entity) {
    // Default implementation - subclasses can override for custom validation
  }

  @Override
  public String getEntityType() {
    return entityType;
  }

  @Override
  public Set<String> getAllowedFields() {
    return repository.getAllowedFields();
  }

  @Override
  public Fields getFields(String fieldsParam) {
    return repository.getFields(fieldsParam);
  }

  /**
   * Get resource context by entity ID.
   *
   * <p>Subclasses can override to provide custom resource context construction.
   *
   * @param id Entity ID
   * @return Resource context for authorization
   */
  protected ResourceContext getResourceContextById(UUID id) {
    return new ResourceContext(entityType, id, null);
  }

  /**
   * Get resource context by entity name.
   *
   * <p>Subclasses can override to provide custom resource context construction.
   *
   * @param name Entity name
   * @return Resource context for authorization
   */
  protected ResourceContext getResourceContextByName(String name) {
    return new ResourceContext(entityType, null, name);
  }
}
