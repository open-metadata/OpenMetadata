package org.openmetadata.catalog.util;

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.EntityRelationshipDAO;
import org.openmetadata.catalog.jdbi3.TableRepository3;
import org.openmetadata.catalog.jdbi3.TagDAO;
import org.openmetadata.catalog.type.EntityReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Used for updating the following common entity fields in PUT and PATCH operations.
 * - description
 * - tags
 * - owner
 *
 * This class handles tracking all the changes in an update operation and also versioning
 * of the entity.
 *
 * Concrete  implementations need to implement update for other fields. See
 * {@link TableRepository3.TableUpdater} for an example implementation.
 */
public abstract class EntityUpdater {
  private static final Logger LOG = LoggerFactory.getLogger(EntityUpdater.class);
  private final EntityInterface originalEntity;
  private final EntityInterface updatedEntity;
  private final EntityRelationshipDAO relationshipDAO;
  private final TagDAO tagDAO;

  protected final boolean patchOperation;
  protected List<String> fieldsUpdated = new ArrayList<>();
  protected List<String> fieldsAdded = new ArrayList<>();
  protected List<String> fieldsDeleted = new ArrayList<>();
  protected boolean majorVersionChange = false;

  public EntityUpdater(EntityInterface originalEntity, EntityInterface updatedEntity, boolean patchOperation,
                       EntityRelationshipDAO relationshipDAO, TagDAO tagDAO) {
    this.originalEntity = originalEntity;
    this.updatedEntity = updatedEntity;
    this.patchOperation = patchOperation;
    this.relationshipDAO = relationshipDAO;
    this.tagDAO = tagDAO;
  }

  public void updateAll() throws IOException {
    updateDescription();
    updateDisplayName();
    updateOwner();
    if (tagDAO != null) {
      updateTags(); // If tagDAO != null, the Entity supports tags
    }
  }

  private void updateDescription() {
    if (!patchOperation &&
            originalEntity.getDescription() != null && !originalEntity.getDescription().isEmpty()) {
      // Update description only when stored is empty to retain user authored descriptions
      updatedEntity.setDescription(originalEntity.getDescription());
      return;
    }
    update("description", originalEntity.getDescription(), updatedEntity.getDescription());
  }

  private void updateDisplayName() {
    if (!patchOperation &&
            originalEntity.getDisplayName() != null && !originalEntity.getDisplayName().isEmpty()) {
      // Update displayName only when stored is empty to retain user authored descriptions
      updatedEntity.setDisplayName(originalEntity.getDisplayName());
      return;
    }
    update("displayName", originalEntity.getDisplayName(), updatedEntity.getDisplayName());
  }

  private void updateOwner() {
    EntityReference origOwner = originalEntity.getOwner();
    EntityReference updatedOwner = updatedEntity.getOwner();
    if (update("owner", origOwner == null ? null : origOwner.getId(),
            updatedOwner == null ? null : updatedOwner.getId())) {
      EntityUtil.updateOwner(relationshipDAO, origOwner, updatedOwner, originalEntity.getId(), Entity.TABLE);
    }
  }

  private void updateTags() throws IOException {
    // Remove current table tags in the database. It will be added back later from the merged tag list.
    EntityUtil.removeTagsByPrefix(tagDAO, originalEntity.getFullyQualifiedName());
    if (!patchOperation) {
      // PUT operation merges tags in the request with what already exists
      updatedEntity.setTags(EntityUtil.mergeTags(updatedEntity.getTags(), originalEntity.getTags()));
    }

    update("tags", originalEntity.getTags() == null ? 0 : originalEntity.getTags().size(),
            updatedEntity.getTags() == null ? 0 : updatedEntity.getTags().size());
    EntityUtil.applyTags(tagDAO, updatedEntity.getTags(), updatedEntity.getFullyQualifiedName());
  }

  public Double getNewVersion(Double oldVersion) {
    Double newVersion = oldVersion;
    if (majorVersionChange) {
      newVersion = oldVersion + 1.0;
    } else if (!fieldsUpdated.isEmpty() || !fieldsAdded.isEmpty() || !fieldsDeleted.isEmpty()) {
      newVersion = oldVersion + 0.1;
    }
    LOG.info("{}->{} - Fields added {}, updated {}, deleted {}",
            oldVersion, newVersion, fieldsAdded, fieldsUpdated, fieldsDeleted);
    return newVersion;
  }

  public abstract void store() throws IOException;

  protected boolean update(String field, Object orig, Object updated) {
    if (orig == null && updated == null) {
      return false;
    }
    if (orig == null) {
      fieldsAdded.add(field);
      return true;
    } else if (updated == null) {
      fieldsDeleted.add(field);
      return true;
    } else if (!orig.equals(updated)) {
      fieldsUpdated.add(field);
      return true;
    }
    return false;
  }
}
