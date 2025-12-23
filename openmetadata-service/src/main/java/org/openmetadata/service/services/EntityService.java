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
import java.util.UUID;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * Service layer interface for entity operations.
 *
 * <p>This interface defines the contract for all entity services, separating business logic from
 * REST resource handlers and data access layers. Services handle:
 *
 * <ul>
 *   <li>Business logic and validation
 *   <li>Authorization checks
 *   <li>Coordination between repository and search layers
 *   <li>Transaction management
 * </ul>
 *
 * <p>Resources should delegate to services for all business operations, keeping resource classes
 * focused on HTTP concerns only.
 *
 * @param <T> The entity type implementing EntityInterface
 */
public interface EntityService<T extends EntityInterface> {

  /**
   * List entities with pagination support.
   *
   * @param uriInfo URI information for HATEOAS links
   * @param securityContext Security context for authorization
   * @param fields Fields to include in the response
   * @param filter Filter criteria for the list query
   * @param limitParam Maximum number of results
   * @param before Cursor for backward pagination
   * @param after Cursor for forward pagination
   * @return Paginated list of entities
   */
  ResultList<T> listEntities(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limitParam,
      String before,
      String after);

  /**
   * List entities from search index with pagination and sorting.
   *
   * @param uriInfo URI information for HATEOAS links
   * @param securityContext Security context for authorization
   * @param fields Fields to include in the response
   * @param searchListFilter Search-specific filters
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   * @param searchSortFilter Sort criteria
   * @param q Simple query string
   * @param queryString Advanced query string
   * @return Paginated list of entities from search
   * @throws IOException if search operation fails
   */
  ResultList<T> listEntitiesFromSearch(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException;

  /**
   * Get entity by ID.
   *
   * @param uriInfo URI information for HATEOAS links
   * @param securityContext Security context for authorization
   * @param id Entity ID
   * @param fields Fields to include in the response
   * @param include Include deleted entities or not
   * @return The entity
   */
  T getEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, Fields fields, Include include);

  /**
   * Get entity by fully qualified name.
   *
   * @param uriInfo URI information for HATEOAS links
   * @param securityContext Security context for authorization
   * @param name Fully qualified name
   * @param fields Fields to include in the response
   * @param include Include deleted entities or not
   * @return The entity
   */
  T getEntityByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Fields fields,
      Include include);

  /**
   * Get specific version of an entity.
   *
   * @param securityContext Security context for authorization
   * @param id Entity ID
   * @param version Version number
   * @return The entity version
   */
  T getEntityVersion(SecurityContext securityContext, UUID id, String version);

  /**
   * List all versions of an entity.
   *
   * @param securityContext Security context for authorization
   * @param id Entity ID
   * @return Entity version history
   */
  EntityHistory listEntityVersions(SecurityContext securityContext, UUID id);

  /**
   * Create a new entity.
   *
   * @param uriInfo URI information for HATEOAS links
   * @param securityContext Security context for authorization
   * @param entity The entity to create
   * @return The created entity
   * @throws IOException if creation fails
   */
  T createEntity(UriInfo uriInfo, SecurityContext securityContext, T entity) throws IOException;

  /**
   * Update an existing entity (PUT operation).
   *
   * @param uriInfo URI information for HATEOAS links
   * @param securityContext Security context for authorization
   * @param id Entity ID
   * @param updatedEntity The updated entity data
   * @return Response containing the updated entity and operation status
   * @throws IOException if update fails
   */
  PutResponse<T> updateEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, T updatedEntity)
      throws IOException;

  /**
   * Patch an entity (PATCH operation).
   *
   * @param uriInfo URI information for HATEOAS links
   * @param securityContext Security context for authorization
   * @param id Entity ID
   * @param patch JSON patch document
   * @return The patched entity
   * @throws IOException if patch fails
   */
  T patchEntity(UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch)
      throws IOException;

  /**
   * Delete an entity.
   *
   * @param securityContext Security context for authorization
   * @param id Entity ID
   * @param recursive Whether to delete recursively
   * @param hardDelete Whether to hard delete or soft delete
   * @throws IOException if deletion fails
   */
  void deleteEntity(SecurityContext securityContext, UUID id, boolean recursive, boolean hardDelete)
      throws IOException;

  /**
   * Delete an entity by name.
   *
   * @param securityContext Security context for authorization
   * @param name Fully qualified name
   * @param recursive Whether to delete recursively
   * @param hardDelete Whether to hard delete or soft delete
   * @throws IOException if deletion fails
   */
  void deleteEntityByName(
      SecurityContext securityContext, String name, boolean recursive, boolean hardDelete)
      throws IOException;

  /**
   * Restore a soft-deleted entity.
   *
   * @param securityContext Security context for authorization
   * @param id Entity ID
   * @return The restored entity
   * @throws IOException if restore fails
   */
  T restoreEntity(SecurityContext securityContext, UUID id) throws IOException;

  /**
   * Validate create request before entity creation.
   *
   * @param request The create request
   * @param entity The entity to be created
   */
  void validateCreateRequest(CreateEntity request, T entity);

  /**
   * Validate update request before entity update.
   *
   * @param request The update request
   * @param existing The existing entity
   * @param entity The updated entity
   */
  void validateUpdateRequest(CreateEntity request, T existing, T entity);

  /**
   * Get the entity type string.
   *
   * @return Entity type
   */
  String getEntityType();

  /**
   * Get allowed fields for this entity type.
   *
   * @return Set of allowed field names
   */
  java.util.Set<String> getAllowedFields();

  /**
   * Parse fields parameter string to Fields object.
   *
   * @param fieldsParam Comma-separated field names
   * @return Fields object
   */
  Fields getFields(String fieldsParam);
}
