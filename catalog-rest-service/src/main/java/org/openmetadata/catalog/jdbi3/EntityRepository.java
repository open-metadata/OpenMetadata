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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.Entity.getEntityFields;
import static org.openmetadata.catalog.type.Include.ALL;
import static org.openmetadata.catalog.type.Include.DELETED;
import static org.openmetadata.catalog.util.EntityUtil.compareTagLabel;
import static org.openmetadata.catalog.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.catalog.util.EntityUtil.nextMajorVersion;
import static org.openmetadata.catalog.util.EntityUtil.nextVersion;
import static org.openmetadata.catalog.util.EntityUtil.objectMatch;
import static org.openmetadata.catalog.util.EntityUtil.tagLabelMatch;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.regex.Pattern;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.apache.maven.shared.utils.io.IOUtil;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.exception.UnhandledServerException;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityVersionPair;
import org.openmetadata.catalog.jdbi3.TableRepository.TableUpdater;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.TagLabel.Source;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.common.utils.CommonUtil;

/**
 * This is the base class used by Entity Resources to perform READ and WRITE operations to the backend database to
 * Create, Retrieve, Update, and Delete entities.
 *
 * <p>An entity has two types of fields - `attributes` and `relationships`.
 *
 * <ul>
 *   <li>The `attributes` are the core properties of the entity, example - entity id, name, fullyQualifiedName, columns
 *       for a table, etc.
 *   <li>The `relationships` are an associated between two entities, example - table belongs to a database, table has a
 *       tag, user owns a table, etc. All relationships are captured using {@code EntityReference}.
 * </ul>
 *
 * Entities are stored as JSON documents in the database. Each entity is stored in a separate table and is accessed
 * through a <i>Data Access Object</i> or <i>DAO</i> that corresponds to each of the entity. For example,
 * <i>table_entity</i> is the database table used to store JSON docs corresponding to <i>table</i> entity and {@link
 * org.openmetadata.catalog.jdbi3.CollectionDAO.TableDAO} is used as the DAO object to access the table_entity table.
 * All DAO objects for an entity are available in {@code daoCollection}. <br>
 * <br>
 * Relationships between entity is stored in a separate table that captures the edge - fromEntity, toEntity, and the
 * relationship name <i>entity_relationship</i> table and are supported by {@link
 * org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipDAO} DAO object.
 *
 * <p>JSON document of an entity stores only <i>required</i> attributes of an entity. Some attributes such as
 * <i>href</i> are not stored and are created on the fly. <br>
 * <br>
 * Json document of an entity does not store relationships. As an example, JSON document for <i>table</i> entity does
 * not store the relationship <i>database</i> which is of type <i>EntityReference</i>. This is always retrieved from the
 * relationship table when required to ensure, the data stored is efficiently and consistently, and relationship
 * information does not become stale.
 */
@Slf4j
public abstract class EntityRepository<T> {
  private final String collectionPath;
  private final Class<T> entityClass;
  private final String entityType;
  protected final EntityDAO<T> dao;
  protected final CollectionDAO daoCollection;
  protected final List<String> allowedFields;
  protected boolean supportsSoftDelete = true;
  protected final boolean supportsTags;
  protected final boolean supportsOwner;
  protected final boolean supportsFollower;
  protected boolean allowEdits = false;

  /** Fields that can be updated during PATCH operation */
  private final Fields patchFields;

  /** Fields that can be updated during PUT operation */
  private final Fields putFields;

  EntityRepository(
      String collectionPath,
      String entityType,
      Class<T> entityClass,
      EntityDAO<T> entityDAO,
      CollectionDAO collectionDAO,
      String patchFields,
      String putFields) {
    this.collectionPath = collectionPath;
    this.entityClass = entityClass;
    allowedFields = getEntityFields(entityClass);
    this.dao = entityDAO;
    this.daoCollection = collectionDAO;
    this.patchFields = getFields(patchFields);
    this.putFields = getFields(putFields);
    this.entityType = entityType;

    this.supportsTags = allowedFields.contains("tags");
    this.supportsOwner = allowedFields.contains("owner");
    this.supportsFollower = allowedFields.contains("followers");
    Entity.registerEntity(entityClass, entityType, dao, this);
  }

  /** Entity related operations that should be implemented or overridden by entities */
  public abstract EntityInterface<T> getEntityInterface(T entity);

  /**
   * Set the requested fields in an entity. This is used for requesting specific fields in the object during GET
   * operations. It is also used during PUT and PATCH operations to set up fields that can be updated.
   */
  public abstract T setFields(T entity, Fields fields) throws IOException;

  /**
   * This method is used for validating an entity to be created during POST, PUT, and PATCH operations and prepare the
   * entity with all the required attributes and relationships.
   *
   * <p>The implementation of this method must perform the following:
   *
   * <ol>
   *   <li>Prepare the values for attributes that are not required in the request but can be derived on the server side.
   *       Example - <i>>FullyQualifiedNames</i> of an entity can be derived from the hierarchy that an entity belongs
   *       to .
   *   <li>Validate all the attributes of an entity.
   *   <li>Validate all the relationships of an entity. As an example - during <i>table</i> creation, relationships such
   *       as <i>Tags</i>, <i>Owner</i>, <i>Database</i>a table belongs to are validated. During validation additional
   *       information that is not required in the create/update request are set up in the corresponding relationship
   *       fields.
   * </ol>
   *
   * At the end of this operation, entity is expected to be valid and fully constructed with all the fields that will be
   * sent as payload in the POST, PUT, and PATCH operations response.
   *
   * @see TableRepository#prepare(Table) for an example implementation
   */
  public abstract void prepare(T entity) throws IOException;

  /**
   * An entity is stored in the backend database as JSON document. The JSON includes some attributes of the entity and
   * does not include attributes such as <i>href</i>. The relationship fields of an entity is never stored in the JSON
   * document. It is always reconstructed based on relationship edges from the backend database. <br>
   * <br>
   * As an example, when <i>table</i> entity is stored, the attributes such as <i>href</i> and the relationships such as
   * <i>owner</i>, <i>database</i>, and <i>tags</i> are set to null. These attributes are restored back after the JSON
   * document is stored to be sent as response.
   *
   * @see TableRepository#storeEntity(Table, boolean) for an example implementation
   */
  public abstract void storeEntity(T entity, boolean update) throws IOException;

  /**
   * This method is called to store all the relationships of an entity. It is expected that all relationships are
   * already validated and completely setup before this method is called and no validation of relationships is required.
   *
   * @see TableRepository#storeRelationships(Table) for an example implementation
   */
  public abstract void storeRelationships(T entity);

  /**
   * PATCH operations can't overwrite certain fields, such as entity ID, fullyQualifiedNames etc. Instead of throwing an
   * error, we take lenient approach of ignoring the user error and restore those attributes based on what is already
   * stored in the original entity.
   */
  public void restorePatchAttributes(T original, T updated) {
    /* Nothing to restore during PATCH */
  }

  /**
   * Initialize data from json files if seed data does not exist in corresponding tables. Seed data is stored under
   * catalog-rest-service/src/main/resources/json/data/{entityType}
   *
   * <p>This method needs to be explicitly called, typically from initialize method. See {@link
   * org.openmetadata.catalog.resources.teams.RoleResource#initialize(CatalogApplicationConfig)}
   */
  public void initSeedDataFromResources() throws IOException {
    Pattern pattern = Pattern.compile(String.format(".*json/data/%s/.*\\.json$", entityType));
    List<String> jsonDataFiles = CommonUtil.getResources(pattern);
    jsonDataFiles.forEach(
        jsonDataFile -> {
          try {
            String json =
                IOUtil.toString(Objects.requireNonNull(getClass().getClassLoader().getResourceAsStream(jsonDataFile)));
            initSeedData(JsonUtils.readValue(json, entityClass));
          } catch (IOException e) {
            LOG.warn("Failed to initialize the {} from file {}: {}", entityType, jsonDataFile, e.getMessage());
          }
        });
  }

  /** Initialize a given entity if it does not exist. */
  @Transaction
  public void initSeedData(T entity) throws IOException {
    EntityInterface<T> entityInterface = Entity.getEntityInterface(entity);
    String existingJson = dao.findJsonByFqn(entityInterface.getFullyQualifiedName(), ALL);
    if (existingJson != null) {
      LOG.info("{} {} is already initialized", entityType, entityInterface.getFullyQualifiedName());
      return;
    }

    LOG.info("{} {} is not initialized", entityType, entityInterface.getFullyQualifiedName());
    entityInterface.setUpdateDetails("admin", System.currentTimeMillis());
    entityInterface.setId(UUID.randomUUID());
    storeEntity(entityInterface.getEntity(), false);
    LOG.info("Created a new {} {}", entityType, entityInterface.getFullyQualifiedName());
  }

  public EntityUpdater getUpdater(T original, T updated, Operation operation) {
    return new EntityUpdater(original, updated, operation);
  }

  @Transaction
  public final T get(UriInfo uriInfo, String id, Fields fields) throws IOException {
    return get(uriInfo, id, fields, Include.NON_DELETED);
  }

  @Transaction
  public final T get(UriInfo uriInfo, String id, Fields fields, Include include) throws IOException {
    return withHref(uriInfo, setFields(dao.findEntityById(UUID.fromString(id), include), fields));
  }

  @Transaction
  public final T getByName(UriInfo uriInfo, String fqn, Fields fields) throws IOException {
    return getByName(uriInfo, fqn, fields, Include.NON_DELETED);
  }

  @Transaction
  public final T getByName(UriInfo uriInfo, String fqn, Fields fields, Include include) throws IOException {
    return withHref(uriInfo, setFields(dao.findEntityByName(fqn, include), fields));
  }

  @Transaction
  public final ResultList<T> listAfter(UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String after)
      throws IOException {
    int total = dao.listCount(filter);
    List<T> entities = new ArrayList<>();
    if (limitParam > 0) {
      // forward scrolling, if after == null then first page is being asked
      List<String> jsons = dao.listAfter(filter, limitParam + 1, after == null ? "" : RestUtil.decodeCursor(after));

      for (String json : jsons) {
        T entity = withHref(uriInfo, setFields(JsonUtils.readValue(json, entityClass), fields));
        entities.add(entity);
      }

      String beforeCursor;
      String afterCursor = null;
      beforeCursor = after == null ? null : getFullyQualifiedName(entities.get(0));
      if (entities.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
        entities.remove(limitParam);
        afterCursor = getFullyQualifiedName(entities.get(limitParam - 1));
      }
      return getResultList(entities, beforeCursor, afterCursor, total);
    } else {
      // limit == 0 , return total count of entity.
      return getResultList(entities, null, null, total);
    }
  }

  @Transaction
  public final ResultList<T> listBefore(
      UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String before) throws IOException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = dao.listBefore(filter, limitParam + 1, RestUtil.decodeCursor(before));

    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      T entity = withHref(uriInfo, setFields(JsonUtils.readValue(json, entityClass), fields));
      entities.add(entity);
    }
    int total = dao.listCount(filter);

    String beforeCursor = null;
    String afterCursor;
    if (entities.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      entities.remove(0);
      beforeCursor = getFullyQualifiedName(entities.get(0));
    }
    afterCursor = getFullyQualifiedName(entities.get(entities.size() - 1));
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public T getVersion(String id, String version) throws IOException {
    Double requestedVersion = Double.parseDouble(version);
    String extension = EntityUtil.getVersionExtension(entityType, requestedVersion);

    // Get previous version from version history
    String json = daoCollection.entityExtensionDAO().getEntityVersion(id, extension);
    if (json != null) {
      return JsonUtils.readValue(json, entityClass);
    }
    // If requested the latest version, return it from current version of the entity
    T entity = setFields(dao.findEntityById(UUID.fromString(id), ALL), putFields);
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    if (entityInterface.getVersion().equals(requestedVersion)) {
      return entity;
    }
    throw EntityNotFoundException.byMessage(
        CatalogExceptionMessage.entityVersionNotFound(entityType, id, requestedVersion));
  }

  @Transaction
  public EntityHistory listVersions(String id) throws IOException {
    T latest = setFields(dao.findEntityById(UUID.fromString(id), ALL), putFields);
    String extensionPrefix = EntityUtil.getVersionExtensionPrefix(entityType);
    List<EntityVersionPair> oldVersions = daoCollection.entityExtensionDAO().getEntityVersions(id, extensionPrefix);
    oldVersions.sort(EntityUtil.compareVersion.reversed());

    final List<Object> allVersions = new ArrayList<>();
    allVersions.add(JsonUtils.pojoToJson(latest));
    oldVersions.forEach(version -> allVersions.add(version.getEntityJson()));
    return new EntityHistory().withEntityType(entityType).withVersions(allVersions);
  }

  public final T create(UriInfo uriInfo, T entity) throws IOException {
    return withHref(uriInfo, createInternal(entity));
  }

  @Transaction
  public final T createInternal(T entity) throws IOException {
    prepare(entity);
    return createNewEntity(entity);
  }

  @Transaction
  public final PutResponse<T> createOrUpdate(UriInfo uriInfo, T updated) throws IOException {
    prepare(updated);
    EntityInterface<T> updatedInterface = getEntityInterface(updated);

    // Check if there is any original, deleted or not
    T original = JsonUtils.readValue(dao.findJsonByFqn(getFullyQualifiedName(updated), ALL), entityClass);
    if (original == null) {
      return new PutResponse<>(Status.CREATED, withHref(uriInfo, createNewEntity(updated)), RestUtil.ENTITY_CREATED);
    }
    // Get all the fields in the original entity that can be updated during PUT operation
    setFields(original, putFields);

    // If the entity state is soft-deleted, recursively undelete the entity and it's children
    EntityInterface<T> origInterface = getEntityInterface(original);
    if (origInterface.isDeleted()) {
      restoreEntity(updatedInterface.getUpdatedBy(), entityType, origInterface.getId());
    }

    // Update the attributes and relationships of an entity
    EntityUpdater entityUpdater = getUpdater(original, updated, Operation.PUT);
    entityUpdater.update();
    String change = entityUpdater.fieldsChanged() ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    return new PutResponse<>(Status.OK, withHref(uriInfo, updated), change);
  }

  @Transaction
  public final PatchResponse<T> patch(UriInfo uriInfo, UUID id, String user, JsonPatch patch) throws IOException {
    // Get all the fields in the original entity that can be updated during PATCH operation
    T original = setFields(dao.findEntityById(id), patchFields);

    // Apply JSON patch to the original entity to get the updated entity
    T updated = JsonUtils.applyPatch(original, patch, entityClass);
    EntityInterface<T> updatedEntity = getEntityInterface(updated);
    updatedEntity.setUpdateDetails(user, System.currentTimeMillis());

    prepare(updated);
    restorePatchAttributes(original, updated);

    // Update the attributes and relationships of an entity
    EntityUpdater entityUpdater = getUpdater(original, updated, Operation.PATCH);
    entityUpdater.update();
    String change = entityUpdater.fieldsChanged() ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    return new PatchResponse<>(Status.OK, withHref(uriInfo, updated), change);
  }

  @Transaction
  public PutResponse<T> addFollower(String updatedBy, UUID entityId, UUID userId) throws IOException {
    // Get entity
    T entity = dao.findEntityById(entityId);
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Validate follower
    User user = daoCollection.userDAO().findEntityById(userId);
    if (Boolean.TRUE.equals(user.getDeleted())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(userId));
    }

    // Add relationship
    int added = addRelationship(userId, entityId, Entity.USER, entityType, Relationship.FOLLOWS);

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entityInterface.getVersion());
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("followers").withNewValue(List.of(Entity.getEntityReference(user))));

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(entityType)
            .withEntityId(entityId)
            .withEntityFullyQualifiedName(entityInterface.getFullyQualifiedName())
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(entityInterface.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    return new PutResponse<>(added > 0 ? Status.CREATED : Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  @Transaction
  public final DeleteResponse<T> delete(String updatedBy, String id, boolean recursive, boolean hardDelete)
      throws IOException {
    return delete(updatedBy, id, recursive, hardDelete, false);
  }

  @Transaction
  public final DeleteResponse<T> delete(
      String updatedBy, String id, boolean recursive, boolean hardDelete, boolean internal) throws IOException {
    // Validate entity
    String json = dao.findJsonById(id, hardDelete ? Include.ALL : Include.NON_DELETED);
    if (json == null) {
      if (!internal) {
        throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(entityType, id));
      } else {
        return null; // Maybe already deleted
      }
    }

    T original = JsonUtils.readValue(json, entityClass);
    setFields(original, putFields); // TODO why this?

    // If an entity being deleted contains other **non-deleted** children entities, it can't be deleted
    List<EntityReference> contains =
        daoCollection.relationshipDAO().findTo(id, entityType, Relationship.CONTAINS.ordinal());

    if (!contains.isEmpty()) {
      if (!recursive) {
        throw new IllegalArgumentException(entityType + " is not empty");
      }
      // Soft delete all the contained entities
      for (EntityReference entityReference : contains) {
        LOG.info("Recursively deleting {} {}", entityReference.getType(), entityReference.getId());
        Entity.deleteEntity(updatedBy, entityReference.getType(), entityReference.getId(), true, hardDelete, true);
      }
    }

    String changeType;
    T updated = JsonUtils.readValue(json, entityClass);
    EntityInterface<T> entityInterface = getEntityInterface(updated);
    if (supportsSoftDelete && hardDelete == false) {
      entityInterface.setUpdateDetails(updatedBy, System.currentTimeMillis());
      entityInterface.setDeleted(true);
      EntityUpdater updater = getUpdater(original, updated, Operation.SOFT_DELETE);
      updater.update();
      changeType = RestUtil.ENTITY_SOFT_DELETED;
    } else {
      // Hard delete
      daoCollection.relationshipDAO().deleteAll(id, entityType);
      daoCollection.fieldRelationshipDAO().deleteAllByPrefix(entityInterface.getFullyQualifiedName());
      daoCollection.entityExtensionDAO().deleteAll(id);
      dao.delete(id);
      changeType = RestUtil.ENTITY_DELETED;
    }
    return new DeleteResponse<>(updated, changeType);
  }

  @Transaction
  public PutResponse<T> deleteFollower(String updatedBy, UUID entityId, UUID userId) throws IOException {
    T entity = dao.findEntityById(entityId);
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Validate follower
    User user = daoCollection.userDAO().findEntityById(userId);

    // Remove follower
    daoCollection
        .relationshipDAO()
        .delete(userId.toString(), Entity.USER, entityId.toString(), entityType, Relationship.FOLLOWS.ordinal());

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entityInterface.getVersion());
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName("followers").withOldValue(List.of(Entity.getEntityReference(user))));

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityFullyQualifiedName(entityInterface.getFullyQualifiedName())
            .withEntityType(entityType)
            .withEntityId(entityId)
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(entityInterface.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    return new PutResponse<>(Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public final String getFullyQualifiedName(T entity) {
    return getEntityInterface(entity).getFullyQualifiedName();
  }

  public final ResultList<T> getResultList(List<T> entities, String beforeCursor, String afterCursor, int total) {
    return new ResultList<>(entities, beforeCursor, afterCursor, total);
  }

  private T createNewEntity(T entity) throws IOException {
    storeEntity(entity, false);
    storeRelationships(entity);
    return entity;
  }

  protected void store(UUID id, T entity, boolean update) throws JsonProcessingException {
    if (update) {
      dao.update(id, JsonUtils.pojoToJson(entity));
    } else {
      dao.insert(entity);
    }
  }

  /** Validate given list of tags and add derived tags to it */
  public final List<TagLabel> addDerivedTags(List<TagLabel> tagLabels) throws IOException {
    if (tagLabels == null || tagLabels.isEmpty()) {
      return tagLabels;
    }

    List<TagLabel> updatedTagLabels = new ArrayList<>();
    for (TagLabel tagLabel : tagLabels) {
      TagLabel existingTag =
          updatedTagLabels.stream().filter(c -> tagLabelMatch.test(c, tagLabel)).findAny().orElse(null);
      if (existingTag != null) {
        continue; // tag label is already seen. Don't add duplicate tags.
      }

      updatedTagLabels.add(tagLabel);
      if (tagLabel.getSource() != Source.TAG) {
        continue; // Related tags are not supported for Glossary yet
      }
      String json = daoCollection.tagDAO().findTag(tagLabel.getTagFQN());
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(), tagLabel.getTagFQN()));
      }
      Tag tag = JsonUtils.readValue(json, Tag.class);

      // Apply derived tags
      List<TagLabel> derivedTags = getDerivedTags(tagLabel, tag);
      EntityUtil.mergeTags(updatedTagLabels, derivedTags);
    }
    updatedTagLabels.sort(compareTagLabel);
    return updatedTagLabels;
  }

  /** Get tags associated with a given set of tags */
  private List<TagLabel> getDerivedTags(TagLabel tagLabel, Tag tag) throws IOException {
    List<TagLabel> derivedTags = new ArrayList<>();
    for (String fqn : listOrEmpty(tag.getAssociatedTags())) {
      String json = daoCollection.tagDAO().findTag(fqn);
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(), fqn));
      }
      Tag tempTag = JsonUtils.readValue(json, Tag.class);
      derivedTags.add(
          new TagLabel()
              .withTagFQN(fqn)
              .withState(tagLabel.getState())
              .withDescription(tempTag.getDescription())
              .withLabelType(LabelType.DERIVED));
    }
    return derivedTags;
  }

  protected void applyTags(T entity) {
    if (supportsTags) {
      // Add entity level tags by adding tag to the entity relationship
      EntityInterface<T> entityInterface = getEntityInterface(entity);
      applyTags(entityInterface.getTags(), entityInterface.getFullyQualifiedName());
      // Update tag to handle additional derived tags
      entityInterface.setTags(getTags(entityInterface.getFullyQualifiedName()));
    }
  }

  /** Apply tags {@code tagLabels} to the entity or field identified by {@code targetFQN} */
  public void applyTags(List<TagLabel> tagLabels, String targetFQN) {
    for (TagLabel tagLabel : listOrEmpty(tagLabels)) {
      String json = null;
      if (tagLabel.getSource() == Source.TAG) {
        json = daoCollection.tagDAO().findTag(tagLabel.getTagFQN());
      } else if (tagLabel.getSource() == Source.GLOSSARY) {
        json = daoCollection.glossaryTermDAO().findJsonByFqn(tagLabel.getTagFQN(), Include.NON_DELETED);
      }

      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(), tagLabel.getTagFQN()));
      }

      // Apply tagLabel to targetFQN that identifies an entity or field
      daoCollection
          .tagDAO()
          .applyTag(
              tagLabel.getSource().ordinal(),
              tagLabel.getTagFQN(),
              targetFQN,
              tagLabel.getLabelType().ordinal(),
              tagLabel.getState().ordinal());
    }
  }

  protected List<TagLabel> getTags(String fqn) {
    return !supportsTags ? null : daoCollection.tagDAO().getTags(fqn);
  }

  protected List<EntityReference> getFollowers(T entity) throws IOException {
    if (!supportsFollower || entity == null) {
      return null;
    }
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    List<EntityReference> followers = findFrom(entityInterface.getId(), entityType, Relationship.FOLLOWS);
    for (EntityReference follower : followers) {
      User user = daoCollection.userDAO().findEntityById(follower.getId(), ALL);
      follower.withName(user.getName()).withDeleted(user.getDeleted());
    }
    return followers;
  }

  public T withHref(UriInfo uriInfo, T entity) {
    if (uriInfo == null) {
      return entity;
    }
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    return entityInterface.withHref(getHref(uriInfo, entityInterface.getId()));
  }

  public URI getHref(UriInfo uriInfo, UUID id) {
    return RestUtil.getHref(uriInfo, collectionPath, id);
  }

  public void restoreEntity(String updatedBy, String entityType, UUID id) throws IOException {
    // If an entity being restored contains other **deleted** children entities, restore them
    List<EntityReference> contains =
        daoCollection.relationshipDAO().findTo(id.toString(), entityType, Relationship.CONTAINS.ordinal());

    if (!contains.isEmpty()) {
      // Restore all the contained entities
      for (EntityReference entityReference : contains) {
        LOG.info("Recursively restoring {} {}", entityReference.getType(), entityReference.getId());
        Entity.restoreEntity(updatedBy, entityReference.getType(), entityReference.getId());
      }
    }

    // Finally set entity deleted flag to false
    T entity = dao.findEntityById(id, DELETED);
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    entityInterface.setDeleted(false);
    dao.update(entityInterface.getId(), JsonUtils.pojoToJson(entity));
  }

  public int addRelationship(UUID fromId, UUID toId, String fromEntity, String toEntity, Relationship relationship) {
    return addRelationship(fromId, toId, fromEntity, toEntity, relationship, false);
  }

  public int addRelationship(
      UUID fromId, UUID toId, String fromEntity, String toEntity, Relationship relationship, boolean bidirectional) {
    UUID from = fromId;
    UUID to = toId;
    if (bidirectional && fromId.compareTo(toId) > 0) {
      // For bidirectional relationship, instead of adding two row fromId -> toId and toId -> fromId, just add one
      // row where fromId is alphabetically less than toId
      from = toId;
      to = fromId;
    }
    return daoCollection.relationshipDAO().insert(from, to, fromEntity, toEntity, relationship.ordinal());
  }

  public List<String> findBoth(UUID entity1, String entityType1, Relationship relationship, String entity2) {
    // Find bidirectional relationship
    List<String> ids = new ArrayList<>();
    ids.addAll(findFrom(entity1, entityType1, relationship, entity2));
    ids.addAll(findTo(entity1, entityType1, relationship, entity2));
    return ids;
  }

  public List<String> findFrom(UUID toId, String toEntityType, Relationship relationship, String fromEntityType) {
    return daoCollection
        .relationshipDAO()
        .findFrom(toId.toString(), toEntityType, relationship.ordinal(), fromEntityType);
  }

  public List<EntityReference> findFrom(UUID toId, String toEntityType, Relationship relationship) {
    return daoCollection.relationshipDAO().findFrom(toId.toString(), toEntityType, relationship.ordinal());
  }

  public EntityReference getContainer(UUID toId, String toEntityType) throws IOException {
    List<EntityReference> refs = findFrom(toId, toEntityType, Relationship.CONTAINS);
    // An entity can have only one container
    ensureSingleRelationship(toEntityType, toId, refs, "container", true);
    return Entity.getEntityReferenceById(refs.get(0).getType(), refs.get(0).getId(), ALL);
  }

  public void ensureSingleRelationship(
      String entityType, UUID id, List<?> relations, String relationshipName, boolean mustHaveRelationship) {
    // An entity can have only one container
    if (mustHaveRelationship && relations.size() == 0) {
      throw new UnhandledServerException(CatalogExceptionMessage.entityTypeNotFound(entityType));
    }
    if (!mustHaveRelationship && relations.isEmpty()) {
      return;
    }
    if (relations.size() != 1) {
      LOG.warn("Possible database issues - multiple relations {} for entity {}:{}", relationshipName, entityType, id);
    }
  }

  public List<String> findTo(UUID fromId, String fromEntityType, Relationship relationship, String toEntityType) {
    return daoCollection
        .relationshipDAO()
        .findTo(fromId.toString(), fromEntityType, relationship.ordinal(), toEntityType);
  }

  public void deleteTo(UUID toId, String toEntityType, Relationship relationship, String fromEntityType) {
    daoCollection.relationshipDAO().deleteTo(toId.toString(), toEntityType, relationship.ordinal(), fromEntityType);
  }

  public void deleteFrom(UUID fromId, String fromEntityType, Relationship relationship, String toEntityType) {
    // Remove relationships from original
    daoCollection.relationshipDAO().deleteFrom(fromId.toString(), fromEntityType, relationship.ordinal(), toEntityType);
  }

  public void validateUsers(List<EntityReference> entityReferences) throws IOException {
    if (entityReferences != null) {
      entityReferences.sort(EntityUtil.compareEntityReference);
      for (EntityReference entityReference : entityReferences) {
        EntityReference ref = daoCollection.userDAO().findEntityReferenceById(entityReference.getId());
        entityReference.withType(ref.getType()).withName(ref.getName()).withDisplayName(ref.getDisplayName());
      }
    }
  }

  public void validateRoles(List<EntityReference> entityReferences) throws IOException {
    if (entityReferences != null) {
      entityReferences.sort(EntityUtil.compareEntityReference);
      for (EntityReference entityReference : entityReferences) {
        EntityReference ref = daoCollection.roleDAO().findEntityReferenceById(entityReference.getId());
        entityReference.withType(ref.getType()).withName(ref.getName()).withDisplayName(ref.getDisplayName());
      }
    }
  }

  public EntityReference getOwner(T entity) throws IOException {
    if (!supportsOwner) {
      return null;
    }
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    List<EntityReference> refs = findFrom(entityInterface.getId(), entityType, Relationship.OWNS);
    ensureSingleRelationship(entityType, entityInterface.getId(), refs, "owners", false);
    return refs.isEmpty() ? null : getOwner(refs.get(0));
  }

  public EntityReference getOwner(EntityReference ref) throws IOException {
    return Entity.getEntityReferenceById(ref.getType(), ref.getId(), ALL);
  }

  public EntityReference getOriginalOwner(T entity) throws IOException {
    if (!supportsOwner) {
      return null;
    }
    // Try to find the owner if entity exists
    try {
      String fqn = getFullyQualifiedName(entity);
      entity = getByName(null, fqn, getFields(FIELD_OWNER));
      return getEntityInterface(entity).getOwner();
    } catch (EntityNotFoundException e) {
      // If entity is not found, we can return null for owner and ignore this exception
    }
    return null;
  }

  public EntityReference populateOwner(EntityReference owner) throws IOException {
    if (owner == null) {
      return null;
    }
    EntityReference ref = Entity.getEntityReferenceById(owner.getType(), owner.getId(), ALL);
    return owner.withName(ref.getName()).withDisplayName(ref.getDisplayName()).withDeleted(ref.getDeleted());
  }

  protected void storeOwner(T entity, EntityReference owner) {
    if (supportsOwner) {
      EntityInterface<T> entityInterface = getEntityInterface(entity);
      // Add relationship owner --- owns ---> ownedEntity
      if (owner != null) {
        LOG.info(
            "Adding owner {}:{} for entity {}:{}", owner.getType(), owner.getId(), entityType, entityInterface.getId());
        addRelationship(owner.getId(), entityInterface.getId(), owner.getType(), entityType, Relationship.OWNS);
      }
    }
  }

  /** Remove owner relationship for a given entity */
  private void removeOwner(T entity, EntityReference owner) {
    if (owner != null && owner.getId() != null) {
      EntityInterface<T> entityInterface = getEntityInterface(entity);
      LOG.info("Removing owner {}:{} for entity {}", owner.getType(), owner.getId(), entityInterface.getId());
      daoCollection
          .relationshipDAO()
          .delete(
              owner.getId().toString(),
              owner.getType(),
              entityInterface.getId().toString(),
              entityType,
              Relationship.OWNS.ordinal());
    }
  }

  public void updateOwner(T ownedEntity, EntityReference originalOwner, EntityReference newOwner) {
    // TODO inefficient use replace instead of delete and add and check for orig and new owners being the same
    removeOwner(ownedEntity, originalOwner);
    storeOwner(ownedEntity, newOwner);
  }

  public final Fields getFields(String fields) {
    return new Fields(allowedFields, fields);
  }

  enum Operation {
    PUT,
    PATCH,
    SOFT_DELETE;

    public boolean isPatch() {
      return this == PATCH;
    }

    public boolean isPut() {
      return this == PUT;
    }

    public boolean isDelete() {
      return this == SOFT_DELETE;
    }
  }

  /**
   * Class that performs PUT and PATCH update operation. It takes an <i>updated</i> entity and <i>original</i> entity.
   * Performs comparison between then and updates the stored entity and also updates all the relationships. This class
   * also tracks the changes between original and updated to version the entity and produce change events. <br>
   * <br>
   * Common entity attributes such as description, displayName, owner, tags are handled by this class. Override {@code
   * entitySpecificUpdate()} to add additional entity specific fields to be updated.
   *
   * @see TableUpdater#entitySpecificUpdate() for example.
   */
  public class EntityUpdater {
    protected final EntityInterface<T> original;
    protected final EntityInterface<T> updated;
    protected final Operation operation;
    protected final ChangeDescription changeDescription = new ChangeDescription();
    protected boolean majorVersionChange = false;
    private boolean entityRestored = false;

    public EntityUpdater(T original, T updated, Operation operation) {
      this.original = getEntityInterface(original);
      this.updated = getEntityInterface(updated);
      this.operation = operation;
    }

    /** Compare original and updated entities and perform updates. Update the entity version and track changes. */
    public final void update() throws IOException {
      if (operation.isDelete()) { // DELETE Operation
        updateDeleted();
      } else { // PUT or PATCH operations
        updated.setId(original.getId());
        updateDeleted();
        updateDescription();
        updateDisplayName();
        updateOwner();
        updateTags(updated.getFullyQualifiedName(), "tags", original.getTags(), updated.getTags());
        entitySpecificUpdate();
      }

      // Store the updated entity
      storeUpdate();
    }

    public void entitySpecificUpdate() throws IOException {
      // Default implementation. Override this to add any entity specific field updates
    }

    private void updateDescription() throws JsonProcessingException {
      if (operation.isPut()
          && original.getDescription() != null
          && !original.getDescription().isEmpty()
          && !allowEdits) {
        // Update description only when stored is empty to retain user authored descriptions
        updated.setDescription(original.getDescription());
        return;
      }
      recordChange(FIELD_DESCRIPTION, original.getDescription(), updated.getDescription());
    }

    private void updateDeleted() throws JsonProcessingException {
      if (operation.isPut() || operation.isPatch()) {
        // Update operation can't set delete attributed to true. This can only be done as part of delete operation
        if (updated.isDeleted() != original.isDeleted() && Boolean.TRUE.equals(updated.isDeleted())) {
          throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(entityType, "deleted"));
        }
        // PUT or PATCH is restoring the soft-deleted entity
        if (Boolean.TRUE.equals(original.isDeleted())) {
          updated.setDeleted(false);
          recordChange("deleted", true, false);
          entityRestored = true;
        }
      } else {
        recordChange("deleted", original.isDeleted(), updated.isDeleted());
      }
    }

    private void updateDisplayName() throws JsonProcessingException {
      if (operation.isPut()
          && original.getDisplayName() != null
          && !original.getDisplayName().isEmpty()
          && !allowEdits) {
        // Update displayName only when stored is empty to retain user authored descriptions
        updated.setDisplayName(original.getDisplayName());
        return;
      }
      recordChange("displayName", original.getDisplayName(), updated.getDisplayName());
    }

    private void updateOwner() throws JsonProcessingException {
      EntityReference origOwner = original.getOwner();
      EntityReference updatedOwner = updated.getOwner();
      if (operation.isPatch() || updatedOwner != null) {
        // Update owner for all PATCH operations. For PUT operations, ownership can't be removed
        if (recordChange(FIELD_OWNER, origOwner, updatedOwner, true, entityReferenceMatch)) {
          EntityRepository.this.updateOwner(original.getEntity(), origOwner, updatedOwner);
        }
      }
    }

    protected final void updateTags(String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags)
        throws IOException {
      // Remove current entity tags in the database. It will be added back later from the merged tag list.
      origTags = listOrEmpty(origTags);
      // updatedTags cannot be immutable list, as we are adding the origTags to updatedTags even if its empty.
      updatedTags = Optional.ofNullable(updatedTags).orElse(new ArrayList<>());
      if (origTags.isEmpty() && updatedTags.isEmpty()) {
        return; // Nothing to update
      }

      // Remove current entity tags in the database. It will be added back later from the merged tag list.
      daoCollection.tagDAO().deleteTags(fqn);

      if (operation.isPut()) {
        // PUT operation merges tags in the request with what already exists
        EntityUtil.mergeTags(updatedTags, origTags);
      }

      List<TagLabel> addedTags = new ArrayList<>();
      List<TagLabel> deletedTags = new ArrayList<>();
      recordListChange(fieldName, origTags, updatedTags, addedTags, deletedTags, tagLabelMatch);
      updatedTags.sort(compareTagLabel);
      applyTags(updatedTags, fqn);
    }

    public final boolean updateVersion(Double oldVersion) {
      Double newVersion = oldVersion;
      if (majorVersionChange) {
        newVersion = nextMajorVersion(oldVersion);
      } else if (fieldsChanged()) {
        newVersion = nextVersion(oldVersion);
      }
      LOG.info(
          "{} {}->{} - Fields added {}, updated {}, deleted {}",
          original.getId(),
          oldVersion,
          newVersion,
          changeDescription.getFieldsAdded(),
          changeDescription.getFieldsUpdated(),
          changeDescription.getFieldsDeleted());
      changeDescription.withPreviousVersion(oldVersion);
      updated.setChangeDescription(newVersion, changeDescription);
      return !newVersion.equals(oldVersion);
    }

    public boolean fieldsChanged() {
      return !changeDescription.getFieldsAdded().isEmpty()
          || !changeDescription.getFieldsUpdated().isEmpty()
          || !changeDescription.getFieldsDeleted().isEmpty();
    }

    public boolean isEntityRestored() {
      return entityRestored;
    }

    public final <K> boolean recordChange(String field, K orig, K updated) throws JsonProcessingException {
      return recordChange(field, orig, updated, false, objectMatch);
    }

    public final <K> boolean recordChange(String field, K orig, K updated, boolean jsonValue)
        throws JsonProcessingException {
      return recordChange(field, orig, updated, jsonValue, objectMatch);
    }

    public final <K> boolean recordChange(
        String field, K orig, K updated, boolean jsonValue, BiPredicate<K, K> typeMatch)
        throws JsonProcessingException {
      if (orig == null && updated == null) {
        return false;
      }
      FieldChange fieldChange =
          new FieldChange()
              .withName(field)
              .withOldValue(jsonValue ? JsonUtils.pojoToJson(orig) : orig)
              .withNewValue(jsonValue ? JsonUtils.pojoToJson(updated) : updated);
      if (orig == null) {
        changeDescription.getFieldsAdded().add(fieldChange);
        return true;
      } else if (updated == null) {
        changeDescription.getFieldsDeleted().add(fieldChange);
        return true;
      } else if (!typeMatch.test(orig, updated)) {
        changeDescription.getFieldsUpdated().add(fieldChange);
        return true;
      }
      return false;
    }

    public final <K> boolean recordListChange(
        String field,
        List<K> origList,
        List<K> updatedList,
        List<K> addedItems,
        List<K> deletedItems,
        BiPredicate<K, K> typeMatch)
        throws JsonProcessingException {
      origList = listOrEmpty(origList);
      updatedList = listOrEmpty(updatedList);
      for (K stored : origList) {
        // If an entry in the original list is not in updated list, then it is deleted during update
        K u = updatedList.stream().filter(c -> typeMatch.test(c, stored)).findAny().orElse(null);
        if (u == null) {
          deletedItems.add(stored);
        }
      }

      for (K U : updatedList) {
        // If an entry in the updated list is not in original list, then it is added during update
        K stored = origList.stream().filter(c -> typeMatch.test(c, U)).findAny().orElse(null);
        if (stored == null) { // New column added
          addedItems.add(U);
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
      return !addedItems.isEmpty() || !deletedItems.isEmpty();
    }

    /**
     * Remove `fromEntityType:fromId` -- `relationType` ---> `toEntityType:origToRefs` Add `fromEntityType:fromId` --
     * `relationType` ---> `toEntityType:updatedToRefs` and record it as change for entity field `field`.
     *
     * <p>When `bidirectional` is set to true, relationship from both side are replaced
     */
    public final void updateToRelationships(
        String field,
        String fromEntityType,
        UUID fromId,
        Relationship relationshipType,
        String toEntityType,
        List<EntityReference> origToRefs,
        List<EntityReference> updatedToRefs,
        boolean bidirectional)
        throws JsonProcessingException {
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      if (!recordListChange(field, origToRefs, updatedToRefs, added, deleted, entityReferenceMatch)) {
        // No changes between original and updated.
        return;
      }
      // Remove relationships from original
      deleteFrom(fromId, fromEntityType, relationshipType, toEntityType);
      if (bidirectional) {
        deleteTo(fromId, fromEntityType, relationshipType, toEntityType);
      }
      // Add relationships from updated
      for (EntityReference ref : updatedToRefs) {
        addRelationship(fromId, ref.getId(), fromEntityType, toEntityType, relationshipType, bidirectional);
      }
      updatedToRefs.sort(EntityUtil.compareEntityReference);
      origToRefs.sort(EntityUtil.compareEntityReference);
    }

    /**
     * Remove `fromEntityType:origFromRefs` -- `relationType` ---> `toEntityType:toId` Add
     * `fromEntityType:updatedFromRefs` -- `relationType` ---> `toEntityType:toId` and record it as change for entity
     * field `field`.
     */
    public final void updateFromRelationships(
        String field,
        String fromEntityType,
        List<EntityReference> originFromRefs,
        List<EntityReference> updatedFromRefs,
        Relationship relationshipType,
        String toEntityType,
        UUID toId)
        throws JsonProcessingException {
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      if (!recordListChange(field, originFromRefs, updatedFromRefs, added, deleted, entityReferenceMatch)) {
        // No changes between original and updated.
        return;
      }
      // Remove relationships from original
      deleteTo(toId, toEntityType, relationshipType, fromEntityType);

      // Add relationships from updated
      for (EntityReference ref : updatedFromRefs) {
        addRelationship(ref.getId(), toId, fromEntityType, toEntityType, relationshipType);
      }
      updatedFromRefs.sort(EntityUtil.compareEntityReference);
      originFromRefs.sort(EntityUtil.compareEntityReference);
    }

    public final void storeUpdate() throws IOException {
      if (updateVersion(original.getVersion())) { // Update changed the entity version
        storeOldVersion(); // Store old version for listing previous versions of the entity
        storeNewVersion(); // Store the update version of the entity
      } else { // Update did not change the entity version
        updated.setUpdateDetails(original.getUpdatedBy(), original.getUpdatedAt());
      }
    }

    private void storeOldVersion() throws JsonProcessingException {
      String extensionName = EntityUtil.getVersionExtension(entityType, original.getVersion());
      daoCollection
          .entityExtensionDAO()
          .insert(original.getId().toString(), extensionName, entityType, JsonUtils.pojoToJson(original.getEntity()));
    }

    private void storeNewVersion() throws IOException {
      EntityRepository.this.storeEntity(updated.getEntity(), true);
    }
  }
}
