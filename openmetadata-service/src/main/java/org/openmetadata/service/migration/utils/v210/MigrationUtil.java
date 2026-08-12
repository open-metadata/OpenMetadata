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

package org.openmetadata.service.migration.utils.v210;

import java.sql.ResultSet;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.FullyQualifiedName;

/** Migration utility for 2.1.0 data migrations. */
@Slf4j
public class MigrationUtil {
  private static final String OLD_CONTEXT_CENTER_CLASSIFICATION_NAME = "KnowledgeCenter";
  private static final String NEW_CONTEXT_CENTER_CLASSIFICATION_NAME = "ContextCenter";
  private static final String NEW_CONTEXT_CENTER_CLASSIFICATION_DESCRIPTION =
      "Category describing the context center articles or quickLinks. E.g., How-To-Guide, Quick-Link etc.";
  private static final Map<String, String> NEW_CONTEXT_CENTER_TAG_DESCRIPTIONS =
      Map.of(
          "Article", "Context Center Article.",
          "QuickLink", "Context Center Quick Link.",
          "HowToGuide", "How To Guide Quick Link or Article Tag.");

  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  /**
   * Renames the system classification seeded as "KnowledgeCenter" (2.0.0-rc1) to "ContextCenter"
   * to match the renamed product surface. Fresh installs already get "ContextCenter" from the
   * updated seed file, so this is a no-op unless the old classification row still exists.
   */
  public void renameKnowledgeCenterClassification() {
    CollectionDAO daoCollection = Entity.getCollectionDAO();
    Classification classification = findOldContextCenterClassification(daoCollection);
    if (classification == null) {
      LOG.info(
          "No '{}' classification found, skipping context center classification rename",
          OLD_CONTEXT_CENTER_CLASSIFICATION_NAME);
      return;
    }

    renameClassificationRow(daoCollection, classification);
    daoCollection
        .tagDAO()
        .updateFqn(OLD_CONTEXT_CENTER_CLASSIFICATION_NAME, NEW_CONTEXT_CENTER_CLASSIFICATION_NAME);
    daoCollection
        .tagUsageDAO()
        .updateTagPrefix(
            TagSource.CLASSIFICATION.ordinal(),
            OLD_CONTEXT_CENTER_CLASSIFICATION_NAME,
            NEW_CONTEXT_CENTER_CLASSIFICATION_NAME);
    updateContextCenterTagDescriptions(daoCollection);

    LOG.info(
        "Renamed classification '{}' to '{}'",
        OLD_CONTEXT_CENTER_CLASSIFICATION_NAME,
        NEW_CONTEXT_CENTER_CLASSIFICATION_NAME);
  }

  private Classification findOldContextCenterClassification(CollectionDAO daoCollection) {
    Classification classification;
    try {
      classification =
          daoCollection
              .classificationDAO()
              .findEntityByName(OLD_CONTEXT_CENTER_CLASSIFICATION_NAME, Include.ALL);
    } catch (EntityNotFoundException e) {
      classification = null;
    }
    return classification;
  }

  private void renameClassificationRow(CollectionDAO daoCollection, Classification classification) {
    classification
        .withName(NEW_CONTEXT_CENTER_CLASSIFICATION_NAME)
        .withFullyQualifiedName(NEW_CONTEXT_CENTER_CLASSIFICATION_NAME)
        .withDescription(NEW_CONTEXT_CENTER_CLASSIFICATION_DESCRIPTION);
    daoCollection.classificationDAO().update(classification);
  }

  private void updateContextCenterTagDescriptions(CollectionDAO daoCollection) {
    NEW_CONTEXT_CENTER_TAG_DESCRIPTIONS.forEach(
        (tagName, description) -> updateTagDescription(daoCollection, tagName, description));
  }

  private void updateTagDescription(
      CollectionDAO daoCollection, String tagName, String description) {
    String tagFqn = FullyQualifiedName.build(NEW_CONTEXT_CENTER_CLASSIFICATION_NAME, tagName);
    try {
      Tag tag = daoCollection.tagDAO().findEntityByName(tagFqn, Include.ALL);
      tag.withDescription(description);
      daoCollection.tagDAO().update(tag);
    } catch (EntityNotFoundException e) {
      LOG.info("Tag '{}' not found, skipping description update", tagFqn);
    }
  }

  public void archiveLegacyThreadStorage() {
    if (!tableExists("thread_entity_legacy")) {
      LOG.info("No thread_entity_legacy table found, skipping legacy thread archival");
      return;
    }

    if (tableExists("thread_entity_archived")) {
      LOG.info("thread_entity_archived already exists, skipping legacy thread archival");
      return;
    }

    if (connectionType == ConnectionType.MYSQL) {
      handle.execute("RENAME TABLE thread_entity_legacy TO thread_entity_archived");
    } else {
      handle.execute("ALTER TABLE thread_entity_legacy RENAME TO thread_entity_archived");
    }

    LOG.info("Archived legacy thread storage from thread_entity_legacy to thread_entity_archived");
  }

  private boolean tableExists(String tableName) {
    try (ResultSet tables =
        handle
            .getConnection()
            .getMetaData()
            .getTables(null, null, tableName, new String[] {"TABLE"})) {
      while (tables.next()) {
        if (tableName.equalsIgnoreCase(tables.getString("TABLE_NAME"))) {
          return true;
        }
      }
      return false;
    } catch (Exception e) {
      return false;
    }
  }
}
