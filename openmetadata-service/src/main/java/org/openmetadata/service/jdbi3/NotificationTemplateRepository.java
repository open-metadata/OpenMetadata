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

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.resources.events.NotificationTemplateResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.resourcepath.ResourcePathResolver;
import org.openmetadata.service.util.resourcepath.providers.NotificationTemplateResourcePathProvider;

@Slf4j
public class NotificationTemplateRepository extends EntityRepository<NotificationTemplate> {

  static final String PATCH_FIELDS = "templateBody,templateSubject";
  static final String UPDATE_FIELDS = "templateBody,templateSubject";

  private final NotificationTemplateProcessor templateProcessor;

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
  }

  @Override
  public void setFields(NotificationTemplate entity, Fields fields) {}

  @Override
  public void clearFields(NotificationTemplate entity, Fields fields) {}

  @Override
  public void prepare(NotificationTemplate entity, boolean update) {
    NotificationTemplateValidationRequest request = new NotificationTemplateValidationRequest();
    request.setTemplateBody(entity.getTemplateBody());
    request.setTemplateSubject(entity.getTemplateSubject());

    NotificationTemplateValidationResponse response = templateProcessor.validate(request);

    // Check for validation errors
    List<String> errors = new ArrayList<>();
    if (response.getTemplateBody() != null && !response.getTemplateBody().getPassed()) {
      errors.add("Template body: " + response.getTemplateBody().getError());
    }
    if (response.getTemplateSubject() != null && !response.getTemplateSubject().getPassed()) {
      errors.add("Template subject: " + response.getTemplateSubject().getError());
    }

    if (!errors.isEmpty()) {
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

  public void resetToDefault(String fqn) {
    try {
      NotificationTemplate original = getByName(null, fqn, getFields("*"));
      if (original == null) {
        throw new IllegalArgumentException("NotificationTemplate not found: " + fqn);
      }

      if (!ProviderType.SYSTEM.equals(original.getProvider())) {
        throw new IllegalArgumentException(
            "Cannot reset template: only SYSTEM templates can be reset to default");
      }

      NotificationTemplate defaultTemplate = getDefaultTemplateFromSeed(fqn);
      NotificationTemplate updated = JsonUtils.deepCopy(original, NotificationTemplate.class);
      updated
          .withTemplateBody(defaultTemplate.getTemplateBody())
          .withTemplateSubject(defaultTemplate.getTemplateSubject())
          .withDescription(defaultTemplate.getDescription())
          .withDisplayName(defaultTemplate.getDisplayName());

      EntityUpdater entityUpdater = getUpdater(original, updated, Operation.PUT, null);
      entityUpdater.update();

      LOG.info("Reset NotificationTemplate {} to default", fqn);
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

  public class NotificationTemplateUpdater extends EntityUpdater {
    public NotificationTemplateUpdater(
        NotificationTemplate original, NotificationTemplate updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    protected void entitySpecificUpdate(boolean consolidatingChanges) {
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
