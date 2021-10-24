package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.common.utils.CipherText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Interface used for accessing the concrete entity DAOs such as table, dashboard etc.
 * This gives a uniform access so that common boiler plate code can be reduced.
 */
public abstract class EntityRepository<T> {
  public static final Logger LOG = LoggerFactory.getLogger(EntityRepository.class);
  private final Class<T> entityClass;
  private final EntityDAO<T> dao;
  private final CollectionDAO daoCollection;
  private final Fields patchFields;
  private final Fields putFields;

  EntityRepository(Class<T> entityClass, EntityDAO<T> entityDAO, CollectionDAO collectionDAO,
                   Fields patchFields, Fields putFields) {
    this.entityClass = entityClass;
    this.dao = entityDAO;
    this.daoCollection = collectionDAO;
    this.patchFields = patchFields;
    this.putFields = putFields;
  }

  @Transaction
  public final T get(String id, Fields fields) throws IOException, ParseException {
    return setFields(dao.findEntityById(UUID.fromString(id)), fields);
  }

  @Transaction
  public final T getByName(String fqn, Fields fields) throws IOException, ParseException {
    return setFields(dao.findEntityByName(fqn), fields);
  }

  @Transaction
  public final ResultList<T> listAfter(Fields fields, String fqnPrefix, int limitParam, String after)
          throws GeneralSecurityException, IOException, ParseException {
    // forward scrolling, if after == null then first page is being asked
    List<String> jsons = dao.listAfter(fqnPrefix, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      entities.add(setFields(JsonUtils.readValue(json, entityClass), fields));
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
  public final ResultList<T> listBefore(Fields fields, String fqnPrefix, int limitParam, String before)
          throws IOException, GeneralSecurityException, ParseException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = dao.listBefore(fqnPrefix, limitParam + 1, CipherText.instance().decrypt(before));

    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      entities.add(setFields(JsonUtils.readValue(json, entityClass), fields));
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
  public final T create(T entity) throws IOException, ParseException {
    validate(entity);
    return createInternal(entity);
  }

  @Transaction
  public final PutResponse<T> createOrUpdate(T updated) throws IOException, ParseException {
    validate(updated);
    T original = JsonUtils.readValue(dao.findJsonByFqn(getFullyQualifiedName(updated)), entityClass);
    if (original == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    // Update the existing entity
    setFields(original, putFields);
    validate(updated);

    EntityUpdater entityUpdater = getUpdater(original, updated, false);
    entityUpdater.update();
    entityUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public final T patch(UUID id, String user, JsonPatch patch) throws IOException, ParseException {
    T original = setFields(dao.findEntityById(id), patchFields);
    T updated = JsonUtils.applyPatch(original, patch, entityClass);
    EntityInterface<T> updatedEntity = getEntityInterface(updated);
    updatedEntity.setUpdatedBy(user);
    updatedEntity.setUpdatedAt(new Date());

    restorePatchAttributes(original, updated);
    validate(updated);
    EntityUpdater entityUpdater = getUpdater(original, updated, true);
    entityUpdater.update();
    entityUpdater.store();
    return updated;
  }

  private T createInternal(T entity) throws IOException {
    store(entity, false);
    storeRelationships(entity);
    LOG.info("Created entity {}", entity);
    return entity;
  }

  // TODO clean up all the exceptions and check if they are really thrown
  /**
   * Entity related operations
   */
  public abstract String getFullyQualifiedName(T entity);
  public abstract ResultList<T> getResultList(List<T> entities, String beforeCursor, String afterCursor,
                                              int total) throws GeneralSecurityException, UnsupportedEncodingException;
  public abstract EntityInterface<T> getEntityInterface(T entity);

  public abstract T setFields(T entity, Fields fields) throws IOException, ParseException;
  public abstract void restorePatchAttributes(T original, T updated) throws IOException, ParseException;

  public abstract void validate(T entity) throws IOException;
  public abstract void store(T entity, boolean update) throws IOException;
  public abstract void storeRelationships(T entity) throws IOException;
  public abstract EntityUpdater getUpdater(T original, T updated, boolean patchOperation) throws IOException;

  // TODO better name
  public abstract class EntityUpdater {
    protected final EntityInterface<T> original;
    protected final EntityInterface<T> updated;
    protected final boolean patchOperation;
    protected final List<String> fieldsUpdated = new ArrayList<>();
    protected final List<String> fieldsAdded = new ArrayList<>();
    protected final List<String> fieldsDeleted = new ArrayList<>();
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
      updateTags();
      entitySpecificUpdate();
    }

    private void updateDescription() {
      if (!patchOperation &&
              original.getDescription() != null && !original.getDescription().isEmpty()) {
        // Update description only when stored is empty to retain user authored descriptions
        updated.setDescription(original.getDescription());
        return;
      }
      recordChange("description", original.getDescription(), updated.getDescription());
    }

    private void updateDisplayName() {
      if (!patchOperation &&
              original.getDisplayName() != null && !original.getDisplayName().isEmpty()) {
        // Update displayName only when stored is empty to retain user authored descriptions
        updated.setDisplayName(original.getDisplayName());
        return;
      }
      recordChange("displayName", original.getDisplayName(), updated.getDisplayName());
    }

    private void updateOwner() {
      EntityReference origOwner = original.getOwner();
      EntityReference updatedOwner = updated.getOwner();
      if (recordChange("owner", origOwner == null ? null : origOwner.getId(),
              updatedOwner == null ? null : updatedOwner.getId())) {
        EntityUtil.updateOwner(daoCollection.relationshipDAO(), origOwner,
                updatedOwner, original.getId(), Entity.TABLE);
      }
    }

    private void updateTags() throws IOException {
      // Remove current table tags in the database. It will be added back later from the merged tag list.
      EntityUtil.removeTagsByPrefix(daoCollection.tagDAO(), original.getFullyQualifiedName());
      if (!patchOperation) {
        // PUT operation merges tags in the request with what already exists
        updated.setTags(EntityUtil.mergeTags(updated.getTags(), original.getTags()));
      }

      recordChange("tags", original.getTags() == null ? 0 : original.getTags().size(),
              updated.getTags() == null ? 0 : updated.getTags().size());
      EntityUtil.applyTags(daoCollection.tagDAO(), updated.getTags(), updated.getFullyQualifiedName());
    }

    public abstract void entitySpecificUpdate() throws IOException;

    public final Double getNewVersion(Double oldVersion) {
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

    public final boolean recordChange(String field, Object orig, Object updated) {
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

    public final void store() throws IOException {
      updated.setVersion(getNewVersion(original.getVersion()));
      EntityRepository.this.store(updated.getEntity(), true);
    }
  }
}
