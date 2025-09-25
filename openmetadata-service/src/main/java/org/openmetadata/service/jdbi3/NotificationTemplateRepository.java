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
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.change.ChangeSource;
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
    // Validate template if body is present
    if (entity.getTemplateBody() != null) {
      NotificationTemplateValidationRequest request = new NotificationTemplateValidationRequest();
      request.setTemplateBody(entity.getTemplateBody());
      request.setTemplateSubject(entity.getTemplateSubject());

      NotificationTemplateValidationResponse response = templateProcessor.validate(request);

      // Check for validation errors
      StringBuilder errors = new StringBuilder();
      if (response.getTemplateBody() != null && !response.getTemplateBody().getPassed()) {
        errors.append("Template body: ").append(response.getTemplateBody().getError());
      }
      if (response.getTemplateSubject() != null && !response.getTemplateSubject().getPassed()) {
        if (errors.length() > 0) {
          errors.append("; ");
        }
        errors.append("Template subject: ").append(response.getTemplateSubject().getError());
      }

      if (errors.length() > 0) {
        throw new IllegalArgumentException("Invalid template: " + errors);
      }
    }
  }

  @Override
  public void storeEntity(NotificationTemplate entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(NotificationTemplate entity) {}

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
      String seedChecksum = calculateTemplateChecksum(seedTemplate);

      if (existing == null) {
        seedTemplate.withIsModifiedFromDefault(false).withDefaultTemplateChecksum(seedChecksum);
        initializeEntity(seedTemplate);
        LOG.info("Created new system template {}", fqn);
        continue;
      }

      if (ProviderType.SYSTEM.equals(existing.getProvider())
          && Boolean.FALSE.equals(existing.getIsModifiedFromDefault())
          && !Objects.equals(seedChecksum, existing.getDefaultTemplateChecksum())) {
        // Only update functional fields for unmodified templates (hybrid approach)
        // This preserves any user-customized displayName or description
        existing
            .withTemplateBody(seedTemplate.getTemplateBody())
            .withTemplateSubject(seedTemplate.getTemplateSubject())
            .withDefaultTemplateChecksum(seedChecksum);
        store(existing, true);
        LOG.info("Updated system template {} to new version", existing.getFullyQualifiedName());
        continue;
      }

      LOG.debug(
          "Skipping template {} - either user template or modified system template",
          existing.getFullyQualifiedName());
    }
  }

  public void resetToDefault(String fqn) {
    try {
      NotificationTemplate template = getByName(null, fqn, getFields("*"));
      if (template == null) {
        throw new IllegalArgumentException("NotificationTemplate not found: " + fqn);
      }

      if (!ProviderType.SYSTEM.equals(template.getProvider())) {
        throw new IllegalArgumentException(
            "Cannot reset template: only SYSTEM templates can be reset to default");
      }

      String seedPath =
          ResourcePathResolver.getResourcePath(NotificationTemplateResourcePathProvider.class);
      List<NotificationTemplate> defaultTemplates = getEntitiesFromSeedData(seedPath);
      NotificationTemplate defaultTemplate =
          defaultTemplates.stream()
              .filter(t -> fqn.equals(t.getFullyQualifiedName()))
              .findFirst()
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          "Default template not found in seed data: " + fqn));

      template
          .withTemplateBody(defaultTemplate.getTemplateBody())
          .withTemplateSubject(defaultTemplate.getTemplateSubject())
          .withDescription(defaultTemplate.getDescription())
          .withDisplayName(defaultTemplate.getDisplayName())
          .withIsModifiedFromDefault(false)
          .withDefaultTemplateChecksum(calculateTemplateChecksum(defaultTemplate));

      store(template, true);

      LOG.info("Reset NotificationTemplate {} to default", fqn);
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
      // Record template-specific content changes for versioning and rollback
      recordChange("templateBody", original.getTemplateBody(), updated.getTemplateBody());
      recordChange("templateSubject", original.getTemplateSubject(), updated.getTemplateSubject());

      // Update modification tracking WITHOUT recording (metadata management)
      if (ProviderType.SYSTEM.equals(original.getProvider())) {
        // Calculate current template checksum
        String currentChecksum = calculateTemplateChecksum(updated);
        String defaultChecksum = original.getDefaultTemplateChecksum();

        // Set modification status based on checksum comparison
        updated.setIsModifiedFromDefault(!Objects.equals(currentChecksum, defaultChecksum));
      }
    }
  }
}
