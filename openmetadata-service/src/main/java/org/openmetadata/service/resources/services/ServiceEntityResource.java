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
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import lombok.Getter;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission.Access;
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
import org.openmetadata.service.secrets.masker.ConnectionSecretsGuard;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.JsonPatchUtils;

public abstract class ServiceEntityResource<
        T extends ServiceEntityInterface,
        R extends ServiceEntityRepository<T, S>,
        S extends ServiceConnectionEntityInterface>
    extends EntityResource<T, R> {

  @Getter private final ServiceEntityRepository<T, S> serviceEntityRepository;

  private final ServiceType serviceType;
  private final ViewPermissionFilter viewPermissionFilter;

  protected ServiceEntityResource(
      String entityType, Authorizer authorizer, Limits limits, ServiceType serviceType) {
    super(entityType, authorizer, limits);
    this.serviceType = serviceType;
    this.viewPermissionFilter = new ViewPermissionFilter(authorizer);
    serviceEntityRepository =
        (ServiceEntityRepository<T, S>) Entity.getServiceEntityRepository(serviceType);
  }

  protected T decryptOrNullify(SecurityContext securityContext, T service) {
    // Filter first: the connection branch below returns early for a caller who cannot edit the
    // service, and the pipelines list must be filtered on every path.
    filterPipelines(securityContext, service);
    if (service.getConnection() != null) {
      // Bots (ingestion) receive the fully decrypted connection. Callers who can edit the service
      // (EDIT_ALL) receive a masked connection so the UI/SDK can still display and edit it.
      // Everyone else receives no connection at all.
      if (!authorizer.shouldMaskPasswords(securityContext)) {
        service.getConnection().setConfig(retrieveServiceConnectionConfig(service, false));
      } else if (canEditConnection(securityContext, service)) {
        service.getConnection().setConfig(retrieveServiceConnectionConfig(service, true));
      } else {
        return nullifyConnection(service);
      }
    }
    return service;
  }

  /**
   * The {@code pipelines} field is gated only by ViewBasic on the service, so it would list
   * pipelines a deny rule hides. Keep only the ones the caller may view. Admins and bots see all.
   */
  private void filterPipelines(SecurityContext securityContext, T service) {
    List<EntityReference> pipelines = service.getPipelines();
    if (nullOrEmpty(pipelines) || readsStoredSecrets(securityContext)) {
      return;
    }
    Set<UUID> viewable = viewPermissionFilter.viewableIds(securityContext, pipelines);
    service.setPipelines(
        pipelines.stream().filter(p -> viewable.contains(p.getId())).collect(Collectors.toList()));
  }

  private boolean canEditConnection(SecurityContext securityContext, T service) {
    // getPermission does not throw and resolves admins without loading the entity, so this avoids
    // using exceptions for the common view-only path and stays cheap on list pages.
    return authorizer
        .getPermission(securityContext, null, getResourceContextById(service.getId()))
        .getPermissions()
        .stream()
        .anyMatch(
            p -> p.getOperation() == MetadataOperation.EDIT_ALL && p.getAccess() == Access.ALLOW);
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

  @Override
  protected Optional<UnaryOperator<T>> snapshotRedaction(SecurityContext securityContext) {
    return Optional.of(service -> decryptOrNullify(securityContext, service));
  }

  // Every write that answers with the service shows its connection the way a read does.

  @Override
  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    if (mayRetargetConnection(securityContext, patch)) {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, patch),
          getResourceContextById(id, ResourceContextInterface.Operation.PATCH));
      requireSecretsReenteredOnRetarget(repository.find(id, Include.NON_DELETED), patch);
    }
    return withRedactedEntity(
        super.patchInternal(uriInfo, securityContext, id, patch, changeSource, ifMatchHeader),
        service -> decryptOrNullify(securityContext, service));
  }

  @Override
  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    if (mayRetargetConnection(securityContext, patch)) {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, patch),
          getResourceContextByName(fqn, ResourceContextInterface.Operation.PATCH));
      requireSecretsReenteredOnRetarget(repository.findByName(fqn, Include.NON_DELETED), patch);
    }
    return withRedactedEntity(
        super.patchInternal(uriInfo, securityContext, fqn, patch, changeSource, ifMatchHeader),
        service -> decryptOrNullify(securityContext, service));
  }

  /**
   * {@link #unmask(ServiceEntityInterface)} for a write by the caller of {@code securityContext}.
   * A caller who sees the connection's secrets masked keeps them only while the connection points
   * where it did; see {@link ConnectionSecretsGuard}.
   */
  protected T unmask(SecurityContext securityContext, T service) {
    // Only a write that carries a connection can keep a stored secret, so check that first and
    // resolve the caller's subject only then — a connectionless write needs no guard.
    if (service.getConnection() != null && !readsStoredSecrets(securityContext)) {
      repository.setFullyQualifiedName(service);
      requireSecretsReenteredOnRetarget(
          repository.findByNameOrNull(service.getFullyQualifiedName(), Include.NON_DELETED),
          service);
    }
    return unmask(service);
  }

  /** Admins and bots may already read or replace any connection's secrets. */
  private static boolean readsStoredSecrets(SecurityContext securityContext) {
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    return subject.isAdmin() || subject.isBot();
  }

  private static boolean mayRetargetConnection(SecurityContext securityContext, JsonPatch patch) {
    return patchMayChangeConnection(patch) && !readsStoredSecrets(securityContext);
  }

  /**
   * Whether a patch can change the connection: it edits {@code connection}, or it replaces the whole
   * document - also when other operations in the same patch name only other fields.
   */
  static boolean patchMayChangeConnection(JsonPatch patch) {
    return JsonPatchUtils.replacesWholeDocument(patch)
        || JsonUtils.extractPatchedFields(patch).contains("connection");
  }

  private void requireSecretsReenteredOnRetarget(T original, JsonPatch patch) {
    requireSecretsReenteredOnRetarget(original, JsonUtils.applyPatch(original, patch, entityClass));
  }

  private void requireSecretsReenteredOnRetarget(T original, T updated) {
    if (original != null && original.getConnection() != null && updated.getConnection() != null) {
      ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
          updated.getConnection().getConfig(),
          original.getConnection().getConfig(),
          extractServiceType(updated),
          serviceType);
    }
  }

  @Override
  public Response delete(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    return withRedactedEntity(
        super.delete(uriInfo, securityContext, id, recursive, hardDelete),
        service -> decryptOrNullify(securityContext, service));
  }

  @Override
  public Response deleteByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      boolean recursive,
      boolean hardDelete) {
    return withRedactedEntity(
        super.deleteByName(uriInfo, securityContext, name, recursive, hardDelete),
        service -> decryptOrNullify(securityContext, service));
  }

  @Override
  public Response restoreEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, boolean async) {
    return withRedactedEntity(
        super.restoreEntity(uriInfo, securityContext, id, async),
        service -> decryptOrNullify(securityContext, service));
  }

  @Override
  protected Response addFollowerInternal(
      SecurityContext securityContext, UUID entityId, UUID userId) {
    return withRedactedEntity(
        super.addFollowerInternal(securityContext, entityId, userId),
        service -> decryptOrNullify(securityContext, service));
  }

  @Override
  protected Response deleteFollowerInternal(
      SecurityContext securityContext, UUID entityId, UUID userId) {
    return withRedactedEntity(
        super.deleteFollowerInternal(securityContext, entityId, userId),
        service -> decryptOrNullify(securityContext, service));
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
