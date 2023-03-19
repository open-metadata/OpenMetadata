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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.DELETED;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_DELETED;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.getEntityFields;
import static org.openmetadata.service.exception.CatalogExceptionMessage.csvNotSupported;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.getColumnField;
import static org.openmetadata.service.util.EntityUtil.getExtensionField;
import static org.openmetadata.service.util.EntityUtil.nextMajorVersion;
import static org.openmetadata.service.util.EntityUtil.nextVersion;
import static org.openmetadata.service.util.EntityUtil.objectMatch;
import static org.openmetadata.service.util.EntityUtil.tagLabelMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityVersionPair;
import org.openmetadata.service.jdbi3.CollectionDAO.ExtensionRecord;
import org.openmetadata.service.resources.tags.TagLabelCache;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ResultList;

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
 * org.openmetadata.service.jdbi3.CollectionDAO.TableDAO} is used as the DAO object to access the table_entity table.
 * All DAO objects for an entity are available in {@code daoCollection}. <br>
 * <br>
 * Relationships between entity is stored in a separate table that captures the edge - fromEntity, toEntity, and the
 * relationship name <i>entity_relationship</i> table and are supported by {@link
 * org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipDAO} DAO object.
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
public abstract class EntityRepository<T extends EntityInterface> {
  private final String collectionPath;
  private final Class<T> entityClass;
  protected final String entityType;
  public final EntityDAO<T> dao;
  protected final CollectionDAO daoCollection;
  @Getter protected final List<String> allowedFields;
  public final boolean supportsSoftDelete;
  @Getter protected final boolean supportsTags;
  @Getter protected final boolean supportsOwner;
  protected final boolean supportsFollower;

  /** Fields that can be updated during PATCH operation */
  @Getter private final Fields patchFields;

  /** Fields that can be updated during PUT operation */
  @Getter protected final Fields putFields;

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

    this.supportsTags = allowedFields.contains(FIELD_TAGS);
    this.supportsOwner = allowedFields.contains(FIELD_OWNER);
    this.supportsSoftDelete = allowedFields.contains(FIELD_DELETED);
    this.supportsFollower = allowedFields.contains(FIELD_FOLLOWERS);
    Entity.registerEntity(entityClass, entityType, dao, this);
  }

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
  public abstract void storeRelationships(T entity) throws IOException;

  /**
   * PATCH operations can't overwrite certain fields, such as entity ID, fullyQualifiedNames etc. Instead of throwing an
   * error, we take lenient approach of ignoring the user error and restore those attributes based on what is already
   * stored in the original entity.
   */
  public void restorePatchAttributes(T original, T updated) {
    /* Nothing to restore during PATCH */
  }

  /** Set fullyQualifiedName of an entity */
  public void setFullyQualifiedName(T entity) {
    entity.setFullyQualifiedName(entity.getName());
  }

  /**
   * Initialize data from json files if seed data does not exist in corresponding tables. Seed data is stored under
   * openmetadata-service/src/main/resources/json/data/{entityType}
   *
   * <p>This method needs to be explicitly called, typically from initialize method. See {@link
   * org.openmetadata.service.resources.teams.RoleResource#initialize(OpenMetadataApplicationConfig)}
   */
  public void initSeedDataFromResources() throws IOException {
    List<T> entities = getEntitiesFromSeedData();
    for (T entity : entities) {
      initializeEntity(entity);
    }
  }

  public List<T> getEntitiesFromSeedData() throws IOException {
    return getEntitiesFromSeedData(String.format(".*json/data/%s/.*\\.json$", entityType));
  }

  public List<T> getEntitiesFromSeedData(String path) throws IOException {
    return getEntitiesFromSeedData(entityType, path, entityClass);
  }

  public static <U> List<U> getEntitiesFromSeedData(String entityType, String path, Class<U> clazz) throws IOException {
    List<U> entities = new ArrayList<>();
    List<String> jsonDataFiles = EntityUtil.getJsonDataResources(path);
    jsonDataFiles.forEach(
        jsonDataFile -> {
          try {
            String json = CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), jsonDataFile);
            json = json.replace("<separator>", Entity.SEPARATOR);
            entities.add(JsonUtils.readValue(json, clazz));
          } catch (Exception e) {
            LOG.warn("Failed to initialize the {} from file {}", entityType, jsonDataFile, e);
          }
        });
    return entities;
  }

  /** Initialize a given entity if it does not exist. */
  @Transaction
  public void initializeEntity(T entity) throws IOException {
    String existingJson = dao.findJsonByFqn(entity.getFullyQualifiedName(), ALL);
    if (existingJson != null) {
      LOG.info("{} {} is already initialized", entityType, entity.getFullyQualifiedName());
      return;
    }

    LOG.info("{} {} is not initialized", entityType, entity.getFullyQualifiedName());
    entity.setUpdatedBy(ADMIN_USER_NAME);
    entity.setUpdatedAt(System.currentTimeMillis());
    entity.setId(UUID.randomUUID());
    create(null, entity);
    LOG.info("Created a new {} {}", entityType, entity.getFullyQualifiedName());
  }

  public EntityUpdater getUpdater(T original, T updated, Operation operation) {
    return new EntityUpdater(original, updated, operation);
  }

  @Transaction
  public final T get(UriInfo uriInfo, UUID id, Fields fields) throws IOException {
    return get(uriInfo, id, fields, NON_DELETED);
  }

  @Transaction
  public final T get(UriInfo uriInfo, UUID id, Fields fields, Include include) throws IOException {
    return withHref(uriInfo, setFieldsInternal(dao.findEntityById(id, include), fields));
  }

  @Transaction
  public final T findOrNull(UUID id, String fields, Include include) throws IOException {
    String json = dao.findJsonById(id, include);
    return json == null ? null : setFieldsInternal(JsonUtils.readValue(json, entityClass), getFields(fields));
  }

  @Transaction
  public final T getByName(UriInfo uriInfo, String fqn, Fields fields) throws IOException {
    return getByName(uriInfo, fqn, fields, NON_DELETED);
  }

  @Transaction
  public final T getByName(UriInfo uriInfo, String fqn, Fields fields, Include include) throws IOException {
    return withHref(uriInfo, setFieldsInternal(dao.findEntityByName(fqn, include), fields));
  }

  @Transaction
  public final T findByNameOrNull(String fqn, String fields, Include include) {
    String json = dao.findJsonByFqn(fqn, include);
    try {
      return json == null ? null : setFieldsInternal(JsonUtils.readValue(json, entityClass), getFields(fields));
    } catch (IOException e) {
      return null;
    }
  }

  @Transaction
  public final List<T> listAll(Fields fields, ListFilter filter) throws IOException {
    // forward scrolling, if after == null then first page is being asked
    List<String> jsons = dao.listAfter(filter, Integer.MAX_VALUE, "");
    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      T entity = setFieldsInternal(JsonUtils.readValue(json, entityClass), fields);
      entities.add(entity);
    }
    return entities;
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
        T entity = withHref(uriInfo, setFieldsInternal(JsonUtils.readValue(json, entityClass), fields));
        entities.add(entity);
      }

      String beforeCursor;
      String afterCursor = null;
      beforeCursor = after == null ? null : entities.get(0).getFullyQualifiedName();
      if (entities.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
        entities.remove(limitParam);
        afterCursor = entities.get(limitParam - 1).getFullyQualifiedName();
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
      T entity = withHref(uriInfo, setFieldsInternal(JsonUtils.readValue(json, entityClass), fields));
      entities.add(entity);
    }
    int total = dao.listCount(filter);

    String beforeCursor = null;
    String afterCursor;
    if (entities.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      entities.remove(0);
      beforeCursor = entities.get(0).getFullyQualifiedName();
    }
    afterCursor = entities.get(entities.size() - 1).getFullyQualifiedName();
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public T getVersion(UUID id, String version) throws IOException {
    Double requestedVersion = Double.parseDouble(version);
    String extension = EntityUtil.getVersionExtension(entityType, requestedVersion);

    // Get previous version from version history
    String json = daoCollection.entityExtensionDAO().getExtension(id.toString(), extension);
    if (json != null) {
      return JsonUtils.readValue(json, entityClass);
    }
    // If requested the latest version, return it from current version of the entity
    T entity = setFieldsInternal(dao.findEntityById(id, ALL), putFields);
    if (entity.getVersion().equals(requestedVersion)) {
      return entity;
    }
    throw EntityNotFoundException.byMessage(
        CatalogExceptionMessage.entityVersionNotFound(entityType, id, requestedVersion));
  }

  @Transaction
  public EntityHistory listVersions(UUID id) throws IOException {
    T latest = setFieldsInternal(dao.findEntityById(id, ALL), putFields);
    String extensionPrefix = EntityUtil.getVersionExtensionPrefix(entityType);
    List<ExtensionRecord> records = daoCollection.entityExtensionDAO().getExtensions(id.toString(), extensionPrefix);
    List<EntityVersionPair> oldVersions = new ArrayList<>();
    records.forEach(r -> oldVersions.add(new EntityVersionPair(r)));
    oldVersions.sort(EntityUtil.compareVersion.reversed());

    final List<Object> allVersions = new ArrayList<>();
    allVersions.add(JsonUtils.pojoToJson(latest));
    oldVersions.forEach(version -> allVersions.add(version.getEntityJson()));
    return new EntityHistory().withEntityType(entityType).withVersions(allVersions);
  }

  public final T create(UriInfo uriInfo, T entity) throws IOException {
    entity = withHref(uriInfo, createInternal(entity));
    postCreate(entity);
    return entity;
  }

  @Transaction
  public final T createInternal(T entity) throws IOException {
    prepareInternal(entity);
    return createNewEntity(entity);
  }

  public void prepareInternal(T entity) throws IOException {
    if (supportsTags) {
      entity.setTags(addDerivedTags(entity.getTags()));
      checkMutuallyExclusive(entity.getTags());
    }
    prepare(entity);
    setFullyQualifiedName(entity);
    validateExtension(entity);
  }

  T setFieldsInternal(T entity, Fields fields) throws IOException {
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    entity.setTags(fields.contains(FIELD_TAGS) ? getTags(entity.getFullyQualifiedName()) : null);
    entity.setExtension(fields.contains(FIELD_EXTENSION) ? getExtension(entity) : null);
    setFields(entity, fields);
    return entity;
  }

  @Transaction
  public final PutResponse<T> createOrUpdate(UriInfo uriInfo, T original, T updated) throws IOException {
    prepareInternal(updated);
    // Check if there is any original, deleted or not
    original = JsonUtils.readValue(dao.findJsonByFqn(original.getFullyQualifiedName(), ALL), entityClass);
    if (original == null) {
      return new PutResponse<>(Status.CREATED, withHref(uriInfo, createNewEntity(updated)), RestUtil.ENTITY_CREATED);
    }
    return update(uriInfo, original, updated);
  }

  public final PutResponse<T> createOrUpdate(UriInfo uriInfo, T updated) throws IOException {
    PutResponse<T> response = createOrUpdateInternal(uriInfo, updated);
    if (response.getStatus() == Status.CREATED) {
      postCreate(response.getEntity());
    } else if (response.getStatus() == Status.OK) {
      postUpdate(response.getEntity());
    }
    return response;
  }

  @Transaction
  public final PutResponse<T> createOrUpdateInternal(UriInfo uriInfo, T updated) throws IOException {
    // Check if there is any original, deleted or not
    T original = JsonUtils.readValue(dao.findJsonByFqn(updated.getFullyQualifiedName(), ALL), entityClass);
    if (original == null) {
      return new PutResponse<>(Status.CREATED, withHref(uriInfo, createNewEntity(updated)), RestUtil.ENTITY_CREATED);
    }
    return update(uriInfo, original, updated);
  }

  @SuppressWarnings("unused")
  protected void postCreate(T entity) {
    // Override to perform any operation required after creation.
    // For example ingestion pipeline creates a pipeline in AirFlow.
  }

  @SuppressWarnings("unused")
  protected void postUpdate(T entity) {
    // Override to perform any operation required after an entity update.
    // For example ingestion pipeline creates a pipeline in AirFlow.
  }

  @Transaction
  public PutResponse<T> update(UriInfo uriInfo, T original, T updated) throws IOException {
    // Get all the fields in the original entity that can be updated during PUT operation
    setFieldsInternal(original, putFields);

    // If the entity state is soft-deleted, recursively undelete the entity and it's children
    if (Boolean.TRUE.equals(original.getDeleted())) {
      restoreEntity(updated.getUpdatedBy(), entityType, original.getId());
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
    T original = setFieldsInternal(dao.findEntityById(id), patchFields);

    // Apply JSON patch to the original entity to get the updated entity
    T updated = JsonUtils.applyPatch(original, patch, entityClass);
    updated.setUpdatedBy(user);
    updated.setUpdatedAt(System.currentTimeMillis());

    prepareInternal(updated);
    populateOwner(updated.getOwner());
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

    // Validate follower
    User user = daoCollection.userDAO().findEntityById(userId);
    if (Boolean.TRUE.equals(user.getDeleted())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deletedUser(userId));
    }

    // Add relationship
    addRelationship(userId, entityId, Entity.USER, entityType, Relationship.FOLLOWS);

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entity.getVersion());
    fieldAdded(change, FIELD_FOLLOWERS, List.of(user.getEntityReference()));

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withEntity(entity)
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(entityType)
            .withEntityId(entityId)
            .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(entity.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    return new PutResponse<>(Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public final DeleteResponse<T> delete(String updatedBy, UUID id, boolean recursive, boolean hardDelete)
      throws IOException {
    DeleteResponse<T> response = deleteInternal(updatedBy, id, recursive, hardDelete);
    postDelete(response.getEntity());
    return response;
  }

  public final DeleteResponse<T> deleteByName(String updatedBy, String name, boolean recursive, boolean hardDelete)
      throws IOException {
    DeleteResponse<T> response = deleteInternalByName(updatedBy, name, recursive, hardDelete);
    postDelete(response.getEntity());
    return response;
  }

  protected void preDelete(T entity) {
    // Override this method to perform any operation required after deletion.
    // For example ingestion pipeline deletes a pipeline in AirFlow.
  }

  protected void postDelete(T entity) {
    // Override this method to perform any operation required after deletion.
    // For example ingestion pipeline deletes a pipeline in AirFlow.
  }

  private DeleteResponse<T> delete(String updatedBy, T original, boolean recursive, boolean hardDelete)
      throws IOException {
    checkSystemEntityDeletion(original);
    preDelete(original);
    setFieldsInternal(original, putFields);

    deleteChildren(original.getId(), recursive, hardDelete, updatedBy);

    String changeType;
    T updated = JsonUtils.readValue(JsonUtils.pojoToJson(original), entityClass);
    setFieldsInternal(updated, putFields); // we need service, database, databaseSchema to delete properly from ES.
    if (supportsSoftDelete && !hardDelete) {
      updated.setUpdatedBy(updatedBy);
      updated.setUpdatedAt(System.currentTimeMillis());
      updated.setDeleted(true);
      EntityUpdater updater = getUpdater(original, updated, Operation.SOFT_DELETE);
      updater.update();
      changeType = RestUtil.ENTITY_SOFT_DELETED;
    } else {
      cleanup(updated);
      changeType = RestUtil.ENTITY_DELETED;
    }
    LOG.info("{} deleted {}", hardDelete ? "Hard" : "Soft", updated.getFullyQualifiedName());
    return new DeleteResponse<>(updated, changeType);
  }

  @Transaction
  public final DeleteResponse<T> deleteInternalByName(
      String updatedBy, String name, boolean recursive, boolean hardDelete) throws IOException {
    // Validate entity
    T entity = dao.findEntityByName(name, ALL);
    return delete(updatedBy, entity, recursive, hardDelete);
  }

  @Transaction
  public final DeleteResponse<T> deleteInternal(String updatedBy, UUID id, boolean recursive, boolean hardDelete)
      throws IOException {
    // Validate entity
    T entity = dao.findEntityById(id, ALL);
    return delete(updatedBy, entity, recursive, hardDelete);
  }

  private void deleteChildren(UUID id, boolean recursive, boolean hardDelete, String updatedBy) throws IOException {
    // If an entity being deleted contains other **non-deleted** children entities, it can't be deleted
    List<EntityRelationshipRecord> records =
        daoCollection
            .relationshipDAO()
            .findTo(
                id.toString(), entityType, List.of(Relationship.CONTAINS.ordinal(), Relationship.PARENT_OF.ordinal()));

    if (records.isEmpty()) {
      return;
    }
    // Entity being deleted contains children entities
    if (!recursive) {
      throw new IllegalArgumentException(CatalogExceptionMessage.entityIsNotEmpty(entityType));
    }
    // Delete all the contained entities
    for (EntityRelationshipRecord entityRelationshipRecord : records) {
      LOG.info(
          "Recursively {} deleting {} {}",
          hardDelete ? "hard" : "soft",
          entityRelationshipRecord.getType(),
          entityRelationshipRecord.getId());
      Entity.deleteEntity(
          updatedBy, entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), true, hardDelete);
    }
  }

  protected void cleanup(T entityInterface) throws IOException {
    String id = entityInterface.getId().toString();

    // Delete all the relationships to other entities
    daoCollection.relationshipDAO().deleteAll(id, entityType);

    // Delete all the field relationships to other entities
    daoCollection.fieldRelationshipDAO().deleteAllByPrefix(entityInterface.getFullyQualifiedName());

    // Delete all the extensions of entity
    daoCollection.entityExtensionDAO().deleteAll(id);

    // Delete all the tag labels
    daoCollection.tagUsageDAO().deleteTagLabelsByTargetPrefix(entityInterface.getFullyQualifiedName());

    // Delete all the usage data
    daoCollection.usageDAO().delete(id);

    // Delete the extension data storing custom properties
    removeExtension(entityInterface);

    // Finally, delete the entity
    dao.delete(id);
  }

  @Transaction
  public PutResponse<T> deleteFollower(String updatedBy, UUID entityId, UUID userId) throws IOException {
    T entity = dao.findEntityById(entityId);

    // Validate follower
    User user = daoCollection.userDAO().findEntityById(userId);

    // Remove follower
    deleteRelationship(userId, Entity.USER, entityId, entityType, Relationship.FOLLOWS);

    ChangeDescription change = new ChangeDescription().withPreviousVersion(entity.getVersion());
    fieldDeleted(change, FIELD_FOLLOWERS, List.of(user.getEntityReference()));

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withEntity(entity)
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
            .withEntityType(entityType)
            .withEntityId(entityId)
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(entity.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    return new PutResponse<>(Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public final ResultList<T> getResultList(List<T> entities, String beforeCursor, String afterCursor, int total) {
    return new ResultList<>(entities, beforeCursor, afterCursor, total);
  }

  private T createNewEntity(T entity) throws IOException {
    storeEntity(entity, false);
    storeExtension(entity);
    storeRelationships(entity);
    return entity;
  }

  protected void store(T entity, boolean update) throws JsonProcessingException {
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withHref(null);
    EntityReference owner = entity.getOwner();
    entity.setOwner(null);
    List<TagLabel> tags = entity.getTags();
    entity.setTags(null);

    if (update) {
      dao.update(entity.getId(), JsonUtils.pojoToJson(entity));
      LOG.info("Updated {}:{}:{}", entityType, entity.getId(), entity.getFullyQualifiedName());
    } else {
      dao.insert(entity);
      LOG.info("Created {}:{}:{}", entityType, entity.getId(), entity.getFullyQualifiedName());
    }

    // Restore the relationships
    entity.setOwner(owner);
    entity.setTags(tags);
  }

  public void validateExtension(T entity) {
    if (entity.getExtension() == null) {
      return;
    }

    JsonNode jsonNode = JsonUtils.valueToTree(entity.getExtension());
    Iterator<Entry<String, JsonNode>> customFields = jsonNode.fields();
    while (customFields.hasNext()) {
      Entry<String, JsonNode> entry = customFields.next();
      String fieldName = entry.getKey();
      JsonNode fieldValue = entry.getValue();

      // Validate the customFields using jsonSchema
      JsonSchema jsonSchema = TypeRegistry.instance().getSchema(entityType, fieldName);
      if (jsonSchema == null) {
        throw new IllegalArgumentException(CatalogExceptionMessage.unknownCustomField(fieldName));
      }
      Set<ValidationMessage> validationMessages = jsonSchema.validate(fieldValue);
      if (!validationMessages.isEmpty()) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.jsonValidationError(fieldName, validationMessages.toString()));
      }
    }
  }

  public void storeExtension(EntityInterface entity) throws JsonProcessingException {
    JsonNode jsonNode = JsonUtils.valueToTree(entity.getExtension());
    Iterator<Entry<String, JsonNode>> customFields = jsonNode.fields();
    while (customFields.hasNext()) {
      Entry<String, JsonNode> entry = customFields.next();
      String fieldName = entry.getKey();
      JsonNode value = entry.getValue();
      storeCustomProperty(entity, fieldName, value);
    }
  }

  public void removeExtension(EntityInterface entity) {
    JsonNode jsonNode = JsonUtils.valueToTree(entity.getExtension());
    Iterator<Entry<String, JsonNode>> customFields = jsonNode.fields();
    while (customFields.hasNext()) {
      Entry<String, JsonNode> entry = customFields.next();
      removeCustomProperty(entity, entry.getKey());
    }
  }

  private void storeCustomProperty(EntityInterface entity, String fieldName, JsonNode value)
      throws JsonProcessingException {
    String fieldFQN = TypeRegistry.getCustomPropertyFQN(entityType, fieldName);
    daoCollection
        .entityExtensionDAO()
        .insert(entity.getId().toString(), fieldFQN, "customFieldSchema", JsonUtils.pojoToJson(value));
  }

  private void removeCustomProperty(EntityInterface entity, String fieldName) {
    String fieldFQN = TypeRegistry.getCustomPropertyFQN(entityType, fieldName);
    daoCollection.entityExtensionDAO().delete(entity.getId().toString(), fieldFQN);
  }

  public ObjectNode getExtension(T entity) throws JsonProcessingException {
    String fieldFQNPrefix = TypeRegistry.getCustomPropertyFQNPrefix(entityType);
    List<ExtensionRecord> records =
        daoCollection.entityExtensionDAO().getExtensions(entity.getId().toString(), fieldFQNPrefix);
    if (records.isEmpty()) {
      return null;
    }
    ObjectNode objectNode = JsonUtils.getObjectNode();
    for (ExtensionRecord extensionRecord : records) {
      String fieldName = TypeRegistry.getPropertyName(extensionRecord.getExtensionName());
      objectNode.set(fieldName, JsonUtils.readTree(extensionRecord.getExtensionJson()));
    }
    return objectNode;
  }

  /** Validate given list of tags and add derived tags to it */
  public final List<TagLabel> addDerivedTags(List<TagLabel> tagLabels) {
    if (nullOrEmpty(tagLabels)) {
      return tagLabels;
    }

    List<TagLabel> updatedTagLabels = new ArrayList<>();
    EntityUtil.mergeTags(updatedTagLabels, tagLabels);
    for (TagLabel tagLabel : tagLabels) {
      EntityUtil.mergeTags(updatedTagLabels, getDerivedTags(tagLabel));
    }
    updatedTagLabels.sort(compareTagLabel);
    return updatedTagLabels;
  }

  /** Get tags associated with a given set of tags */
  private List<TagLabel> getDerivedTags(TagLabel tagLabel) {
    if (tagLabel.getSource() == TagLabel.TagSource.GLOSSARY) { // Related tags are only supported for Glossary
      List<TagLabel> derivedTags = daoCollection.tagUsageDAO().getTags(tagLabel.getTagFQN());
      derivedTags.forEach(tag -> tag.setLabelType(TagLabel.LabelType.DERIVED));
      return derivedTags;
    }
    return Collections.emptyList();
  }

  protected void applyTags(T entity) {
    if (supportsTags) {
      // Add entity level tags by adding tag to the entity relationship
      applyTags(entity.getTags(), entity.getFullyQualifiedName());
    }
  }

  /** Apply tags {@code tagLabels} to the entity or field identified by {@code targetFQN} */
  public void applyTags(List<TagLabel> tagLabels, String targetFQN) {
    for (TagLabel tagLabel : listOrEmpty(tagLabels)) {
      if (tagLabel.getSource() == TagSource.CLASSIFICATION) {
        Tag tag = daoCollection.tagDAO().findEntityByName(tagLabel.getTagFQN());
        tagLabel.withDescription(tag.getDescription());
        tagLabel.setSource(TagSource.CLASSIFICATION);
      } else if (tagLabel.getSource() == TagLabel.TagSource.GLOSSARY) {
        GlossaryTerm term = daoCollection.glossaryTermDAO().findEntityByName(tagLabel.getTagFQN(), NON_DELETED);
        tagLabel.withDescription(term.getDescription());
        tagLabel.setSource(TagLabel.TagSource.GLOSSARY);
      }

      // Apply tagLabel to targetFQN that identifies an entity or field
      daoCollection
          .tagUsageDAO()
          .applyTag(
              tagLabel.getSource().ordinal(),
              tagLabel.getTagFQN(),
              targetFQN,
              tagLabel.getLabelType().ordinal(),
              tagLabel.getState().ordinal());
    }
  }

  void checkMutuallyExclusive(List<TagLabel> tagLabels) {
    Map<String, TagLabel> map = new HashMap<>();
    for (TagLabel tagLabel : listOrEmpty(tagLabels)) {
      // When two tags have the same parent that is mutuallyExclusive, then throw an error
      String parentFqn = FullyQualifiedName.getParent(tagLabel.getTagFQN());
      TagLabel stored = map.put(parentFqn, tagLabel);
      if (stored != null && TagLabelCache.getInstance().mutuallyExclusive(tagLabel)) {
        throw new IllegalArgumentException(CatalogExceptionMessage.mutuallyExclusiveLabels(tagLabel, stored));
      }
    }
  }

  protected List<TagLabel> getTags(String fqn) {
    return !supportsTags ? null : daoCollection.tagUsageDAO().getTags(fqn);
  }

  protected List<EntityReference> getFollowers(T entity) throws IOException {
    if (!supportsFollower || entity == null) {
      return Collections.emptyList();
    }
    List<EntityReference> followers = new ArrayList<>();
    List<EntityRelationshipRecord> records = findFrom(entity.getId(), entityType, Relationship.FOLLOWS, Entity.USER);
    for (EntityRelationshipRecord entityRelationshipRecord : records) {
      followers.add(daoCollection.userDAO().findEntityReferenceById(entityRelationshipRecord.getId(), ALL));
    }
    return followers;
  }

  public T withHref(UriInfo uriInfo, T entity) {
    if (uriInfo == null) {
      return entity;
    }
    return entity.withHref(getHref(uriInfo, entity.getId()));
  }

  public URI getHref(UriInfo uriInfo, UUID id) {
    return RestUtil.getHref(uriInfo, collectionPath, id);
  }

  public T restoreEntity(String updatedBy, String entityType, UUID id) throws IOException {
    // If an entity being restored contains other **deleted** children entities, restore them
    List<EntityRelationshipRecord> records =
        daoCollection.relationshipDAO().findTo(id.toString(), entityType, Relationship.CONTAINS.ordinal());

    if (!records.isEmpty()) {
      // Restore all the contained entities
      for (EntityRelationshipRecord entityRelationshipRecord : records) {
        LOG.info("Recursively restoring {} {}", entityRelationshipRecord.getType(), entityRelationshipRecord.getId());
        Entity.restoreEntity(updatedBy, entityRelationshipRecord.getType(), entityRelationshipRecord.getId());
      }
    }

    // Finally set entity deleted flag to false
    LOG.info("Restoring the {} {}", entityType, id);
    T entity = dao.findEntityById(id, DELETED);
    entity.setDeleted(false);
    dao.update(entity.getId(), JsonUtils.pojoToJson(entity));
    return entity;
  }

  public void addRelationship(UUID fromId, UUID toId, String fromEntity, String toEntity, Relationship relationship) {
    addRelationship(fromId, toId, fromEntity, toEntity, relationship, false);
  }

  public void addRelationship(
      UUID fromId, UUID toId, String fromEntity, String toEntity, Relationship relationship, boolean bidirectional) {
    addRelationship(fromId, toId, fromEntity, toEntity, relationship, null, bidirectional);
  }

  public void addRelationship(
      UUID fromId,
      UUID toId,
      String fromEntity,
      String toEntity,
      Relationship relationship,
      String json,
      boolean bidirectional) {
    UUID from = fromId;
    UUID to = toId;
    if (bidirectional && fromId.compareTo(toId) > 0) {
      // For bidirectional relationship, instead of adding two row fromId -> toId and toId -> fromId, just add one
      // row where fromId is alphabetically less than toId
      from = toId;
      to = fromId;
    }
    daoCollection.relationshipDAO().insert(from, to, fromEntity, toEntity, relationship.ordinal(), json);
  }

  public List<EntityRelationshipRecord> findBoth(
      UUID entity1, String entityType1, Relationship relationship, String entity2) {
    // Find bidirectional relationship
    List<EntityRelationshipRecord> ids = new ArrayList<>();
    ids.addAll(findFrom(entity1, entityType1, relationship, entity2));
    ids.addAll(findTo(entity1, entityType1, relationship, entity2));
    return ids;
  }

  public List<EntityRelationshipRecord> findFrom(
      UUID toId, String toEntityType, Relationship relationship, String fromEntityType) {
    return fromEntityType == null
        ? daoCollection.relationshipDAO().findFrom(toId.toString(), toEntityType, relationship.ordinal())
        : daoCollection
            .relationshipDAO()
            .findFrom(toId.toString(), toEntityType, relationship.ordinal(), fromEntityType);
  }

  public List<EntityRelationshipRecord> findFrom(String toId) {
    return daoCollection.relationshipDAO().findFrom(toId);
  }

  public EntityReference getContainer(UUID toId) throws IOException {
    return getFromEntityRef(toId, Relationship.CONTAINS, null, true);
  }

  public EntityReference getFromEntityRef(
      UUID toId, Relationship relationship, String fromEntityType, boolean mustHaveRelationship) throws IOException {
    List<EntityRelationshipRecord> records = findFrom(toId, entityType, relationship, fromEntityType);
    ensureSingleRelationship(entityType, toId, records, relationship.value(), mustHaveRelationship);
    return records.size() >= 1
        ? Entity.getEntityReferenceById(records.get(0).getType(), records.get(0).getId(), ALL)
        : null;
  }

  public EntityReference getToEntityRef(
      UUID fromId, Relationship relationship, String toEntityType, boolean mustHaveRelationship) throws IOException {
    List<EntityRelationshipRecord> records = findTo(fromId, entityType, relationship, toEntityType);
    ensureSingleRelationship(entityType, fromId, records, relationship.value(), mustHaveRelationship);
    return records.size() >= 1
        ? Entity.getEntityReferenceById(records.get(0).getType(), records.get(0).getId(), ALL)
        : null;
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

  public final List<EntityRelationshipRecord> findTo(
      UUID fromId, String fromEntityType, Relationship relationship, String toEntityType) {
    return daoCollection
        .relationshipDAO()
        .findTo(fromId.toString(), fromEntityType, relationship.ordinal(), toEntityType);
  }

  public void deleteRelationship(
      UUID fromId, String fromEntityType, UUID toId, String toEntityType, Relationship relationship) {
    daoCollection
        .relationshipDAO()
        .delete(fromId.toString(), fromEntityType, toId.toString(), toEntityType, relationship.ordinal());
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
      for (EntityReference entityReference : entityReferences) {
        EntityReference ref =
            entityReference.getId() != null
                ? daoCollection.userDAO().findEntityReferenceById(entityReference.getId())
                : daoCollection.userDAO().findEntityReferenceByName(entityReference.getFullyQualifiedName());
        EntityUtil.copy(ref, entityReference);
      }
      entityReferences.sort(EntityUtil.compareEntityReference);
    }
  }

  public void validateRoles(List<EntityReference> roles) throws IOException {
    if (roles != null) {
      for (EntityReference entityReference : roles) {
        EntityReference ref = daoCollection.roleDAO().findEntityReferenceById(entityReference.getId());
        EntityUtil.copy(ref, entityReference);
      }
      roles.sort(EntityUtil.compareEntityReference);
    }
  }

  void validatePolicies(List<EntityReference> policies) throws IOException {
    if (policies != null) {
      for (EntityReference entityReference : policies) {
        EntityReference ref = daoCollection.policyDAO().findEntityReferenceById(entityReference.getId());
        EntityUtil.copy(ref, entityReference);
      }
      policies.sort(EntityUtil.compareEntityReference);
    }
  }

  public EntityReference getOwner(T entity) throws IOException {
    return !supportsOwner ? null : getFromEntityRef(entity.getId(), Relationship.OWNS, null, false);
  }

  public EntityReference getOwner(EntityReference ref) throws IOException {
    return !supportsOwner ? null : Entity.getEntityReferenceById(ref.getType(), ref.getId(), ALL);
  }

  public void populateOwner(EntityReference owner) throws IOException {
    if (owner == null) {
      return;
    }
    EntityReference ref = validateOwner(owner);
    EntityUtil.copy(ref, owner);
  }

  protected void storeOwner(T entity, EntityReference owner) {
    if (supportsOwner && owner != null) {
      // Add relationship owner --- owns ---> ownedEntity
      LOG.info("Adding owner {}:{} for entity {}:{}", owner.getType(), owner.getId(), entityType, entity.getId());
      addRelationship(owner.getId(), entity.getId(), owner.getType(), entityType, Relationship.OWNS);
    }
  }

  /** Remove owner relationship for a given entity */
  private void removeOwner(T entity, EntityReference owner) {
    if (EntityUtil.getId(owner) != null) {
      LOG.info("Removing owner {}:{} for entity {}", owner.getType(), owner.getId(), entity.getId());
      deleteRelationship(owner.getId(), owner.getType(), entity.getId(), entityType, Relationship.OWNS);
    }
  }

  public void updateOwner(T ownedEntity, EntityReference originalOwner, EntityReference newOwner) {
    // TODO inefficient use replace instead of delete and add and check for orig and new owners being the same
    removeOwner(ownedEntity, originalOwner);
    storeOwner(ownedEntity, newOwner);
  }

  public final Fields getFields(String fields) {
    if (fields != null && fields.equals("*")) {
      return new Fields(allowedFields, String.join(",", allowedFields));
    }
    return new Fields(allowedFields, fields);
  }

  public final List<String> getAllowedFieldsCopy() {
    return new ArrayList<>(allowedFields);
  }

  protected String getCustomPropertyFQNPrefix(String entityType) {
    return FullyQualifiedName.build(entityType, "customProperties");
  }

  protected String getCustomPropertyFQN(String entityType, String propertyName) {
    return FullyQualifiedName.build(entityType, "customProperties", propertyName);
  }

  protected List<EntityReference> getIngestionPipelines(T service) throws IOException {
    List<EntityRelationshipRecord> records =
        findTo(service.getId(), entityType, Relationship.CONTAINS, Entity.INGESTION_PIPELINE);
    List<EntityReference> ingestionPipelines = new ArrayList<>();
    for (EntityRelationshipRecord entityRelationshipRecord : records) {
      ingestionPipelines.add(
          daoCollection.ingestionPipelineDAO().findEntityReferenceById(entityRelationshipRecord.getId(), ALL));
    }
    return ingestionPipelines;
  }

  protected void checkSystemEntityDeletion(T entity) {
    if (ProviderType.SYSTEM.equals(entity.getProvider())) { // System provided entity can't be deleted
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(entity.getName(), entityType));
    }
  }

  public EntityReference validateOwner(EntityReference owner) throws IOException {
    if (owner == null) {
      return null;
    }
    // Entities can be only owned by team of type 'group'
    if (owner.getType().equals(Entity.TEAM)) {
      Team team = Entity.getEntity(Entity.TEAM, owner.getId(), "", ALL);
      if (!team.getTeamType().equals(CreateTeam.TeamType.GROUP)) {
        throw new IllegalArgumentException(CatalogExceptionMessage.invalidTeamOwner(team.getTeamType()));
      }
      return team.getEntityReference();
    }
    return Entity.getEntityReferenceById(owner.getType(), owner.getId(), ALL);
  }

  /** Override this method to support downloading CSV functionality */
  public String exportToCsv(String name, String user) throws IOException {
    throw new IllegalArgumentException(csvNotSupported(entityType));
  }

  /** Load CSV provided for bulk upload */
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user) throws IOException {
    throw new IllegalArgumentException(csvNotSupported(entityType));
  }

  public enum Operation {
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
   * @see TableRepository.TableUpdater#entitySpecificUpdate() for example.
   */
  public class EntityUpdater {
    protected final T original;
    protected final T updated;
    protected final Operation operation;
    protected final ChangeDescription changeDescription = new ChangeDescription();
    protected boolean majorVersionChange = false;
    protected final User updatingUser;
    private boolean entityRestored = false;

    public EntityUpdater(T original, T updated, Operation operation) {
      this.original = original;
      this.updated = updated;
      this.operation = operation;
      this.updatingUser =
          updated.getUpdatedBy().equalsIgnoreCase(ADMIN_USER_NAME)
              ? new User().withName(ADMIN_USER_NAME).withIsAdmin(true)
              : SubjectCache.getInstance().getSubjectContext(updated.getUpdatedBy()).getUser();
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
        updateExtension();
        updateTags(updated.getFullyQualifiedName(), FIELD_TAGS, original.getTags(), updated.getTags());
        entitySpecificUpdate();
      }

      // Store the updated entity
      storeUpdate();
    }

    public void entitySpecificUpdate() throws IOException {
      // Default implementation. Override this to add any entity specific field updates
    }

    private void updateDescription() throws JsonProcessingException {
      if (operation.isPut() && !nullOrEmpty(original.getDescription()) && updatedByBot()) {
        // Revert change to non-empty description if it is being updated by a bot
        updated.setDescription(original.getDescription());
        return;
      }
      recordChange(FIELD_DESCRIPTION, original.getDescription(), updated.getDescription());
    }

    private void updateDeleted() throws JsonProcessingException {
      if (operation.isPut() || operation.isPatch()) {
        // Update operation can't set delete attributed to true. This can only be done as part of delete operation
        if (updated.getDeleted() != original.getDeleted() && Boolean.TRUE.equals(updated.getDeleted())) {
          throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(entityType, FIELD_DELETED));
        }
        // PUT or PATCH is restoring the soft-deleted entity
        if (Boolean.TRUE.equals(original.getDeleted())) {
          updated.setDeleted(false);
          recordChange(FIELD_DELETED, true, false);
          entityRestored = true;
        }
      } else {
        recordChange(FIELD_DELETED, original.getDeleted(), updated.getDeleted());
      }
    }

    private void updateDisplayName() throws JsonProcessingException {
      if (operation.isPut() && !nullOrEmpty(original.getDisplayName()) && updatedByBot()) {
        // Revert change to non-empty displayName if it is being updated by a bot
        updated.setDisplayName(original.getDisplayName());
        return;
      }
      recordChange(FIELD_DISPLAY_NAME, original.getDisplayName(), updated.getDisplayName());
    }

    private void updateOwner() throws JsonProcessingException {
      EntityReference origOwner = original.getOwner();
      EntityReference updatedOwner = updated.getOwner();
      if ((operation.isPatch() || updatedOwner != null)
          && recordChange(FIELD_OWNER, origOwner, updatedOwner, true, entityReferenceMatch)) {
        // Update owner for all PATCH operations. For PUT operations, ownership can't be removed
        EntityRepository.this.updateOwner(original, origOwner, updatedOwner);
      }
    }

    protected void updateTags(String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags)
        throws IOException {
      // Remove current entity tags in the database. It will be added back later from the merged tag list.
      origTags = listOrEmpty(origTags);
      // updatedTags cannot be immutable list, as we are adding the origTags to updatedTags even if its empty.
      updatedTags = Optional.ofNullable(updatedTags).orElse(new ArrayList<>());
      if (origTags.isEmpty() && updatedTags.isEmpty()) {
        return; // Nothing to update
      }

      // Remove current entity tags in the database. It will be added back later from the merged tag list.
      daoCollection.tagUsageDAO().deleteTagsByTarget(fqn);

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

    private void updateExtension() throws JsonProcessingException {
      if (original.getExtension() == updated.getExtension()) {
        return;
      }

      if (updatedByBot() && operation == Operation.PUT) {
        // Revert extension field, if being updated by a bot with a PUT request to avoid overwriting custom extension
        updated.setExtension(original.getExtension());
        return;
      }

      List<JsonNode> added = new ArrayList<>();
      List<JsonNode> deleted = new ArrayList<>();
      JsonNode origFields = JsonUtils.valueToTree(original.getExtension());
      JsonNode updatedFields = JsonUtils.valueToTree(updated.getExtension());

      // Check for updated and deleted fields
      for (Iterator<Entry<String, JsonNode>> it = origFields.fields(); it.hasNext(); ) {
        Entry<String, JsonNode> orig = it.next();
        JsonNode updated = updatedFields.get(orig.getKey());
        if (updated == null) {
          deleted.add(JsonUtils.getObjectNode(orig.getKey(), orig.getValue()));
        } else {
          // TODO converting to a string is a hack for now because JsonNode equals issues
          recordChange(getExtensionField(orig.getKey()), orig.getValue().toString(), updated.toString());
        }
      }

      // Check for added fields
      for (Iterator<Entry<String, JsonNode>> it = updatedFields.fields(); it.hasNext(); ) {
        Entry<String, JsonNode> updated = it.next();
        JsonNode orig = origFields.get(updated.getKey());
        if (orig == null) {
          added.add(JsonUtils.getObjectNode(updated.getKey(), updated.getValue()));
        }
      }
      if (!added.isEmpty()) {
        fieldAdded(changeDescription, FIELD_EXTENSION, JsonUtils.pojoToJson(added));
      }
      if (!deleted.isEmpty()) {
        fieldDeleted(changeDescription, FIELD_EXTENSION, JsonUtils.pojoToJson(deleted));
      }
      removeExtension(original);
      storeExtension(updated);
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
      updated.setVersion(newVersion);
      updated.setChangeDescription(changeDescription);
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
      if (orig == updated) {
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
        if (stored == null) { // New entry added
          addedItems.add(U);
        }
      }
      if (!addedItems.isEmpty()) {
        fieldAdded(changeDescription, field, JsonUtils.pojoToJson(addedItems));
      }
      if (!deletedItems.isEmpty()) {
        fieldDeleted(changeDescription, field, JsonUtils.pojoToJson(deletedItems));
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
        return; // No changes between original and updated.
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

    public final void updateToRelationship(
        String field,
        String fromEntityType,
        UUID fromId,
        Relationship relationshipType,
        String toEntityType,
        EntityReference origToRef,
        EntityReference updatedToRef,
        boolean bidirectional)
        throws JsonProcessingException {
      if (!recordChange(field, origToRef, updatedToRef, true, entityReferenceMatch)) {
        return; // No changes between original and updated.
      }
      // Remove relationships from original
      deleteFrom(fromId, fromEntityType, relationshipType, toEntityType);
      if (bidirectional) {
        deleteTo(fromId, fromEntityType, relationshipType, toEntityType);
      }
      // Add relationships from updated
      addRelationship(fromId, updatedToRef.getId(), fromEntityType, toEntityType, relationshipType, bidirectional);
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
        return; // No changes between original and updated.
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

    public final void updateFromRelationship(
        String field,
        String fromEntityType,
        EntityReference originFromRef,
        EntityReference updatedFromRef,
        Relationship relationshipType,
        String toEntityType,
        UUID toId)
        throws JsonProcessingException {
      if (!recordChange(field, originFromRef, updatedFromRef, true, entityReferenceMatch)) {
        return; // No changes between original and updated.
      }
      // Remove relationships from original
      deleteTo(toId, toEntityType, relationshipType, fromEntityType);

      // Add relationships from updated
      addRelationship(updatedFromRef.getId(), toId, fromEntityType, toEntityType, relationshipType);
    }

    public final void storeUpdate() throws IOException {
      if (updateVersion(original.getVersion())) { // Update changed the entity version
        storeOldVersion(); // Store old version for listing previous versions of the entity
        storeNewVersion(); // Store the update version of the entity
      } else { // Update did not change the entity version
        updated.setUpdatedBy(original.getUpdatedBy());
        updated.setUpdatedAt(original.getUpdatedAt());
      }
    }

    private void storeOldVersion() throws JsonProcessingException {
      String extensionName = EntityUtil.getVersionExtension(entityType, original.getVersion());
      daoCollection
          .entityExtensionDAO()
          .insert(original.getId().toString(), extensionName, entityType, JsonUtils.pojoToJson(original));
    }

    private void storeNewVersion() throws IOException {
      EntityRepository.this.storeEntity(updated, true);
    }

    public final boolean updatedByBot() {
      return Boolean.TRUE.equals(updatingUser.getIsBot());
    }
  }

  /** Handle column-specific updates for entities such as Tables, Containers' dataModel or Dashboard Model Entities. */
  abstract class ColumnEntityUpdater extends EntityUpdater {

    public ColumnEntityUpdater(T original, T updated, Operation operation) {
      super(original, updated, operation);
    }

    public void updateColumns(
        String fieldName,
        List<Column> origColumns,
        List<Column> updatedColumns,
        BiPredicate<Column, Column> columnMatch)
        throws IOException {
      List<Column> deletedColumns = new ArrayList<>();
      List<Column> addedColumns = new ArrayList<>();
      recordListChange(fieldName, origColumns, updatedColumns, addedColumns, deletedColumns, columnMatch);
      // carry forward tags and description if deletedColumns matches added column
      Map<String, Column> addedColumnMap =
          addedColumns.stream().collect(Collectors.toMap(Column::getName, Function.identity()));

      for (Column deleted : deletedColumns) {
        if (addedColumnMap.containsKey(deleted.getName())) {
          Column addedColumn = addedColumnMap.get(deleted.getName());
          if (nullOrEmpty(addedColumn.getDescription())) {
            addedColumn.setDescription(deleted.getDescription());
          }
          if (nullOrEmpty(addedColumn.getTags()) && nullOrEmpty(deleted.getTags())) {
            addedColumn.setTags(deleted.getTags());
          }
        }
      }

      // Delete tags related to deleted columns
      deletedColumns.forEach(
          deleted -> daoCollection.tagUsageDAO().deleteTagsByTarget(deleted.getFullyQualifiedName()));

      // Add tags related to newly added columns
      for (Column added : addedColumns) {
        applyTags(added.getTags(), added.getFullyQualifiedName());
      }

      // Carry forward the user generated metadata from existing columns to new columns
      for (Column updated : updatedColumns) {
        // Find stored column matching name, data type and ordinal position
        Column stored = origColumns.stream().filter(c -> columnMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New column added
          continue;
        }

        updateColumnDescription(stored, updated);
        updateColumnDisplayName(stored, updated);
        updateColumnDataLength(stored, updated);
        updateColumnPrecision(stored, updated);
        updateColumnScale(stored, updated);
        updateTags(
            stored.getFullyQualifiedName(),
            EntityUtil.getFieldName(fieldName, updated.getName(), FIELD_TAGS),
            stored.getTags(),
            updated.getTags());
        updateColumnConstraint(stored, updated);

        if (updated.getChildren() != null && stored.getChildren() != null) {
          String childrenFieldName = EntityUtil.getFieldName(fieldName, updated.getName());
          updateColumns(childrenFieldName, stored.getChildren(), updated.getChildren(), columnMatch);
        }
      }

      majorVersionChange = majorVersionChange || !deletedColumns.isEmpty();
    }

    private void updateColumnDescription(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      if (operation.isPut() && !nullOrEmpty(origColumn.getDescription()) && updatedByBot()) {
        // Revert the non-empty task description if being updated by a bot
        updatedColumn.setDescription(origColumn.getDescription());
        return;
      }
      String columnField = getColumnField(original, origColumn, FIELD_DESCRIPTION);
      recordChange(columnField, origColumn.getDescription(), updatedColumn.getDescription());
    }

    private void updateColumnDisplayName(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      if (operation.isPut() && !nullOrEmpty(origColumn.getDescription()) && updatedByBot()) {
        // Revert the non-empty task description if being updated by a bot
        updatedColumn.setDisplayName(origColumn.getDisplayName());
        return;
      }
      String columnField = getColumnField(original, origColumn, FIELD_DISPLAY_NAME);
      recordChange(columnField, origColumn.getDisplayName(), updatedColumn.getDisplayName());
    }

    private void updateColumnConstraint(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      String columnField = getColumnField(original, origColumn, "constraint");
      recordChange(columnField, origColumn.getConstraint(), updatedColumn.getConstraint());
    }

    protected void updateColumnDataLength(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      String columnField = getColumnField(original, origColumn, "dataLength");
      boolean updated = recordChange(columnField, origColumn.getDataLength(), updatedColumn.getDataLength());
      if (updated
          && (origColumn.getDataLength() == null || updatedColumn.getDataLength() < origColumn.getDataLength())) {
        // The data length of a column was reduced or added. Treat it as backward-incompatible change
        majorVersionChange = true;
      }
    }

    private void updateColumnPrecision(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      String columnField = getColumnField(original, origColumn, "precision");
      boolean updated = recordChange(columnField, origColumn.getPrecision(), updatedColumn.getPrecision());
      if (origColumn.getPrecision() != null
          && updated
          && updatedColumn.getPrecision() < origColumn.getPrecision()) { // Previously precision was set
        // The precision was reduced. Treat it as backward-incompatible change
        majorVersionChange = true;
      }
    }

    private void updateColumnScale(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      String columnField = getColumnField(original, origColumn, "scale");
      boolean updated = recordChange(columnField, origColumn.getScale(), updatedColumn.getScale());
      if (origColumn.getScale() != null
          && updated
          && updatedColumn.getScale() < origColumn.getScale()) { // Previously scale was set
        // The scale was reduced. Treat it as backward-incompatible change
        majorVersionChange = true;
      }
    }
  }
}
