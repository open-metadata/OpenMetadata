/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.jdbi3;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateRenderResponse;
import org.openmetadata.schema.api.events.NotificationTemplateSendRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.api.events.TemplateRenderResult;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.HandlebarsNotificationMessageEngine;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.email.EmailMessage;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.testing.EntityFixtureLoader;
import org.openmetadata.service.notifications.template.testing.MockChangeEventFactory;
import org.openmetadata.service.notifications.template.testing.MockChangeEventRegistry;
import org.openmetadata.service.resources.events.NotificationTemplateResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.SubscriptionUtil;
import org.openmetadata.service.util.email.EmailUtil;
import org.openmetadata.service.util.resourcepath.ResourcePathResolver;
import org.openmetadata.service.util.resourcepath.providers.NotificationTemplateResourcePathProvider;

@Slf4j
public class NotificationTemplateRepository extends EntityRepository<NotificationTemplate> {

  static final String PATCH_FIELDS = "templateBody,templateSubject";
  static final String UPDATE_FIELDS = "templateBody,templateSubject";

  private final NotificationTemplateProcessor templateProcessor;
  private final MockChangeEventFactory mockChangeEventFactory;
  private final HandlebarsNotificationMessageEngine messageEngine;

  public NotificationTemplateRepository() {
    super(
        NotificationTemplateResource.COLLECTION_PATH,
        Entity.NOTIFICATION_TEMPLATE,
        NotificationTemplate.class,
        Entity.getCollectionDAO().notificationTemplateDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);

    // Initialize template processor
    this.templateProcessor = new HandlebarsNotificationTemplateProcessor();

    // Initialize mock factory for template testing
    EntityFixtureLoader fixtureLoader = new EntityFixtureLoader();
    MockChangeEventRegistry mockRegistry = new MockChangeEventRegistry(fixtureLoader);
    this.mockChangeEventFactory = new MockChangeEventFactory(mockRegistry);

    // Initialize message engine for template rendering
    this.messageEngine = new HandlebarsNotificationMessageEngine(this);
  }

  @Override
  public void setFields(
      NotificationTemplate entity, Fields fields, RelationIncludes relationIncludes) {}

  @Override
  public void clearFields(NotificationTemplate entity, Fields fields) {}

  @Override
  public void prepare(NotificationTemplate entity, boolean update) {
    NotificationTemplateValidationRequest request = new NotificationTemplateValidationRequest();
    request.setTemplateBody(entity.getTemplateBody());
    request.setTemplateSubject(entity.getTemplateSubject());

    NotificationTemplateValidationResponse response = templateProcessor.validate(request);

    if (!response.getIsValid()) {
      List<String> errors = new ArrayList<>();
      if (response.getSubjectError() != null) {
        errors.add("Template subject: " + response.getSubjectError());
      }
      if (response.getBodyError() != null) {
        errors.add("Template body: " + response.getBodyError());
      }
      throw new IllegalArgumentException("Invalid template: " + String.join("; ", errors));
    }
  }

  @Override
  public void storeEntity(NotificationTemplate entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(NotificationTemplate entity) {}

  @Override
  protected void preDelete(NotificationTemplate template, String deletedBy) {
    if (ProviderType.SYSTEM.equals(template.getProvider())) {
      throw new IllegalArgumentException(
          String.format(
              "Cannot delete SYSTEM template '%s'. System templates are protected and cannot be deleted.",
              template.getName()));
    }

    // Nullify stale references in EventSubscription JSON blobs before deletion
    // This ensures ListFilter queries on JSON don't return stale data
    List<EntityReference> subscriptions =
        findFrom(
            template.getId(),
            Entity.NOTIFICATION_TEMPLATE,
            Relationship.USES,
            Entity.EVENT_SUBSCRIPTION);

    EventSubscriptionRepository subscriptionRepository =
        (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);

    for (EntityReference subRef : subscriptions) {
      try {
        EventSubscription original =
            Entity.getEntity(Entity.EVENT_SUBSCRIPTION, subRef.getId(), "*", Include.ALL);

        EventSubscription updated = JsonUtils.deepCopy(original, EventSubscription.class);
        updated.setNotificationTemplate(null);

        EntityRepository<EventSubscription>.EntityUpdater updater =
            subscriptionRepository.getUpdater(original, updated, Operation.PUT, null);
        updater.update();

        LOG.debug(
            "Nullified template reference in subscription {} before deleting template {}",
            original.getId(),
            template.getId());
      } catch (Exception e) {
        LOG.warn(
            "Failed to nullify template reference in subscription {}: {}",
            subRef.getId(),
            e.getMessage());
      }
    }

    super.preDelete(template, deletedBy);
  }

  @Override
  public EntityRepository<NotificationTemplate>.EntityUpdater getUpdater(
      NotificationTemplate original,
      NotificationTemplate updated,
      Operation operation,
      ChangeSource changeSource) {
    return new NotificationTemplateUpdater(original, updated, operation);
  }

  @Override
  public List<NotificationTemplate> getEntitiesFromSeedData() throws IOException {
    // Use ResourcePathResolver to get the path, enabling commercial versions to override
    String seedPath =
        ResourcePathResolver.getResourcePath(NotificationTemplateResourcePathProvider.class);
    return getEntitiesFromSeedData(seedPath);
  }

  public void initOrUpdateSeedDataFromResources() throws IOException {
    List<NotificationTemplate> seedTemplates = getEntitiesFromSeedData();

    for (NotificationTemplate seedTemplate : seedTemplates) {
      String fqn = seedTemplate.getFullyQualifiedName();
      NotificationTemplate existing = findByNameOrNull(fqn, Include.ALL);

      if (existing == null) {
        createSystemTemplateFromSeed(seedTemplate, fqn);
      } else if (shouldUpdateSystemTemplate(existing, seedTemplate)) {
        updateSystemTemplateFromSeed(existing, seedTemplate, fqn);
      } else {
        LOG.debug("Skipping template {} - user template or modified system template", fqn);
      }
    }
  }

  private void createSystemTemplateFromSeed(NotificationTemplate seedTemplate, String fqn)
      throws IOException {
    seedTemplate.withIsModifiedFromDefault(false);
    try {
      initializeEntity(seedTemplate);
    } catch (IllegalArgumentException e) {
      throw new IOException(
          String.format("Failed to validate seed template '%s': %s", fqn, e.getMessage()), e);
    }
  }

  private boolean shouldUpdateSystemTemplate(
      NotificationTemplate existing, NotificationTemplate seedTemplate) {
    // Update only if system template has not been update and seed content differs from current
    // content
    return ProviderType.SYSTEM.equals(existing.getProvider())
        && Boolean.FALSE.equals(existing.getIsModifiedFromDefault())
        && !Objects.equals(
            calculateTemplateChecksum(seedTemplate), calculateTemplateChecksum(existing));
  }

  private void updateSystemTemplateFromSeed(
      NotificationTemplate existing, NotificationTemplate seedTemplate, String fqn)
      throws IOException {
    existing
        .withTemplateBody(seedTemplate.getTemplateBody())
        .withTemplateSubject(seedTemplate.getTemplateSubject());
    try {
      prepare(existing, true);
      store(existing, true);
    } catch (IllegalArgumentException e) {
      throw new IOException(
          String.format("Failed to validate seed template '%s': %s", fqn, e.getMessage()), e);
    }
  }

  public void resetToDefault(NotificationTemplate original) {
    try {
      if (!ProviderType.SYSTEM.equals(original.getProvider())) {
        return;
      }

      NotificationTemplate defaultTemplate = getDefaultTemplateFromSeed(original.getName());
      NotificationTemplate updated = JsonUtils.deepCopy(original, NotificationTemplate.class);
      updated
          .withTemplateBody(defaultTemplate.getTemplateBody())
          .withTemplateSubject(defaultTemplate.getTemplateSubject())
          .withDescription(defaultTemplate.getDescription())
          .withDisplayName(defaultTemplate.getDisplayName());

      EntityUpdater entityUpdater = getUpdater(original, updated, Operation.PUT, null);
      entityUpdater.update();

      LOG.info("Reset NotificationTemplate {} to default", original.getName());
    } catch (IllegalArgumentException e) {
      LOG.error("Failed to reset template: {}", e.getMessage(), e);
      throw e;
    } catch (IOException e) {
      LOG.error("Failed to load seed data for reset operation", e);
      throw new RuntimeException("Failed to reset template due to seed data loading error", e);
    }
  }

  /**
   * Validates a template without saving it.
   * Called by the REST endpoint for validation.
   *
   * @param request The validation request
   * @return The validation response
   */
  public NotificationTemplateValidationResponse validate(
      NotificationTemplateValidationRequest request) {
    return templateProcessor.validate(request);
  }

  /**
   * Renders a template with mock data using HandlebarsNotificationMessageEngine.
   * Called by the REST endpoint for rendering preview.
   *
   * @param request The render request with template and resource info
   * @return The render response with validation and rendering results
   */
  public NotificationTemplateRenderResponse render(NotificationTemplateRenderRequest request) {
    NotificationTemplateValidationResponse validationResponse =
        templateProcessor.validate(
            new NotificationTemplateValidationRequest()
                .withTemplateBody(request.getTemplateBody())
                .withTemplateSubject(request.getTemplateSubject()));

    if (!validationResponse.getIsValid()) {
      return new NotificationTemplateRenderResponse()
          .withValidation(validationResponse)
          .withRender(null);
    }

    ChangeEvent mockEvent =
        mockChangeEventFactory.create(request.getResource(), request.getEventType());

    NotificationTemplate testTemplate =
        new NotificationTemplate()
            .withId(UUID.randomUUID())
            .withName("test-template")
            .withTemplateSubject(request.getTemplateSubject())
            .withTemplateBody(request.getTemplateBody());

    EventSubscription testSubscription =
        new EventSubscription()
            .withId(UUID.randomUUID())
            .withName("test-subscription")
            .withDisplayName("Test Notification");

    SubscriptionDestination emailDestination =
        new SubscriptionDestination().withType(SubscriptionDestination.SubscriptionType.EMAIL);

    TemplateRenderResult renderResult =
        renderWithMessageEngine(mockEvent, testSubscription, emailDestination, testTemplate);

    return new NotificationTemplateRenderResponse()
        .withValidation(validationResponse)
        .withRender(renderResult);
  }

  private TemplateRenderResult renderWithMessageEngine(
      ChangeEvent event,
      EventSubscription subscription,
      SubscriptionDestination destination,
      NotificationTemplate template) {
    try {
      EmailMessage emailMessage =
          (EmailMessage)
              messageEngine.generateMessageWithTemplate(event, subscription, destination, template);

      return new TemplateRenderResult()
          .withSubject(emailMessage.getSubject())
          .withBody(emailMessage.getHtmlContent());

    } catch (Exception e) {
      String errorMessage = "Failed to render template: " + e.getMessage();
      LOG.error(errorMessage, e);
      return new TemplateRenderResult().withSubject("").withBody("");
    }
  }

  /**
   * Validates and sends a template to specified destinations.
   * Called by the REST endpoint for send testing.
   *
   * @param request The send request with template, resource, eventType, and destinations
   * @return The validation response (delivery errors logged server-side only)
   */
  public NotificationTemplateValidationResponse send(NotificationTemplateSendRequest request) {
    NotificationTemplateRenderRequest renderRequest = request.getRenderRequest();

    NotificationTemplateValidationRequest validationRequest =
        new NotificationTemplateValidationRequest()
            .withTemplateBody(renderRequest.getTemplateBody())
            .withTemplateSubject(renderRequest.getTemplateSubject());

    NotificationTemplateValidationResponse validation =
        templateProcessor.validate(validationRequest);

    if (!validation.getIsValid()) {
      return validation;
    }

    validateExternalDestinations(request.getDestinations());

    ChangeEvent mockEvent =
        mockChangeEventFactory.create(renderRequest.getResource(), renderRequest.getEventType());

    NotificationTemplate testTemplate =
        new NotificationTemplate()
            .withId(UUID.randomUUID())
            .withName("test-template")
            .withTemplateSubject(renderRequest.getTemplateSubject())
            .withTemplateBody(renderRequest.getTemplateBody());

    EventSubscription testSubscription =
        new EventSubscription()
            .withId(UUID.randomUUID())
            .withName("test-notification")
            .withDisplayName("Test Notification Template");

    for (SubscriptionDestination dest : request.getDestinations()) {
      try {
        sendToDestination(mockEvent, testSubscription, dest, testTemplate);
        LOG.info("Successfully sent test notification to {} destination", dest.getType());
      } catch (Exception e) {
        LOG.error(
            "Failed to send test notification to {} destination: {}",
            dest.getType(),
            e.getMessage(),
            e);
      }
    }

    return validation;
  }

  public List<HandlebarsHelperMetadata> getHelperMetadata() {
    return templateProcessor.getHelperMetadata();
  }

  private NotificationTemplate getDefaultTemplateFromSeed(String fqn) throws IOException {
    String seedPath =
        ResourcePathResolver.getResourcePath(NotificationTemplateResourcePathProvider.class);
    List<NotificationTemplate> defaultTemplates = getEntitiesFromSeedData(seedPath);
    return defaultTemplates.stream()
        .filter(t -> fqn.equals(t.getFullyQualifiedName()))
        .findFirst()
        .orElseThrow(
            () -> new IllegalArgumentException("Default template not found in seed data: " + fqn));
  }

  private String calculateTemplateChecksum(NotificationTemplate template) {
    // Only include functional fields in checksum
    // This allows users to customize displayName and description without triggering "modified"
    // status
    String content =
        String.join(
            "|",
            StringUtils.defaultString(template.getTemplateBody()),
            StringUtils.defaultString(template.getTemplateSubject()));
    return EntityUtil.hash(content);
  }

  private void validateExternalDestinations(List<SubscriptionDestination> destinations) {
    for (SubscriptionDestination dest : destinations) {
      if (dest.getCategory() != SubscriptionDestination.SubscriptionCategory.EXTERNAL) {
        throw new IllegalArgumentException(
            "Only external destinations (Email, Slack, Teams, GChat, Webhook) are supported.");
      }
    }
  }

  private void sendToDestination(
      ChangeEvent event,
      EventSubscription subscription,
      SubscriptionDestination destination,
      NotificationTemplate template) {

    NotificationMessage message =
        messageEngine.generateMessageWithTemplate(event, subscription, destination, template);

    switch (destination.getType()) {
      case EMAIL -> sendEmailNotification((EmailMessage) message, destination);
      case SLACK, MS_TEAMS, G_CHAT, WEBHOOK -> sendWebhookNotification(message, destination);
      default -> throw new IllegalArgumentException(
          "Unsupported destination type: " + destination.getType());
    }
  }

  private void sendEmailNotification(
      EmailMessage emailMessage, SubscriptionDestination destination) {
    EmailAlertConfig emailConfig =
        JsonUtils.convertValue(destination.getConfig(), EmailAlertConfig.class);
    Set<String> receivers = emailConfig.getReceivers();

    for (String receiver : receivers) {
      EmailUtil.sendNotificationEmail(
          receiver, emailMessage.getSubject(), emailMessage.getHtmlContent());
    }
  }

  private void sendWebhookNotification(
      NotificationMessage message, SubscriptionDestination destination) {
    Webhook webhook = JsonUtils.convertValue(destination.getConfig(), Webhook.class);
    String json = JsonUtils.pojoToJsonIgnoreNull(message);

    try (Client client =
        SubscriptionUtil.getClient(destination.getTimeout(), destination.getReadTimeout())) {
      Invocation.Builder target = SubscriptionUtil.getTarget(client, webhook, json);

      try (Response response =
          target.post(jakarta.ws.rs.client.Entity.entity(json, MediaType.APPLICATION_JSON_TYPE))) {
        if (response.getStatus() >= 300) {
          throw new RuntimeException("Webhook failed with status: " + response.getStatus());
        }
      }
    }
  }

  public class NotificationTemplateUpdater extends EntityUpdater {
    public NotificationTemplateUpdater(
        NotificationTemplate original, NotificationTemplate updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    protected void entitySpecificUpdate(boolean consolidatingChanges) {
      // Preserve provider type - it's immutable after creation
      updated.setProvider(original.getProvider());

      recordChange("templateBody", original.getTemplateBody(), updated.getTemplateBody());
      recordChange("templateSubject", original.getTemplateSubject(), updated.getTemplateSubject());

      if (ProviderType.SYSTEM.equals(original.getProvider())) {
        try {
          NotificationTemplate defaultTemplate =
              getDefaultTemplateFromSeed(original.getFullyQualifiedName());

          String currentChecksum = calculateTemplateChecksum(updated);
          String defaultChecksum = calculateTemplateChecksum(defaultTemplate);

          updated.setIsModifiedFromDefault(!Objects.equals(currentChecksum, defaultChecksum));
        } catch (IOException | IllegalArgumentException e) {
          LOG.warn("Failed to load seed data for modification tracking", e);
        }
      }
    }
  }
}
