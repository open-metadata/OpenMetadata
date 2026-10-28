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

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.Getter;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsUtil;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ServiceConnectionAccess;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.JsonPatchUtils;

public abstract class ServiceEntityResource<
        T extends ServiceEntityInterface,
        R extends ServiceEntityRepository<T, S>,
        S extends ServiceConnectionEntityInterface>
    extends EntityResource<T, R> {

  private static final String CONNECTION_FIELD = "connection";

  @Getter private final ServiceEntityRepository<T, S> serviceEntityRepository;

  private final ServiceType serviceType;

  protected ServiceEntityResource(
      String entityType, Authorizer authorizer, Limits limits, ServiceType serviceType) {
    super(entityType, authorizer, limits);
    this.serviceType = serviceType;
    serviceEntityRepository =
        (ServiceEntityRepository<T, S>) Entity.getServiceEntityRepository(serviceType);
  }

  protected T decryptOrNullify(SecurityContext securityContext, T service) {
    if (service.getConnection() != null) {
      // Bots (ingestion) receive the fully decrypted connection. Callers who can edit the service
      // receive a masked connection so the UI/SDK can still display and edit it. Everyone else
      // receives no connection at all.
      if (!authorizer.shouldMaskPasswords(securityContext)) {
        service.getConnection().setConfig(retrieveServiceConnectionConfig(service, false));
      } else if (ServiceConnectionAccess.canEditConnection(
          authorizer, securityContext, getResourceContextById(service.getId()))) {
        service.getConnection().setConfig(retrieveServiceConnectionConfig(service, true));
      } else {
        return nullifyConnection(service);
      }
    }
    return service;
  }

  private Object retrieveServiceConnectionConfig(T service, boolean maskPassword) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    Object config =
        secretsManager.decryptServiceConnectionConfig(
            service.getConnection().getConfig(), extractServiceType(service), serviceType);
    if (maskPassword) {
      config =
          EntityMaskerFactory.getEntityMasker()
              .maskServiceConnectionConfig(config, extractServiceType(service), serviceType);
    }
    return config;
  }

  protected ResultList<T> decryptOrNullify(
      SecurityContext securityContext, ResultList<T> services) {
    listOrEmpty(services.getData()).forEach(service -> decryptOrNullify(securityContext, service));
    return services;
  }

  // Every response that carries a service follows the read rule, not only GET and list.
  // ADR:2026-10-26-service-connection-visibility-follows-edit-permission

  @Override
  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    authorizeCopyAndMove(securityContext, patch, () -> getResourceContextById(id));
    return decryptOrNullifyResponse(
        securityContext,
        super.patchInternal(uriInfo, securityContext, id, patch, changeSource, ifMatchHeader));
  }

  @Override
  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    authorizeCopyAndMove(securityContext, patch, () -> getResourceContextByName(fqn));
    return decryptOrNullifyResponse(
        securityContext,
        super.patchInternal(uriInfo, securityContext, fqn, patch, changeSource, ifMatchHeader));
  }

  @Override
  protected Response addFollowerInternal(
      SecurityContext securityContext, UUID entityId, UUID userId) {
    return decryptOrNullifyResponse(
        securityContext, super.addFollowerInternal(securityContext, entityId, userId));
  }

  @Override
  protected Response deleteFollowerInternal(
      SecurityContext securityContext, UUID entityId, UUID userId) {
    return decryptOrNullifyResponse(
        securityContext, super.deleteFollowerInternal(securityContext, entityId, userId));
  }

  @Override
  public Response restoreEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, boolean async) {
    return decryptOrNullifyResponse(
        securityContext, super.restoreEntity(uriInfo, securityContext, id, async));
  }

  @Override
  protected ResultList<T> listEntityHistoryByTimestampInternal(
      SecurityContext securityContext,
      long startTs,
      long endTs,
      String before,
      String after,
      int limit) {
    ResultList<T> history =
        super.listEntityHistoryByTimestampInternal(
            securityContext, startTs, endTs, before, after, limit);
    listOrEmpty(history.getData())
        .forEach(version -> decryptOrNullifyVersion(securityContext, version));
    return history;
  }

  /**
   * A stored version can hold a connection that no longer decrypts or masks; it then goes out
   * without the connection rather than as stored.
   */
  private void decryptOrNullifyVersion(SecurityContext securityContext, T version) {
    try {
      decryptOrNullify(securityContext, version);
    } catch (Exception e) {
      nullifyConnection(version);
    }
  }

  /** The same for a version the version-list endpoints read as JSON. */
  protected static String withoutConnection(Object versionJson) {
    ObjectNode version = (ObjectNode) JsonUtils.readTree((String) versionJson);
    version.remove(CONNECTION_FIELD);
    return version.toString();
  }

  /**
   * The service a write response carries: the entity itself, or the one inside the change event a
   * follower update answers with.
   */
  @SuppressWarnings("unchecked")
  private Response decryptOrNullifyResponse(SecurityContext securityContext, Response response) {
    Object body = response.getEntity();
    if (body instanceof ChangeEvent event) {
      body = event.getEntity();
    }
    if (body instanceof ServiceEntityInterface) {
      decryptOrNullify(securityContext, (T) body);
    }
    return response;
  }

  /**
   * A copy or move reads the value at its {@code from} location, which patch authorization does not
   * see: it covers each operation's target path. Reading from another path takes EditAll, as in
   * WorkflowDefinitionResource, so a field-scoped edit cannot copy the stored connection into a
   * field the caller reads back.
   */
  private void authorizeCopyAndMove(
      SecurityContext securityContext,
      JsonPatch patch,
      Supplier<? extends ResourceContextInterface> resourceContext) {
    if (JsonPatchUtils.readsFromAnotherPath(patch)) {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, MetadataOperation.EDIT_ALL),
          resourceContext.get());
    }
  }

  protected T unmask(T service) {
    // TODO move this functionality to repository
    repository.setFullyQualifiedName(service);
    T originalService =
        repository.findByNameOrNull(service.getFullyQualifiedName(), Include.NON_DELETED);
    String connectionType = extractServiceType(service);
    try {
      if (originalService != null && originalService.getConnection() != null) {
        Object serviceConnectionConfig =
            EntityMaskerFactory.getEntityMasker()
                .unmaskServiceConnectionConfig(
                    service.getConnection().getConfig(),
                    originalService.getConnection().getConfig(),
                    connectionType,
                    serviceType);
        service.getConnection().setConfig(serviceConnectionConfig);
      }
      return service;
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
        listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    return addHref(uriInfo, decryptOrNullify(securityContext, services));
  }
}
