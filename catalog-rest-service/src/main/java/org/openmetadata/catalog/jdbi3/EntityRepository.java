/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityVersionPair;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.common.utils.CipherText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiPredicate;

/**
 * Interface used for accessing the concrete entity DAOs such as table, dashboard etc.
 * This gives a uniform access so that common boiler plate code can be reduced.
 */
public abstract class EntityRepository<T> {
  public static final Logger LOG = LoggerFactory.getLogger(EntityRepository.class);
  private final String collectionPath;
  private final Class<T> entityClass;
  private final String entityName;
  private final EntityDAO<T> dao;
  private final CollectionDAO daoCollection;
  private final Fields patchFields;
  private final Fields putFields;

  /**
   * Entity related operations that should be implemented or overridden by entities
   */
  public abstract EntityInterface<T> getEntityInterface(T entity);

  public abstract T setFields(T entity, Fields fields) throws IOException, ParseException;
  public abstract void restorePatchAttributes(T original, T updated) throws IOException, ParseException;
  public abstract void validate(T entity) throws IOException;
  public abstract void store(T entity, boolean update) throws IOException;
  public abstract void storeRelationships(T entity) throws IOException;

  public EntityUpdater getUpdater(T original, T updated, boolean patchOperation) throws IOException {
    return new EntityUpdater(original, updated, patchOperation);
  }

  EntityRepository(String collectionPath, Class<T> entityClass, EntityDAO<T> entityDAO, CollectionDAO collectionDAO,
                   Fields patchFields, Fields putFields) {
    this.collectionPath = collectionPath;
    this.entityClass = entityClass;
    this.dao = entityDAO;
    this.daoCollection = collectionDAO;
    this.patchFields = patchFields;
    this.putFields = putFields;
    this.entityName = entityClass.getSimpleName().toLowerCase(Locale.ROOT);
    Entity.registerEntity(entityName, dao, this);
  }

  @Transaction
  public final T get(UriInfo uriInfo, String id, Fields fields) throws IOException, ParseException {
    return withHref(uriInfo, setFields(dao.findEntityById(UUID.fromString(id)), fields));
  }

  @Transaction
  public final T getByName(UriInfo uriInfo, String fqn, Fields fields) throws IOException, ParseException {
    return withHref(uriInfo, setFields(dao.findEntityByName(fqn), fields));
  }

  @Transaction
  public final ResultList<T> listAfter(UriInfo uriInfo, Fields fields, String fqnPrefix, int limitParam, String after)
          throws GeneralSecurityException, IOException, ParseException {
    // forward scrolling, if after == null then first page is being asked
    List<String> jsons = dao.listAfter(fqnPrefix, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      T entity = withHref(uriInfo, setFields(JsonUtils.readValue(json, entityClass), fields));
      entities.add(entity);
    }
    int total = dao.listCount(fqnPrefix);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : getFullyQualifiedName(entities.get(0));
    if (entities.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      entities.remove(limitParam);
      afterCursor = getFullyQualifiedName(entities.get(limitParam - 1));
    }
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public final ResultList<T> listBefore(UriInfo uriInfo, Fields fields, String fqnPrefix, int limitParam, String before)
          throws IOException, GeneralSecurityException, ParseException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = dao.listBefore(fqnPrefix, limitParam + 1, CipherText.instance().decrypt(before));

    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      T entity = withHref(uriInfo, setFields(JsonUtils.readValue(json, entityClass), fields));
      entities.add(entity);
    }
    int total = dao.listCount(fqnPrefix);

    String beforeCursor = null, afterCursor;
    if (entities.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      entities.remove(0);
      beforeCursor = getFullyQualifiedName(entities.get(0));
    }
    afterCursor = getFullyQualifiedName(entities.get(entities.size() - 1));
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public T getVersion(String id, String version) throws IOException, ParseException {
    Double requestedVersion = Double.parseDouble(version);
    String extension = EntityUtil.getVersionExtension(entityName, requestedVersion);

    // Get previous version from version history
    String json = daoCollection.entityExtensionDAO().getEntityVersion(id, extension);
    if (json != null) {
      return JsonUtils.readValue(json, entityClass);
    }
    // If requested latest version, return it from current version of the entity
    T entity = setFields(dao.findEntityById(UUID.fromString(id)), putFields);
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    if (entityInterface.getVersion().equals(requestedVersion)) {
      return entity;
    }
    throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityVersionNotFound(entityName, id, requestedVersion));
  }

  @Transaction
  public EntityHistory listVersions(String id) throws IOException, ParseException {
    T latest = setFields(dao.findEntityById(UUID.fromString(id)), putFields);
    String extensionPrefix = EntityUtil.getVersionExtensionPrefix(entityName);
    List<EntityVersionPair> oldVersions = daoCollection.entityExtensionDAO().getEntityVersions(id, extensionPrefix);
    oldVersions.sort(EntityUtil.compareVersion.reversed());

    final List<Object> allVersions = new ArrayList<>();
    allVersions.add(JsonUtils.pojoToJson(latest));
    oldVersions.forEach(version -> allVersions.add(version.getEntityJson()));
    return new EntityHistory().withEntityType(entityName).withVersions(allVersions);
  }

  public final T create(UriInfo uriInfo, T entity) throws IOException, ParseException {
    return withHref(uriInfo, createInternal(entity));
  }

  @Transaction
  public final T createInternal(T entity) throws IOException, ParseException {
    validate(entity);
    return createNewEntity(entity);
  }

  @Transaction
  public final PutResponse<T> createOrUpdate(UriInfo uriInfo, T updated) throws IOException, ParseException {
    validate(updated);
    T original = JsonUtils.readValue(dao.findJsonByFqn(getFullyQualifiedName(updated)), entityClass);
    if (original == null) {
      return new PutResponse<>(Status.CREATED, withHref(uriInfo, createNewEntity(updated)), RestUtil.ENTITY_CREATED);
    }
    // Update the existing entity
    setFields(original, putFields);

    EntityUpdater entityUpdater = getUpdater(original, updated, false);
    entityUpdater.update();
    entityUpdater.store();
    String change = entityUpdater.fieldsChanged() ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    return new PutResponse<>(Status.OK, withHref(uriInfo, updated), change);
  }

  @Transaction
  public final PatchResponse<T> patch(UriInfo uriInfo, UUID id, String user, JsonPatch patch) throws IOException,
          ParseException {
    T original = setFields(dao.findEntityById(id), patchFields);
    T updated = JsonUtils.applyPatch(original, patch, entityClass);
    EntityInterface<T> updatedEntity = getEntityInterface(updated);
    updatedEntity.setUpdateDetails(user, new Date());

    validate(updated);
    restorePatchAttributes(original, updated);
    EntityUpdater entityUpdater = getUpdater(original, updated, true);
    entityUpdater.update();
    entityUpdater.store();
    String change = entityUpdater.fieldsChanged() ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    return new PatchResponse<T>(Status.OK, withHref(uriInfo, updated), change);
  }

  @Transaction
  public PutResponse<T> addFollower(String updatedBy, UUID entityId, UUID userId) throws IOException {
    // Get entity
    T entity = dao.findEntityById(entityId);
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Validate user
    User user = daoCollection.userDAO().findEntityById(userId);
    if (user.getDeactivated()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(userId));
    }

    // Add relationship
    int added = daoCollection.relationshipDAO().insert(userId.toString(), entityId.toString(), Entity.USER, entityName,
            Relationship.FOLLOWS.ordinal());

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entityInterface.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("followers")
            .withNewValue(List.of(Entity.getEntityReference(user))));
    ChangeEvent changeEvent = new ChangeEvent().withChangeDescription(change).withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(entityName).withEntityId(entityId).withUserName(updatedBy)
            .withDateTime(new Date()).withCurrentVersion(entityInterface.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    return new PutResponse<>(added > 0 ? Status.CREATED : Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  @Transaction
  public PutResponse<T> deleteFollower(String updatedBy, UUID entityId, UUID userId) throws IOException {
    T entity = dao.findEntityById(entityId);
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Validate user
    User user = daoCollection.userDAO().findEntityById(userId);

    // Remove follower
    daoCollection.relationshipDAO().delete(userId.toString(), entityId.toString(), Relationship.FOLLOWS.ordinal());

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entityInterface.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("followers")
            .withOldValue(List.of(Entity.getEntityReference(user))));

    ChangeEvent changeEvent = new ChangeEvent().withChangeDescription(change).withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(entityName).withEntityId(entityId).withUserName(updatedBy)
            .withDateTime(new Date()).withCurrentVersion(entityInterface.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    return new PutResponse<>(Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public final String getFullyQualifiedName(T entity) {
    return getEntityInterface(entity).getFullyQualifiedName();
  }

  public final ResultList<T> getResultList(List<T> entities, String beforeCursor, String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new ResultList<>(entities, beforeCursor, afterCursor, total);
  }

  private T createNewEntity(T entity) throws IOException {
    store(entity, false);
    storeRelationships(entity);
    return entity;
  }

  protected T withHref(UriInfo uriInfo, T entity) {
    if (uriInfo == null) {
      return entity;
    }
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    return entityInterface.withHref(getHref(uriInfo, entityInterface.getId()));
  }

  public URI getHref(UriInfo uriInfo, UUID id) {
    return RestUtil.getHref(uriInfo, collectionPath, id);
  }

  /**
   * Class that performs PUT and PATCH UPDATE operation. Override {@code entitySpecificUpdate()} to add
   * additional entity specific fields to be updated.
   */
  public class EntityUpdater {
    protected final EntityInterface<T> original;
    protected final EntityInterface<T> updated;
    protected final boolean patchOperation;
    protected final ChangeDescription changeDescription = new ChangeDescription();
    protected boolean majorVersionChange = false;

    public EntityUpdater(T original, T updated, boolean patchOperation) {
      this.original = getEntityInterface(original);
      this.updated = getEntityInterface(updated);
      this.patchOperation = patchOperation;
    }

    public final void update() throws IOException {
      updated.setId(original.getId());
      updateDescription();
      updateDisplayName();
      updateOwner();
      updateTags(updated.getFullyQualifiedName(), "tags", original.getTags(), updated.getTags());
      entitySpecificUpdate();
    }

    public void entitySpecificUpdate() throws IOException {
      // Default implementation. Override this to add any entity specific field updates
    }

    private void updateDescription() throws JsonProcessingException {
      if (!patchOperation &&
              original.getDescription() != null && !original.getDescription().isEmpty()) {
        // Update description only when stored is empty to retain user authored descriptions
        updated.setDescription(original.getDescription());
        return;
      }
      recordChange("description", original.getDescription(), updated.getDescription());
    }

    private void updateDisplayName() throws JsonProcessingException {
      if (!patchOperation &&
              original.getDisplayName() != null && !original.getDisplayName().isEmpty()) {
        // Update displayName only when stored is empty to retain user authored descriptions
        updated.setDisplayName(original.getDisplayName());
        return;
      }
      recordChange("displayName", original.getDisplayName(), updated.getDisplayName());
    }

    private void updateOwner() throws JsonProcessingException {
      EntityReference origOwner = original.getOwner();
      EntityReference updatedOwner = updated.getOwner();
      if (origOwner == null && updatedOwner == null) {
        return;
      }

      UUID origId = origOwner == null ? null : origOwner.getId();
      UUID updatedId = updatedOwner == null ? null : updatedOwner.getId();
      if (Objects.equals(origId, updatedId)) {
        return; // No change
      }

      if (recordChange("owner", origOwner == null ? null : JsonUtils.pojoToJson(origOwner),
              updatedOwner == null ? null : JsonUtils.pojoToJson(updatedOwner))) {
        EntityUtil.updateOwner(daoCollection.relationshipDAO(), origOwner,
                updatedOwner, original.getId(), entityName);
      }
    }

    protected void updateTags(String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags)
            throws IOException {
      // Remove current entity tags in the database. It will be added back later from the merged tag list.
      origTags = Optional.ofNullable(origTags).orElse(Collections.emptyList());
      updatedTags = Optional.ofNullable(updatedTags).orElse(Collections.emptyList());
      if (origTags.isEmpty() && updatedTags.isEmpty()) {
        return; // Nothing to update
      }

      // Remove current entity tags in the database. It will be added back later from the merged tag list.
      EntityUtil.removeTagsByPrefix(daoCollection.tagDAO(), fqn);
      if (!patchOperation) {
        // PUT operation merges tags in the request with what already exists
        List<TagLabel> mergedTags = EntityUtil.mergeTags(updatedTags, origTags);
        updatedTags.clear();
        updatedTags.addAll(mergedTags);
      }

      List<TagLabel> addedTags = new ArrayList<>();
      List<TagLabel> deletedTags = new ArrayList<>();
      recordListChange(fieldName, origTags, updatedTags, addedTags, deletedTags, EntityUtil.tagLabelMatch);
      updatedTags.sort(EntityUtil.compareTagLabel);
      EntityUtil.applyTags(daoCollection.tagDAO(), updatedTags, fqn);
    }

    public final boolean updateVersion(Double oldVersion) {
      Double newVersion = oldVersion;
      if (majorVersionChange) {
        newVersion = Math.round((oldVersion + 1.0) * 10.0)/10.0;
      } else if (fieldsChanged()) {
        newVersion = Math.round((oldVersion + 0.1) * 10.0)/10.0;
      }
      LOG.info("{}->{} - Fields added {}, updated {}, deleted {}",
              oldVersion, newVersion, changeDescription.getFieldsAdded(), changeDescription.getFieldsUpdated(),
              changeDescription.getFieldsDeleted());
      changeDescription.withPreviousVersion(oldVersion);
      updated.setChangeDescription(newVersion, changeDescription);
      return !newVersion.equals(oldVersion);
    }

    private boolean fieldsChanged() {
      return !changeDescription.getFieldsAdded().isEmpty() ||
              !changeDescription.getFieldsUpdated().isEmpty() ||
              !changeDescription.getFieldsDeleted().isEmpty();
    }

    public final boolean recordChange(String field, Object orig, Object updated) throws JsonProcessingException {
      return recordChange(field, orig, updated, false);
    }

    public final boolean recordChange(String field, Object orig, Object updated, boolean jsonValue)
            throws JsonProcessingException {
      if (orig == null && updated == null) {
        return false;
      }
      FieldChange fieldChange = new FieldChange().withName(field)
              .withOldValue(jsonValue ? JsonUtils.pojoToJson(orig) : orig)
              .withNewValue(jsonValue ? JsonUtils.pojoToJson(updated) : updated);
      if (orig == null) {
        changeDescription.getFieldsAdded().add(fieldChange);
        return true;
      } else if (updated == null) {
        changeDescription.getFieldsDeleted().add(fieldChange);
        return true;
      } else if (!orig.equals(updated)) {
        changeDescription.getFieldsUpdated().add(fieldChange);
        return true;
      }
      return false;
    }

    public final <K> void recordListChange(String field, List<K> origList, List<K> updatedList, List<K> addedItems,
                                           List<K> deletedItems, BiPredicate<K, K> typeMatch)
            throws JsonProcessingException {
      for (K stored : origList) {
        // If an entry in the original list is not in updated list, then it is deleted during update
        K updated = updatedList.stream().filter(c -> typeMatch.test(c, stored)).findAny().orElse(null);
        if (updated == null) {
          deletedItems.add(stored);
        }
      }

      for (K updated : updatedList) {
        // If an entry in the updated list is not in original list, then it is added during update
        K stored = origList.stream().filter(c -> typeMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New column added
          addedItems.add(updated);
        }
      }
      if (!addedItems.isEmpty()) {
        FieldChange fieldChange = new FieldChange().withName(field).withNewValue(JsonUtils.pojoToJson(addedItems));
        changeDescription.getFieldsAdded().add(fieldChange);
      }
      if (!deletedItems.isEmpty()) {
        FieldChange fieldChange = new FieldChange().withName(field).withOldValue(JsonUtils.pojoToJson(deletedItems));
        changeDescription.getFieldsDeleted().add(fieldChange);
      }
    }

    public final void store() throws IOException, ParseException {
      if (updateVersion(original.getVersion())) {
        // Store the old version
        String extensionName = EntityUtil.getVersionExtension(entityName, original.getVersion());
        daoCollection.entityExtensionDAO().insert(original.getId().toString(), extensionName, entityName,
                JsonUtils.pojoToJson(original.getEntity()));

        // Store the new version
        EntityRepository.this.store(updated.getEntity(), true);
      } else {
        updated.setUpdateDetails(original.getUpdatedBy(), original.getUpdatedAt());
      }
    }
  }
}
