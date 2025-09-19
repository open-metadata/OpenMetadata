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

import com.github.jknack.handlebars.Handlebars;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.events.NotificationTemplateResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class NotificationTemplateRepository extends EntityRepository<NotificationTemplate> {

  static final String PATCH_FIELDS = "templateBody,description,displayName";
  static final String UPDATE_FIELDS = "templateBody,description,displayName";

  public NotificationTemplateRepository() {
    super(
        NotificationTemplateResource.COLLECTION_PATH,
        Entity.NOTIFICATION_TEMPLATE,
        NotificationTemplate.class,
        Entity.getCollectionDAO().notificationTemplateDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public void setFields(NotificationTemplate entity, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(NotificationTemplate entity, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(NotificationTemplate entity, boolean update) {
    // Validate template syntax
    if (entity.getTemplateBody() != null) {
      validateTemplateBody(entity.getTemplateBody());
    }
  }

  @Override
  public void storeEntity(NotificationTemplate entity, boolean update) {
    // Store the entity using the standard mechanism
    store(entity, update);
  }

  @Override
  public void storeRelationships(NotificationTemplate entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public EntityRepository<NotificationTemplate>.EntityUpdater getUpdater(
      NotificationTemplate original,
      NotificationTemplate updated,
      Operation operation,
      ChangeSource changeSource) {
    return new NotificationTemplateUpdater(original, updated, operation);
  }

  private void validateTemplateBody(String templateBody) {
    try {
      // Use Handlebars to validate the template syntax
      Handlebars handlebars = new Handlebars();
      handlebars.compileInline(templateBody);
    } catch (Exception e) {
      // Provide clean user message (detailed error available in server logs)
      throw new IllegalArgumentException("Invalid template syntax");
    }
  }

  public class NotificationTemplateUpdater extends EntityUpdater {
    public NotificationTemplateUpdater(
        NotificationTemplate original, NotificationTemplate updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    protected void entitySpecificUpdate(boolean consolidatingChanges) {
      // Only record changes for fields specific to NotificationTemplate
      // Description and displayName are handled by the parent class
      recordChange("templateBody", original.getTemplateBody(), updated.getTemplateBody());
    }
  }
}
