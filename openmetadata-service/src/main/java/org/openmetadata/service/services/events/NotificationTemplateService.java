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

package org.openmetadata.service.services.events;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateRenderResponse;
import org.openmetadata.schema.api.events.NotificationTemplateSendRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.events.NotificationTemplateMapper;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.NOTIFICATION_TEMPLATE)
public class NotificationTemplateService
    extends EntityBaseService<NotificationTemplate, NotificationTemplateRepository> {

  public static final String FIELDS = "";

  @Getter private final NotificationTemplateMapper mapper;

  @Inject
  public NotificationTemplateService(
      NotificationTemplateRepository repository,
      Authorizer authorizer,
      NotificationTemplateMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.NOTIFICATION_TEMPLATE, NotificationTemplate.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("templateBody", MetadataOperation.VIEW_BASIC);
    return List.of(MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    super.initialize(config);
    repository.initOrUpdateSeedDataFromResources();
    LOG.info("Notification template seed data initialized with versioning support");
  }

  public NotificationTemplateValidationResponse validate(
      NotificationTemplateValidationRequest request) {
    return repository.validate(request);
  }

  public NotificationTemplateRenderResponse render(NotificationTemplateRenderRequest request) {
    return repository.render(request);
  }

  public NotificationTemplateValidationResponse send(NotificationTemplateSendRequest request) {
    return repository.send(request);
  }

  public List<HandlebarsHelperMetadata> getHelperMetadata() {
    return repository.getHelperMetadata();
  }

  public void resetToDefault(NotificationTemplate template) {
    repository.resetToDefault(template);
  }

  public Response restoreTemplateEntity(
      SecurityContext securityContext, NotificationTemplate existing) {
    List<AuthRequest> authRequests;
    AuthorizationLogic authorizationLogic;
    ResourceContext<NotificationTemplate> ctx = getResourceContextById(existing.getId());

    if (ProviderType.SYSTEM.equals(existing.getProvider())) {
      authorizationLogic = AuthorizationLogic.ALL;
      authRequests =
          List.of(
              new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx));
    } else {
      authorizationLogic = AuthorizationLogic.ANY;
      authRequests =
          List.of(
              new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx),
              new AuthRequest(
                  new OperationContext(
                      entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
                  ctx));
    }

    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);

    RestUtil.PutResponse<NotificationTemplate> put =
        repository.restoreEntity(securityContext.getUserPrincipal().getName(), existing.getId());
    repository.restoreFromSearch(put.getEntity());
    LOG.info(
        "Restored {}:{}", Entity.getEntityTypeFromObject(put.getEntity()), put.getEntity().getId());
    return put.toResponse();
  }

  public void authorizePreviewCapability(SecurityContext securityContext) {
    List<AuthRequest> anyOf =
        List.of(
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.CREATE), getResourceContext()),
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_ALL), getResourceContext()),
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
                getResourceContext()));
    authorizer.authorizeRequests(securityContext, anyOf, AuthorizationLogic.ANY);
  }

  public void authorizeHelperAccess(SecurityContext securityContext) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        getResourceContext());
  }

  public Response resetToDefaultById(SecurityContext securityContext, UUID id) {
    NotificationTemplate template = repository.get(null, id, repository.getFields("*"));
    if (!ProviderType.SYSTEM.equals(template.getProvider())) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Cannot reset template: only SYSTEM templates can be reset to default")
          .build();
    }
    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_ALL),
                getResourceContextById(id)));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ALL);
    repository.resetToDefault(template);
    return Response.ok().build();
  }

  public Response resetToDefaultByFQN(SecurityContext securityContext, String fqn) {
    NotificationTemplate template = repository.getByName(null, fqn, repository.getFields("*"));
    if (!ProviderType.SYSTEM.equals(template.getProvider())) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Cannot reset template: only SYSTEM templates can be reset to default")
          .build();
    }
    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_ALL),
                getResourceContextByName(fqn)));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ALL);
    repository.resetToDefault(template);
    return Response.ok().build();
  }

  public NotificationTemplate getExisting(String name) {
    return repository.findByNameOrNull(name, Include.ALL);
  }

  public NotificationTemplate getExistingById(UUID id) {
    return repository.get(null, id, repository.getFields("*"));
  }

  public NotificationTemplate getExistingByName(String fqn) {
    return repository.getByName(null, fqn, repository.getFields("*"));
  }

  @Override
  public ResourceContext<NotificationTemplate> getResourceContextById(UUID id) {
    return super.getResourceContextById(id);
  }

  @Override
  public ResourceContext<NotificationTemplate> getResourceContextByName(String name) {
    return super.getResourceContextByName(name);
  }

  public static class NotificationTemplateList extends ResultList<NotificationTemplate> {
    /* Required for serde */
  }
}
