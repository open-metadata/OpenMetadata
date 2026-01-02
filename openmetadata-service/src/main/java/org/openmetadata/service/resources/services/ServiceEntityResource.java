/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.resources.services;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.secrets.SecretsUtil;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.services.serviceentities.AbstractServiceEntityService;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * Abstract base class for service entity resources (DatabaseServiceResource, DashboardServiceResource, etc.).
 *
 * <p>This class provides common functionality for service entity REST endpoints and delegates
 * all business logic to the corresponding service class.
 *
 * @param <T> The service entity type implementing ServiceEntityInterface
 * @param <R> The service entity repository type
 * @param <S> The service connection configuration type
 */
public abstract class ServiceEntityResource<
    T extends ServiceEntityInterface,
    R extends ServiceEntityRepository<T, S>,
    S extends ServiceConnectionEntityInterface> {

  @Getter protected final AbstractServiceEntityService<T, R, S> service;
  protected final String entityType;

  protected ServiceEntityResource(
      AbstractServiceEntityService<T, R, S> service, String entityType) {
    this.service = service;
    this.entityType = entityType;
  }

  public final Fields getFields(String fields) {
    return service.getFields(fields);
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

  protected T decryptOrNullify(SecurityContext securityContext, T serviceEntity) {
    return service.decryptOrNullify(securityContext, serviceEntity);
  }

  protected ResultList<T> decryptOrNullify(
      SecurityContext securityContext, ResultList<T> services) {
    listOrEmpty(services.getData()).forEach(s -> decryptOrNullify(securityContext, s));
    return services;
  }

  protected T unmask(T serviceEntity) {
    R repository = service.getRepository();
    repository.setFullyQualifiedName(serviceEntity);
    T originalService =
        repository.findByNameOrNull(serviceEntity.getFullyQualifiedName(), Include.NON_DELETED);
    String connectionType = extractServiceType(serviceEntity);
    try {
      if (originalService != null && originalService.getConnection() != null) {
        Object serviceConnectionConfig =
            EntityMaskerFactory.getEntityMasker()
                .unmaskServiceConnectionConfig(
                    serviceEntity.getConnection().getConfig(),
                    originalService.getConnection().getConfig(),
                    connectionType,
                    service.getServiceType());
        serviceEntity.getConnection().setConfig(serviceConnectionConfig);
      }
      return serviceEntity;
    } catch (Exception e) {
      String message =
          SecretsUtil.buildExceptionMessageConnectionMask(e.getMessage(), connectionType, false);
      if (message != null) {
        throw new InvalidServiceConnectionException(message);
      }
      throw InvalidServiceConnectionException.byMessage(
          connectionType,
          String.format("Failed to unmask connection instance of %s", connectionType));
    }
  }

  protected abstract T nullifyConnection(T service);

  protected abstract String extractServiceType(T service);

  protected void addViewOperation(String fieldsParam, MetadataOperation operation) {
    Map<String, MetadataOperation> fieldsToViewOperations = service.getFieldsToViewOperations();
    String[] fields = fieldsParam.replace(" ", "").split(",");
    for (String field : fields) {
      if (service.getAllowedFields().contains(field)) {
        fieldsToViewOperations.put(field, operation);
      }
    }
  }

  protected ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      Include include,
      String domain,
      int limitParam,
      String before,
      String after) {
    ListFilter filter = new ListFilter(include);
    if (!nullOrEmpty(domain)) {
      EntityReference domainReference =
          Entity.getEntityReferenceByName(Entity.DOMAIN, domain, Include.NON_DELETED);
      filter.addQueryParam("domainId", String.format("'%s'", domainReference.getId()));
    }
    ResultList<T> services =
        service.listInternal(
            uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    return addHref(uriInfo, decryptOrNullify(securityContext, services));
  }

  protected T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include) {
    T entity = service.getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return addHref(uriInfo, entity);
  }

  protected T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include) {
    T entity = service.getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return addHref(uriInfo, entity);
  }

  protected EntityHistory listVersionsInternal(SecurityContext securityContext, UUID id) {
    return service.listVersionsInternal(securityContext, id);
  }

  protected T getVersionInternal(SecurityContext securityContext, UUID id, String version) {
    return service.getVersionInternal(securityContext, id, version);
  }

  protected Response create(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    return service.create(uriInfo, securityContext, entity);
  }

  protected Response createOrUpdate(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    return service.createOrUpdate(uriInfo, securityContext, entity);
  }

  protected Response patchInternal(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch) {
    return service.patchInternal(uriInfo, securityContext, id, patch);
  }

  protected Response patchInternal(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, JsonPatch patch) {
    return service.patchInternal(uriInfo, securityContext, fqn, patch);
  }

  protected Response delete(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    return service.delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  protected Response deleteByIdAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    return service.deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  protected Response deleteByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      boolean recursive,
      boolean hardDelete) {
    return service.deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  protected Response restoreEntity(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    return service.restoreEntity(uriInfo, securityContext, id);
  }

  protected PutResponse<T> addFollower(String updatedBy, UUID entityId, UUID userId) {
    return service.addFollower(updatedBy, entityId, userId);
  }

  protected PutResponse<T> deleteFollower(String updatedBy, UUID entityId, UUID userId) {
    return service.deleteFollower(updatedBy, entityId, userId);
  }

  protected String exportCsvInternal(
      SecurityContext securityContext, String name, boolean recursive) throws IOException {
    return service.exportCsvInternal(securityContext, name, recursive);
  }

  protected Response exportCsvInternalAsync(
      SecurityContext securityContext, String name, boolean recursive) {
    return service.exportCsvInternalAsync(securityContext, name, recursive);
  }

  protected CsvImportResult importCsvInternal(
      SecurityContext securityContext, String name, String csv, boolean dryRun, boolean recursive)
      throws IOException {
    return service.importCsvInternal(securityContext, name, csv, dryRun, recursive);
  }

  protected Response importCsvInternalAsync(
      SecurityContext securityContext, String name, String csv, boolean dryRun, boolean recursive) {
    return service.importCsvInternalAsync(securityContext, name, csv, dryRun, recursive);
  }
}
